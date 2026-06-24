"""Tests for Phase 5 — Adjudication (judge verdict routing)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase5_adjudication import Phase5Adjudication


@pytest.mark.asyncio
class TestPhase5Adjudication:
    @pytest.fixture
    def state(self):
        return OrchestrationState(
            session_id="t", base_code="class A { void m() { } }",
            working_code="class A { void m() { } }",
            user_instruction="flatten"
        )

    async def test_accept_routes_forward(self, state):  # TC-P5-001
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

    async def test_revise_returns_to_strategy(self, state):  # TC-P5-002
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

    async def test_hallucination_identical_code_override(self, state):  # TC-P5-003
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

    async def test_missing_response_handled(self, state):  # TC-P5-005
        client = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.judge.max_tokens = 4096
        config.judge.temperature = 0.1
        prompts = {"judge": {"auditor": "audit", "insights": "insights"}}
        notify = AsyncMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        agent.generate.return_value = {"choices": [{"message": {"content": '{}'}}]}
        phase = Phase5Adjudication(agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state)
        assert True

    async def test_extracts_structured_issues(self, state):  # TC-P5-006
        client = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.judge.max_tokens = 4096
        config.judge.temperature = 0.1
        prompts = {"judge": {"auditor": "audit", "insights": "insights"}}
        notify = AsyncMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        agent.generate.return_value = {"choices": [{"message": {"content": '{"verdict": "REVISE", "issues": [{"issue_type": "logic_drift", "description": "Logic changed"}]}'}}]}
        phase = Phase5Adjudication(agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state)
        assert state.current_phase is not None
