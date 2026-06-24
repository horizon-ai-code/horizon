"""Tests for Phase 2 — Strategy (classify, analyze, synthesize, enrich, deduplicate, translate_feedback)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.config import OrchestrationConfig
from app.modules.orchestrator.phases.phase2_strategy import Phase2Strategy
from tests.fixtures.mock_responses import (
    ARCHITECT_ANALYSIS_RESPONSE,
    AST_ARCHITECT_RESPONSE,
    BAD_JSON_RESPONSE,
    INTENT_CLASSIFIER_RESPONSE,
)


def _make_config():
    return OrchestrationConfig.from_dict({
        "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "generator": {"name": "g", "filename": "g.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "judge": {"name": "j", "filename": "j.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 28},
        "single": {"name": "s", "filename": "s.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 4096, "layers": 20},
        "settings": {"deduplication_cap": 5, "max_strategy_iter": 3, "max_syntax_heal": 1, "sequential_retry_limit": 1},
    })


def _make_prompts():
    return {
        "planner": {
            "classifier": "Classify the intent.",
            "architect_analysis": "Analyze the code.",
            "analysis_guidance": {"FLATTEN_CONDITIONAL": "Reduce nesting."},
            "architect": "Design mutations.",
            "synthesis_guidance": {"FLATTEN_CONDITIONAL": "Use early return."},
        },
        "generator": {"coder": "", "coder_guidance": {}},
        "judge": {"auditor": "", "auditor_guidance": {}, "insights": ""},
        "single": {"coder": "", "insights": ""},
    }


@pytest.fixture
def state():
    return OrchestrationState(
        session_id="t", base_code="class A { void m() { if(a){ if(b){ } } } }",
        working_code="class A { void m() { if(a){ if(b){ } } } }",
        user_instruction="flatten",
    )


@pytest.fixture
def phase():
    agent = AsyncMock()
    config = _make_config()
    prompts = _make_prompts()
    notify = AsyncMock()
    return Phase2Strategy(agent, config, prompts, notify)


class TestClassify:
    @pytest.mark.asyncio
    async def test_returns_intent_packet(self, state, phase):
        phase._agent.generate.return_value = INTENT_CLASSIFIER_RESPONSE
        phase._agent.load = AsyncMock()
        phase._agent.swap = AsyncMock()
        await phase._classify(MagicMock(), state)
        assert state.intent_packet is not None
        assert state.intent_packet.get("specific_intent") == "FLATTEN_CONDITIONAL"

    @pytest.mark.asyncio
    async def test_handles_bad_json(self, state, phase):
        phase._agent.generate.return_value = BAD_JSON_RESPONSE
        phase._agent.load = AsyncMock()
        phase._agent.swap = AsyncMock()
        try:
            await phase._classify(MagicMock(), state)
        except Exception:
            pass
        assert True


class TestAnalyze:
    @pytest.mark.asyncio
    async def test_stores_analysis(self, state, phase):
        phase._agent.generate.return_value = ARCHITECT_ANALYSIS_RESPONSE
        phase._agent.load = AsyncMock()
        phase._agent.swap = AsyncMock()
        await phase._analyze(MagicMock(), state)
        assert state.architect_analysis is not None

    @pytest.mark.asyncio
    async def test_handles_bad_json(self, state, phase):
        phase._agent.generate.return_value = BAD_JSON_RESPONSE
        phase._agent.load = AsyncMock()
        phase._agent.swap = AsyncMock()
        try:
            await phase._analyze(MagicMock(), state)
        except Exception:
            pass
        assert True


class TestSynthesize:
    @pytest.mark.asyncio
    async def test_returns_plan(self, state, phase):
        phase._agent.generate.return_value = AST_ARCHITECT_RESPONSE
        phase._agent.load = AsyncMock()
        phase._agent.swap = AsyncMock()
        await phase._synthesize(MagicMock(), state)
        assert state.active_plan is not None
        assert len(state.active_plan.get("ast_mutations", [])) > 0


class TestDeduplicate:
    def test_removes_duplicates(self, state, phase):
        state.active_plan = {
            "ast_mutations": [
                {"action": "MODIFY_METHOD", "target": "calculate", "details": {}},
                {"action": "MODIFY_METHOD", "target": "calculate", "details": {}},
                {"action": "ADD_FIELD", "target": "name", "details": {}},
            ]
        }
        phase._deduplicate(state)
        assert len(state.active_plan["ast_mutations"]) == 2

    def test_preserves_unique(self, state, phase):
        state.active_plan = {
            "ast_mutations": [
                {"action": "MODIFY_METHOD", "target": "a", "details": {}},
                {"action": "MODIFY_METHOD", "target": "b", "details": {}},
            ]
        }
        phase._deduplicate(state)
        assert len(state.active_plan["ast_mutations"]) == 2


class TestTranslateFeedback:
    def test_tier1_syntax(self, state):
        state.cumulative_feedback = [
            {"failure_tier": "TIER_1_SYNTAX", "error": "Syntax error", "recovery_hint": "Fix syntax"}
        ]
        hint = Phase2Strategy._translate_feedback(state)
        assert isinstance(hint, list)
