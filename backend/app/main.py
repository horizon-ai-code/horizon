import asyncio
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime

import sentry_sdk
from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import UUID4

from app.modules.agent import AgentService, InterruptedError
from app.modules.connection import ClientConnection, ConnectionManager, MessageRouter
from app.modules.context import db
from app.modules.orchestrator import Orchestrator
from app.modules.validator import Validator
from app.utils.schemas import (
    DeleteResponse,
    HistoryDetail,
    HistoryStub,
)
from app.utils.system_monitor import SystemMonitor
from app.utils.types import RefactorRequest, Role

sentry_sdk.init(
    dsn=os.getenv("SENTRY_DSN"),
    environment=os.getenv("APP_ENV", "development"),
    traces_sample_rate=0.1,
)

# Module-level singletons — initialized at import (lightweight, no model loaded).
# Override in tests by assigning to these variables directly.
agent_service: AgentService = AgentService()
validator: Validator = Validator()
connection: ConnectionManager = ConnectionManager()
orchestrator: Orchestrator = Orchestrator(
    agent_service=agent_service, validator=validator, db=connection.db
)
router: MessageRouter = MessageRouter(agent_service)
system_monitor: SystemMonitor = SystemMonitor()

# Global lock to serialize all orchestration (model & DB) operations
orchestration_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure DB connection, clean zombie sessions.
    Shutdown: close DB, release model VRAM.
    """
    try:
        db.connect(reuse_if_open=True)
    except Exception as e:
        print(f"Warning: Database connection failed at startup: {e}")

    cleaned = connection.db.cleanup_zombie_sessions()
    if cleaned:
        print(f"Cleaned {cleaned} zombie sessions")
    deleted = connection.db.cleanup_halted_sessions()
    if deleted:
        print(f"Deleted {deleted} halted sessions")
    await system_monitor.start()
    yield
    await system_monitor.stop()
    db.close()
    await agent_service.unload()


app: FastAPI = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_db():
    db.connect(reuse_if_open=True)
    yield


async def check_orchestration_lock():
    if orchestration_lock.locked():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="System is currently busy with an active orchestration.",
        )


@app.middleware("http")
async def log_requests(request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = int((time.time() - start) * 1000)
    print(f"[{request.method}] {request.url.path} — {response.status_code} ({duration}ms)")
    return response


@app.get("/health")
async def health():
    db_status = "ok"
    try:
        db.connect(reuse_if_open=True)
        db.execute_sql("SELECT 1")
    except Exception:
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "db": db_status,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }


@app.websocket("/ws")
async def entrypoint(websocket: WebSocket) -> None:
    await websocket.accept()

    client_conn: ClientConnection = connection.create_websocket_connection(
        websocket=websocket
    )
    await client_conn.start_heartbeat()
    active_tasks: set[asyncio.Task] = set()

    async def run_orchestration(client, validated_data: RefactorRequest):
        try:
            try:
                await asyncio.wait_for(orchestration_lock.acquire(), timeout=600)
            except asyncio.TimeoutError:
                await client.send_status(
                    Role.System,
                    "Orchestration timed out after 10 minutes.",
                )
                return
            try:
                client.reset_id()
                await client.send_connection_id()
                await orchestrator.execute_orchestration(
                    client=client,
                    user_code=validated_data.code,
                    user_instruction=validated_data.user_instruction,
                )
            finally:
                orchestration_lock.release()
        except (asyncio.CancelledError, InterruptedError):
            connection.db.mark_as_halted(client.id)
            await client.send_halt_notification()
            raise
        except Exception as e:
            print(f"Orchestration Task Failure (ID: {client.id}): {e}")
            try:
                await client.send_status(
                    Role.System,
                    f"Orchestration failed: {str(e)[:200]}",
                )
            except Exception:
                pass

    try:
        while True:
            try:
                data = await websocket.receive_json()
            except (json.JSONDecodeError, TypeError, ValueError) as e:
                await websocket.send_json(
                    {"type": "error", "code": "MALFORMED_JSON", "message": "Malformed JSON payload", "details": str(e)}
                )
                continue

            if data.get("type") in ("multi", "single") and orchestration_lock.locked():
                await client_conn.send_status(Role.System, "System is busy. Your request has been queued and will start automatically.")

            handled = await router.dispatch(
                data, client_conn, active_tasks,
                run_single_refactor, run_orchestration,
                reconnect_handler=_handle_reconnect,
            )
            if handled:
                continue

    except WebSocketDisconnect as e:
        print(f"Connection disconnected: {e}")
        agent_service.stop()
        for task in active_tasks.copy():
            if not task.done():
                task.cancel()
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        await client_conn.stop_heartbeat()
        agent_service.stop()
        for task in active_tasks.copy():
            if not task.done():
                task.cancel()


@app.websocket("/ws/system")
async def system_monitor_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            metrics = system_monitor.get_current_metrics()
            await websocket.send_json({
                "type": "system_metrics",
                "metrics": metrics,
            })
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass


async def _handle_reconnect(session_id: str, ws: WebSocket) -> None:
    """Handle frontend reconnection to an existing session."""
    if not session_id:
        await ws.send_json({"type": "error", "code": "MISSING_SESSION_ID", "message": "Missing session_id"})
        return

    record = await connection.get_history_by_id(session_id)
    if not record:
        await ws.send_json({"type": "error", "code": "SESSION_NOT_FOUND", "message": "Session not found"})
        return

    new_conn = connection.create_websocket_connection(ws)
    new_conn.id = session_id
    await new_conn.start_heartbeat()

    if record.get("status") == "Completed":
        await new_conn.send_result(
            final_code=record.get("refactored_code", ""),
            original_complexity=record.get("original_complexity"),
            refactored_complexity=record.get("refactored_complexity"),
            performance_metrics={
                "avg_gpu_utilization": record.get("avg_gpu_utilization", 0),
                "avg_gpu_memory": record.get("avg_gpu_memory", 0),
                "avg_gpu_memory_used": record.get("avg_gpu_memory_used", 0),
                "inference_time": record.get("inference_time", 0),
            },
            exit_status=record.get("exit_status", "UNKNOWN"),
        )
        insights = record.get("insights")
        if insights:
            await new_conn.send_insights(insights)
        await new_conn.send_status(Role.System, "Session restored.")
        await new_conn.stop_heartbeat()
    elif record.get("status") in ("Processing", "Halted"):
        if orchestrator.current_client is not None:
            orchestrator.current_client = new_conn
            await new_conn.send_status(
                Role.System,
                f"Reconnected to ongoing session. Status: {record.get('status')}",
            )
        else:
            await new_conn.send_status(
                Role.System,
                "Session lost due to server restart. Please start a new refactor.",
            )
    else:
        await ws.send_json({"type": "error", "code": "UNKNOWN_SESSION_STATUS", "message": f"Unknown session status: {record.get('status')}"})


async def run_single_refactor(
    client: ClientConnection,
    user_code: str,
    user_instruction: str,
) -> None:
    """Thin wrapper — delegates to Orchestrator.run_single_refactor() inside the lock."""
    try:
        async with orchestration_lock:
            client.reset_id()
            await client.send_connection_id()
            await orchestrator.run_single_refactor(client, user_code, user_instruction)

    except (asyncio.CancelledError, InterruptedError):
        connection.db.mark_as_halted(client.id)
        await client.send_halt_notification()
        raise
    except Exception as e:
        print(f"Single Refactor Failure (ID: {client.id}): {e}")
        try:
            await client.send_status(Role.System, f"Single refactor failed: {str(e)[:200]}")
        except Exception:
            pass
    finally:
        await agent_service.unload()


@app.get("/api/history", response_model=list[HistoryStub], dependencies=[Depends(get_db)])
async def get_history():
    return await connection.get_rest_history()


@app.get(
    "/api/history/{history_id}",
    response_model=HistoryDetail,
    dependencies=[Depends(get_db)],
)
async def get_history_detail(
    history_id: UUID4,
):
    record = await connection.get_history_by_id(str(history_id))
    if not record:
        raise HTTPException(status_code=404, detail="Refactor history not found")
    return record


@app.delete(
    "/api/history/{history_id}",
    response_model=DeleteResponse,
    dependencies=[Depends(get_db)],
)
async def delete_history_detail(
    history_id: UUID4,
):
    deleted = await connection.delete_history_by_id(str(history_id))
    if not deleted:
        raise HTTPException(status_code=404, detail="Refactor history not found")
    return {
        "status": "history_deleted",
        "message": f"Refactor history {history_id} deleted",
    }


@app.patch(
    "/api/history/{history_id}",
    dependencies=[Depends(get_db)],
)
async def rename_history(
    history_id: UUID4,
    body: dict,
):
    new_title = body.get("title", "").strip()
    if not new_title:
        raise HTTPException(status_code=400, detail="title is required")
    success = await connection.rename_history(str(history_id), new_title)
    if not success:
        raise HTTPException(status_code=404, detail="Refactor history not found")
    return {"status": "ok", "title": new_title}
