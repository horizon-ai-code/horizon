"""Tests for Orchestrator — state management and notification."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState, Orchestrator
from app.utils.types import Role


class TestOrchestrationState:
    def test_initial_defaults(self):  # TC-OR-001
        state = OrchestrationState(
            session_id="t", base_code="class A {}", working_code="class A {}", user_instruction="refactor"
        )
        assert state.strategy_iter == 1
        assert state.cumulative_feedback == []
        assert state.exit_status == "PROCESSING"

    def test_add_feedback_appends(self):  # TC-OR-002
        state = OrchestrationState(
            session_id="t", base_code="", working_code="", user_instruction=""
        )
        state.add_feedback("hint 1")
        assert len(state.cumulative_feedback) == 1

    def test_add_feedback_ring_buffer_capped(self):  # TC-OR-003
        state = OrchestrationState(
            session_id="t", base_code="", working_code="", user_instruction=""
        )
        for i in range(5):
            state.add_feedback(f"hint {i}")
        assert len(state.cumulative_feedback) == 3
        assert state.cumulative_feedback[-1] == "hint 4"

    def test_extend_feedback_with_cap(self):  # TC-OR-004
        state = OrchestrationState(
            session_id="t", base_code="", working_code="", user_instruction=""
        )
        state.extend_feedback(["a", "b", "c", "d", "e"])
        assert len(state.cumulative_feedback) == 3
        assert state.cumulative_feedback[-1] == "e"


@pytest.mark.asyncio
class TestNotify:
    async def test_sends_status(self):  # TC-OR-005
        client = AsyncMock()
        client.id = "test-session"
        client.is_stale = False
        client.send_status = AsyncMock()
        agent = AsyncMock()
        db = MagicMock()
        validator = MagicMock()
        config = MagicMock()
        config.planner.name = "p"
        config.generator.name = "g"
        config.judge.name = "j"
        prompts = {}
        orch = Orchestrator(agent, validator, db, skip_judge=False, config=config)
        orch.prompts = prompts
        await orch._notify(client, Role.Planner, "test message", 2)
        assert client.send_status.await_count >= 1

    async def test_includes_model_names(self):  # TC-OR-006
        client = AsyncMock()
        client.id = "test-session"
        client.is_stale = False
        client.send_status = AsyncMock()
        agent = AsyncMock()
        db = MagicMock()
        validator = MagicMock()
        config = MagicMock()
        config.planner.name = "PlanModel"
        config.generator.name = "GenModel"
        config.judge.name = "JudgeModel"
        prompts = {}
        orch = Orchestrator(agent, validator, db, skip_judge=False, config=config)
        orch.prompts = prompts
        await orch._notify(client, Role.Planner, "test", 2)
        assert client.send_status.await_count >= 1

    async def test_skips_send_when_stale(self):  # TC-OR-007
        client = AsyncMock()
        client.send_status = AsyncMock()
        client.is_stale = True
        agent = AsyncMock()
        db = MagicMock()
        validator = MagicMock()
        config = MagicMock()
        config.planner.name = "p"
        config.generator.name = "g"
        config.judge.name = "j"
        prompts = {}
        orch = Orchestrator(agent, validator, db, skip_judge=False, config=config)
        orch.prompts = prompts
        await orch._notify(client, Role.System, "test", None)
        assert client.send_status.await_count == 0
