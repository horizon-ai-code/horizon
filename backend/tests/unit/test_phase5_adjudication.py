"""Tests for Phase 5 — Adjudication (judge verdict)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase5_adjudication import Phase5Adjudication


@pytest.mark.asyncio
class TestPhase5Adjudication:
    @pytest.fixture
    def state(self):
        return OrchestrationState(
            session_id="t", base_code="class A { void m() { } }", working_code="class A { void m() { } }", user_instruction="flatten"
        )

    async def test_run_completes(self, state):
        client = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.judge.max_tokens = 4096
        config.judge.temperature = 0.1
        prompts = {"judge": {"auditor": "audit", "insights": "insights"}}
        notify = AsyncMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        agent.generate.return_value = {"choices": [{"message": {"content": '{"verdict": "ACCEPT"}'}}]}
        phase = Phase5Adjudication(agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state)
        assert state.current_phase is not None

    async def test_revise_routes_back(self, state):
        client = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.judge.max_tokens = 4096
        config.judge.temperature = 0.1
        prompts = {"judge": {"auditor": "audit", "insights": "insights"}}
        notify = AsyncMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        agent.generate.return_value = {"choices": [{"message": {"content": '{"verdict": "REVISE", "issues": []}'}}]}
        phase = Phase5Adjudication(agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state)
        assert state.current_phase is not None
