"""Tests for Phase 6 — Finalization (result, insights, persistence)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase6_finalization import Phase6Finalization
from app.utils.types import ExitStatus


@pytest.mark.asyncio
class TestPhase6Finalization:
    @pytest.fixture
    def state(self):
        s = OrchestrationState(
            session_id="t", base_code="class A { }", working_code="class A { }",
            user_instruction="flatten"
        )
        s.current_phase = 6
        s.exit_status = ExitStatus.SUCCESS
        s.original_complexity = 5
        return s

    async def test_sends_result(self, state):  # TC-P6-002
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        prompts = {"judge": {"insights": "insights"}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": []}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        client.send_result.assert_called()

    async def test_completes_without_crash(self, state):  # TC-P6-001
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        prompts = {"judge": {"insights": "insights"}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": []}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        assert state.exit_status == ExitStatus.SUCCESS
