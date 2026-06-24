"""Tests for Orchestrator — state management."""

from app.modules.orchestrator import OrchestrationState


class TestOrchestrationState:
    def test_initial_defaults(self):
        state = OrchestrationState(
            session_id="t", base_code="class A {}", working_code="class A {}", user_instruction="refactor"
        )
        assert state.strategy_iter == 1
        assert state.cumulative_feedback == []
        assert state.exit_status == "PROCESSING"

    def test_add_feedback_appends(self):
        state = OrchestrationState(
            session_id="t", base_code="", working_code="", user_instruction=""
        )
        state.add_feedback("hint 1")
        assert len(state.cumulative_feedback) == 1

    def test_extend_feedback(self):
        state = OrchestrationState(
            session_id="t", base_code="", working_code="", user_instruction=""
        )
        state.extend_feedback(["a", "b", "c"])
        assert len(state.cumulative_feedback) == 3
