import asyncio
import uuid
from datetime import datetime
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.modules.context_manager import DatabaseManager
from app.utils.types import Role


class ClientConnection:
    """
    Manages active WebSocket connections for real-time communication
    and handles history persistence.
    """

    HEARTBEAT_INTERVAL = 15
    MAX_MISSED_PONGS = 2

    def __init__(self, websocket: WebSocket, db: DatabaseManager):
        self.websocket = websocket
        self.db = db
        self.id = str(uuid.uuid4())
        self._missed_pongs = 0
        self._heartbeat_task: asyncio.Task | None = None
        self._heartbeat_running = False

    @property
    def is_stale(self) -> bool:
        return self._missed_pongs >= self.MAX_MISSED_PONGS

    async def start_heartbeat(self) -> None:
        self._heartbeat_running = True
        self._missed_pongs = 0
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

    async def stop_heartbeat(self) -> None:
        self._heartbeat_running = False
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None

    async def _heartbeat_loop(self) -> None:
        while self._heartbeat_running:
            await asyncio.sleep(self.HEARTBEAT_INTERVAL)
            if not self._heartbeat_running:
                break
            await self._safe_send({
                "type": "ping",
                "id": self.id,
                "ts": datetime.utcnow().isoformat() + "Z",
            })
            self._missed_pongs += 1

    def handle_pong(self) -> None:
        self._missed_pongs = 0

    async def _safe_send(self, message: dict) -> None:
        """Send JSON to frontend, silently handling disconnect."""
        try:
            await self.websocket.send_json(message)
        except WebSocketDisconnect:
            pass

    def reset_id(self) -> None:
        """Generates a new unique session ID for a new orchestration request."""
        self.id = str(uuid.uuid4())

    async def send_connection_id(self) -> None:
        """Sends the unique session ID to the frontend upon connection."""
        await self._safe_send({
            "type": "connection_id",
            "id": self.id,
            "created_at": datetime.utcnow().isoformat() + "Z",
        })

    async def send_status(self, role: Role, content: str, phase: int | None = None,
                          planner_model: str | None = None,
                          generator_model: str | None = None,
                          judge_model: str | None = None) -> None:
        msg: dict[str, str | Role | int] = {"type": "status", "role": role, "content": content}
        if phase is not None:
            msg["phase"] = phase
        if planner_model is not None:
            msg["planner_model"] = planner_model
        if generator_model is not None:
            msg["generator_model"] = generator_model
        if judge_model is not None:
            msg["judge_model"] = judge_model
        await self._safe_send(msg)

    async def send_halt_notification(self) -> None:
        await self._safe_send({
            "type": "status",
            "role": Role.System,
            "content": "Orchestration halted by user.",
        })

    async def send_result(
        self,
        final_code: str,
        original_complexity: int | None,
        refactored_complexity: int | None,
        performance_metrics: dict,
        exit_status: str = "SUCCESS",
        planner_model: str | None = None,
        generator_model: str | None = None,
        judge_model: str | None = None,
    ):
        """Sends the final result payload to the frontend."""
        await self._safe_send({
            "type": "result",
            "id": self.id,
            "code": final_code,
            "exit_status": exit_status,
            "original_complexity": original_complexity,
            "refactored_complexity": refactored_complexity,
            "performance": performance_metrics,
            "planner_model": planner_model,
            "generator_model": generator_model,
            "judge_model": judge_model,
        })

    async def send_insights(self, insights: Any):
        """Sends the structured insights follow-up message."""
        await self._safe_send({
            "type": "insights",
            "id": self.id,
            "insights": insights,
        })


class ConnectionManager:
    """
    The central gateway for all incoming API connections.
    Encapsulates database access so main.py remains clean.
    """

    def __init__(self):
        self.db = DatabaseManager()

    async def get_rest_history(self):
        return self.db.get_history()

    async def get_history_by_id(self, id: str) -> dict | None:
        return self.db.get_history_by_id(id)

    async def delete_history_by_id(self, id: str) -> bool:
        return self.db.delete_history_by_id(id)

    async def rename_history(self, history_id: str, new_title: str) -> bool:
        return self.db.rename_session(history_id, new_title)

    def create_websocket_connection(self, websocket: WebSocket) -> ClientConnection:
        return ClientConnection(websocket=websocket, db=self.db)
