import asyncio
from typing import Any, Callable

from pydantic import ValidationError

from . import ClientConnection
from app.utils.types import RefactorRequest, Role


class MessageRouter:
    def __init__(self, agent_service):
        self._agent_service = agent_service

    async def dispatch(
        self,
        data: dict[str, Any],
        client: ClientConnection,
        active_tasks: set[asyncio.Task],
        run_single_refactor: Callable,
        run_orchestration: Callable,
        reconnect_handler: Callable | None = None,
    ) -> bool:
        msg_type = data.get("type", "")

        if msg_type == "pong":
            client.handle_pong()
            return True

        if msg_type == "reconnect":
            if reconnect_handler:
                await reconnect_handler(data.get("session_id", ""), client.websocket)
            return True

        if msg_type == "single":
            return await self._handle_single(data, client, active_tasks, run_single_refactor)

        if msg_type == "multi":
            return await self._handle_multi(data, client, active_tasks, run_orchestration)

        if msg_type == "halt":
            return await self._handle_halt(client, active_tasks)

        return False

    async def _handle_single(self, data, client, active_tasks, run_single_refactor) -> bool:
        code = data.get("code", "")
        instruction = data.get("user_instruction", "")
        if len(code.strip()) < 10:
            await client.send_status(Role.System, "Code must be at least 10 characters")
            return True
        if len(instruction.strip()) < 3:
            await client.send_status(Role.System, "Instruction must be at least 3 characters")
            return True

        if any(not t.done() for t in active_tasks):
            await client.send_status(Role.System, "A refactor is already in progress. Please halt it first.")
            return True

        task = asyncio.create_task(run_single_refactor(client, code, instruction))
        active_tasks.add(task)
        task.add_done_callback(active_tasks.discard)
        return True

    async def _handle_multi(self, data, client, active_tasks, run_orchestration) -> bool:
        try:
            validated = RefactorRequest(**data)
        except ValidationError as e:
            await client.send_status(Role.System, f"Invalid data format: {e.errors()}")
            return True

        if any(not t.done() for t in active_tasks):
            await client.send_status(
                Role.System,
                "A refactor is already in progress. Please halt it first if you want to start a new one.",
            )
            return True

        task = asyncio.create_task(run_orchestration(client, validated))
        active_tasks.add(task)
        task.add_done_callback(active_tasks.discard)
        return True

    async def _handle_halt(self, client, active_tasks) -> bool:
        self._agent_service.stop()
        for task in active_tasks.copy():
            if not task.done():
                task.cancel()
        await client.send_halt_notification()
        return True
