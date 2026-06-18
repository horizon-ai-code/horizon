import asyncio
import json
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import UUID4, ValidationError

from app.modules.agent_service import AgentService, InterruptedError
from app.modules.connection_manager import ClientConnection, ConnectionManager
from app.modules.context_manager import db
from app.modules.orchestrator import Orchestrator
from app.modules.validator import Validator
from app.utils.schemas import (
    DeleteResponse,
    HistoryDetail,
    HistoryStub,
)
from app.utils.types import RefactorRequest, Role

# Module-level singletons — initialized at import (lightweight, no model loaded).
# Override in tests by assigning to these variables directly.
agent_service: AgentService = AgentService()
validator: Validator = Validator()
connection: ConnectionManager = ConnectionManager()
orchestrator: Orchestrator = Orchestrator(
    agent_service=agent_service, validator=validator, db=connection.db
)

# Global lock to serialize all orchestration (model & DB) operations
orchestration_lock = asyncio.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure DB connection, clean zombie sessions.
    Shutdown: close DB, release model VRAM.
    """
    db.connect(reuse_if_open=True)
    cleaned = connection.db.cleanup_zombie_sessions()
    if cleaned:
        print(f"Cleaned {cleaned} zombie sessions")
    deleted = connection.db.cleanup_halted_sessions()
    if deleted:
        print(f"Deleted {deleted} halted sessions")
    yield
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
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}


@app.websocket("/ws")
async def entrypoint(websocket: WebSocket) -> None:
    await websocket.accept()

    client_conn: ClientConnection = connection.create_websocket_connection(
        websocket=websocket
    )
    await client_conn.start_heartbeat()
    active_tasks: set[asyncio.Task] = set()

    async def run_orchestration(validated_data: RefactorRequest):
        try:
            try:
                await asyncio.wait_for(orchestration_lock.acquire(), timeout=600)
            except asyncio.TimeoutError:
                await client_conn.send_status(
                    Role.System,
                    "Orchestration timed out after 10 minutes.",
                )
                return
            try:
                client_conn.reset_id()
                await client_conn.send_connection_id()
                await orchestrator.execute_orchestration(
                    client=client_conn,
                    user_code=validated_data.code,
                    user_instruction=validated_data.user_instruction,
                )
            finally:
                orchestration_lock.release()
        except (asyncio.CancelledError, InterruptedError):
            connection.db.mark_as_halted(client_conn.id)
            await client_conn.send_halt_notification()
            raise
        except Exception as e:
            print(f"Orchestration Task Failure (ID: {client_conn.id}): {e}")
            try:
                await client_conn.send_status(
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
                    {"type": "error", "message": "Malformed JSON payload", "details": str(e)}
                )
                continue

            if data.get("type") == "pong":
                client_conn.handle_pong()
                continue

            if data.get("type") == "reconnect":
                await _handle_reconnect(data.get("session_id", ""), websocket)
                continue

            if data.get("type") == "single":
                code = data.get("code", "")
                instruction = data.get("user_instruction", "")
                if len(code.strip()) < 10:
                    await websocket.send_json({"type": "error", "message": "Code must be at least 10 characters"})
                    continue
                if len(instruction.strip()) < 3:
                    await websocket.send_json({"type": "error", "message": "Instruction must be at least 3 characters"})
                    continue

                if any(not t.done() for t in active_tasks):
                    await client_conn.send_status(Role.System, "A refactor is already in progress. Please halt it first.")
                    continue

                task = asyncio.create_task(
                    run_single_refactor(client_conn, code, instruction)
                )
                active_tasks.add(task)
                task.add_done_callback(active_tasks.discard)
                continue

            if data.get("type") == "multi":
                try:
                    validated = RefactorRequest(**data)
                except ValidationError as e:
                    await websocket.send_json(
                        {"type": "error", "message": "Invalid data format", "details": e.errors()}
                    )
                    continue

                if any(not t.done() for t in active_tasks):
                    await client_conn.send_status(
                        role=Role.System,
                        content="A refactor is already in progress. Please halt it first if you want to start a new one.",
                    )
                    continue

                if orchestration_lock.locked():
                    await client_conn.send_status(
                        role=Role.System,
                        content="Server is currently busy with another request. Your request is in the queue and will start automatically when ready...",
                    )

                task = asyncio.create_task(run_orchestration(validated))
                active_tasks.add(task)
                task.add_done_callback(active_tasks.discard)

                async def notify_when_starting():
                    while True:
                        if not orchestration_lock.locked():
                            await client_conn.send_status(
                                Role.System,
                                "Your request is now being processed...",
                            )
                            break
                        await asyncio.sleep(0.5)
                nt = asyncio.create_task(notify_when_starting())
                active_tasks.add(nt)
                nt.add_done_callback(active_tasks.discard)
                continue

            if data.get("type") == "halt":
                agent_service.stop()
                for task in active_tasks.copy():
                    if not task.done():
                        task.cancel()
                print(f"Halt triggered for session {client_conn.id}")
                await websocket.send_json({
                    "type": "halt_acknowledged",
                    "id": client_conn.id,
                })
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


async def _handle_reconnect(session_id: str, ws: WebSocket) -> None:
    """Handle frontend reconnection to an existing session."""
    if not session_id:
        await ws.send_json({"type": "error", "message": "Missing session_id"})
        return

    record = await connection.get_history_by_id(session_id)
    if not record:
        await ws.send_json({"type": "error", "message": "Session not found"})
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
        await ws.send_json({"type": "error", "message": f"Unknown session status: {record.get('status')}"})


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
