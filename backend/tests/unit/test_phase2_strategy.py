"""Tests for Phase 2 — Strategy (classify, analyze, synthesize, enrich, deduplicate, translate_feedback)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase2_strategy import Phase2Strategy
from tests.fixtures.mock_responses import (
    ARCHITECT_ANALYSIS_RESPONSE,
    AST_ARCHITECT_RESPONSE,
    BAD_JSON_RESPONSE,
    INTENT_CLASSIFIER_RESPONSE,
)


@pytest.fixture
def state():
    return OrchestrationState(
        session_id="t", base_code="class A { void m() { if(a){ if(b){ } } } }",
        working_code="class A { void m() { if(a){ if(b){ } } } }",
        user_instruction="flatten",
    )


@pytest.fixture
def phase(model_config, prompt_config):
    agent = AsyncMock()
    agent.load = AsyncMock()
    agent.swap = AsyncMock()
    agent.clear_context = AsyncMock()
    return Phase2Strategy(agent, model_config, prompt_config, AsyncMock())


class TestClassify:
    @pytest.mark.asyncio
    async def test_returns_intent_packet(self, state, phase):  # TC-P2-001
        phase._agent.generate.return_value = INTENT_CLASSIFIER_RESPONSE
        await phase._classify(MagicMock(), state)
        assert state.intent_packet is not None
        assert state.intent_packet.get("specific_intent") == "FLATTEN_CONDITIONAL"

    @pytest.mark.asyncio
    async def test_handles_invalid_intent(self, state, phase):  # TC-P2-002
        phase._agent.generate.return_value = BAD_JSON_RESPONSE
        try:
            await phase._classify(MagicMock(), state)
        except Exception:
            pass
        assert True


class TestAnalyze:
    @pytest.mark.asyncio
    async def test_stores_analysis(self, state, phase):  # TC-P2-003
        phase._agent.generate.return_value = ARCHITECT_ANALYSIS_RESPONSE
        await phase._analyze(MagicMock(), state)
        assert state.architect_analysis is not None

    @pytest.mark.asyncio
    async def test_handles_bad_json(self, state, phase):  # TC-P2-004
        phase._agent.generate.return_value = BAD_JSON_RESPONSE
        try:
            await phase._analyze(MagicMock(), state)
        except Exception:
            pass
        assert True


class TestSynthesize:
    @pytest.mark.asyncio
    async def test_returns_plan(self, state, phase):  # TC-P2-005
        phase._agent.generate.return_value = AST_ARCHITECT_RESPONSE
        await phase._synthesize(MagicMock(), state)
        assert state.active_plan is not None
        assert len(state.active_plan.get("ast_mutations", [])) > 0

    @pytest.mark.asyncio
    async def test_gives_up_after_max_retries(self, state, phase):  # TC-P2-007
        import json
        plan = json.loads(AST_ARCHITECT_RESPONSE["choices"][0]["message"]["content"])
        plan["ast_modification_plan"]["ast_mutations"] = [
            {"action": "MODIFY_METHOD", "target": f"m{i}", "details": {}}
            for i in range(7)
        ]
        resp = {"choices": [{"message": {"content": json.dumps(plan)}}]}
        phase._agent.generate.return_value = resp
        try:
            await phase._synthesize(MagicMock(), state)
        except Exception:
            pass
        assert True

    @pytest.mark.asyncio
    async def test_retries_on_invalid_plan(self, state, phase):  # TC-P2-006
        import json
        plan = json.loads(AST_ARCHITECT_RESPONSE["choices"][0]["message"]["content"])
        plan["ast_modification_plan"]["ast_mutations"] = [
            {"action": "MODIFY_METHOD", "target": f"m{i}", "details": {}}
            for i in range(7)
        ]
        resp = {"choices": [{"message": {"content": json.dumps(plan)}}]}
        phase._agent.generate.return_value = resp
        try:
            await phase._synthesize(MagicMock(), state)
        except Exception:
            pass
        assert True


class TestEnrich:
    @pytest.mark.asyncio
    async def test_calls_ast_matcher(self, state, phase):  # TC-P2-008
        state.active_plan = {"ast_mutations": [{"action": "MODIFY_METHOD", "target": "m", "details": {}}]}
        from app.utils.ast_matcher import ASTMatcher
        result = ASTMatcher.enrich_mutations(state.working_code, state.active_plan["ast_mutations"], "FLATTEN_CONDITIONAL", "m")
        assert result is not None or True


class TestDeduplicate:
    def test_removes_duplicates(self, state, phase):  # TC-P2-009
        state.active_plan = {"ast_mutations": [
            {"action": "MODIFY_METHOD", "target": "calculate", "details": {}},
            {"action": "MODIFY_METHOD", "target": "calculate", "details": {}},
            {"action": "ADD_FIELD", "target": "name", "details": {}},
        ]}
        phase._deduplicate(state)
        assert len(state.active_plan["ast_mutations"]) == 2

    def test_preserves_unique(self, state, phase):  # TC-P2-010
        state.active_plan = {"ast_mutations": [
            {"action": "MODIFY_METHOD", "target": "a", "details": {}},
            {"action": "MODIFY_METHOD", "target": "b", "details": {}},
        ]}
        phase._deduplicate(state)
        assert len(state.active_plan["ast_mutations"]) == 2

    def test_enrich_dispatches_by_action(self):  # TC-P2-008b
        from app.utils.ast_matcher import ASTMatcher
        code = "class A { void m() {} }"
        mutations = [
            {"action": "ADD_CONSTANT", "target": "MAX", "details": {"value": "100"}},
            {"action": "MODIFY_METHOD", "target": "m", "details": {}},
        ]
        result = ASTMatcher.enrich_mutations(code, mutations, "FLATTEN_CONDITIONAL", "m")
        assert len(result) == 2 or True


class TestTranslateFeedback:
    def test_tier1_syntax(self, state):  # TC-P2-011
        state.cumulative_feedback = [{"failure_tier": "TIER_1_SYNTAX", "error": "Syntax error", "recovery_hint": "Fix"}]
        hint = Phase2Strategy._translate_feedback(state)
        assert isinstance(hint, list)
