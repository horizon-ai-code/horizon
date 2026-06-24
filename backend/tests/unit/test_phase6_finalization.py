"""Tests for Phase 6 — Finalization."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase6_finalization import Phase6Finalization


@pytest.mark.asyncio
class TestPhase6Finalization:
    @pytest.fixture
    def state(self):
        return OrchestrationState(
            session_id="t", base_code="class A { }", working_code="class A { }", user_instruction="flatten"
        )

    async def test_run_completes(self, state):
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        prompts = {"judge": {"insights": "insights"}}
        notify = AsyncMock()
        state.current_phase = 6
        from app.utils.types import ExitStatus
        state.exit_status = ExitStatus.SUCCESS
        state.original_complexity = 5
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": []}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        assert state.exit_status is not None
