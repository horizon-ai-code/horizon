"""Tests for Phase 2 — Strategy (deduplicate, translate_feedback)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase2_strategy import Phase2Strategy


@pytest.fixture
def state():
    return OrchestrationState(
        session_id="t", base_code="class A {}", working_code="class A {}", user_instruction="flatten"
    )


@pytest.fixture
def phase():
    agent = AsyncMock()
    config = MagicMock()
    config.orchestration = MagicMock()
    config.orchestration.deduplication_cap = 5
    prompts = {}
    notify = AsyncMock()
    return Phase2Strategy(agent, config, prompts, notify)


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
