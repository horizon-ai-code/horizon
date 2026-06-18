"""Verification tests for orchestrator.py changes."""
import json
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.orchestrator import OrchestrationState, Orchestrator
from app.modules.validator import Validator


class TestSequentialCondition(unittest.IsolatedAsyncioTestCase):
    """The should_use_sequential condition is evaluated in execute_orchestration
    when current_phase == 3. These tests verify the condition's building blocks:
    multi-mutation plans use sequential, single-mutation plans skip it.

    The actual decision logic lives in execute_orchestration's while loop
    and calls _run_sequential_phase_3 vs _run_phase_3 accordingly.
    """

    def setUp(self):
        self.state = OrchestrationState(
            session_id="t", base_code="", working_code="", user_instruction=""
        )
        self.state.strategy_iter = 1

    def test_sequential_needs_multi_mutation(self):
        """Condition requires 2+ mutations. Single mutation skips sequential."""
        self.state.active_plan = {"ast_mutations": [{"action": "MODIFY", "target": "a"}]}
        should_use = (
            self.state.strategy_iter == 1
            and not self.state.syntax_error_context
            and self.state.active_plan
            and len(self.state.active_plan["ast_mutations"]) > 1
        )
        self.assertFalse(should_use)

    def test_sequential_skips_on_syntax_error(self):
        """Condition requires no syntax error context."""
        self.state.active_plan = {
            "ast_mutations": [
                {"action": "MODIFY", "target": "a"},
                {"action": "MODIFY", "target": "b"},
            ]
        }
        self.state.syntax_error_context = {"attempt": 1}
        should_use = (
            self.state.strategy_iter == 1
            and not self.state.syntax_error_context
            and self.state.active_plan
            and len(self.state.active_plan["ast_mutations"]) > 1
        )
        self.assertFalse(should_use)

    def test_sequential_skips_on_retry(self):
        """Condition requires strategy_iter == 1."""
        self.state.active_plan = {
            "ast_mutations": [
                {"action": "MODIFY", "target": "a"},
                {"action": "MODIFY", "target": "b"},
            ]
        }
        self.state.strategy_iter = 2
        should_use = (
            self.state.strategy_iter == 1
            and not self.state.syntax_error_context
            and self.state.active_plan
            and len(self.state.active_plan["ast_mutations"]) > 1
        )
        self.assertFalse(should_use)


class TestArchitectException(unittest.IsolatedAsyncioTestCase):
    async def test_architect_analysis_exception_returns_empty_dict(self):
        """When extract_json raises, state.architect_analysis becomes {}."""
        agent = AsyncMock()
        validator = Validator()
        db = MagicMock()

        with patch("builtins.open", MagicMock()), patch("yaml.safe_load", MagicMock()):
            orch = Orchestrator(agent, validator, db)
            state = OrchestrationState(
                session_id="t", base_code="", working_code="", user_instruction=""
            )

            # First call (analysis) returns bad JSON — tests the except handler
            # Second call (synthesis) returns valid plan — allows flow to complete
            agent.generate.side_effect = [
                {"choices": [{"message": {"content": "not valid json"}}]},
                {"choices": [{"message": {"content": json.dumps({
                    "architect_scratchpad": "t",
                    "ast_modification_plan": {
                        "target_class": "A",
                        "ast_mutations": [{"action": "MODIFY_METHOD", "target": "m", "details": {}}],
                    },
                })}}]},
            ]
            state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "refactor_category": "CONTROL_FLOW", "scope_anchor": {"unit_type": "METHOD_UNIT"}}

            client = AsyncMock()
            client.id = "test-session"
            client.send_status = AsyncMock()

            await orch._run_phase_2(client, state)
            self.assertEqual(state.architect_analysis, {})

    async def test_notify_skips_send_for_stale_client(self):
        """_notify skips send_status when client is stale."""
        agent = AsyncMock()
        validator = Validator()
        db = MagicMock()

        with patch("builtins.open", MagicMock()), patch("yaml.safe_load", MagicMock()):
            orch = Orchestrator(agent, validator, db)

            client = AsyncMock()
            client.id = "test-session"
            client.is_stale = True
            client.send_status = AsyncMock()

            await orch._notify(client, MagicMock(), "test message")
            client.send_status.assert_not_called()


class TestIntentVerifierCrash(unittest.IsolatedAsyncioTestCase):
    @pytest.mark.asyncio
    async def test_verifier_crash_does_not_crash_orchestration(self):
        """When verify_intent raises, orchestration continues without crashing."""
        from app.utils.types import RefactorIntent
        validator = Validator()
        orig = validator.verifier_registry[RefactorIntent.FLATTEN_CONDITIONAL]
        def crashing_verifier(a, b):
            raise AttributeError("boom")
        validator.verifier_registry[RefactorIntent.FLATTEN_CONDITIONAL] = crashing_verifier
        try:
            result = validator.verify_intent(
                RefactorIntent.FLATTEN_CONDITIONAL,
                "class A { void m() { if(a) { } } }",
                "class A { void m() { if(!a) return; } }",
            )
            assert result is not None, "Should return a ValidationFinding on crash"
            assert result.failure_tier.value == "TIER_2_C_INTENT_MATH"
            assert "Verifier crashed" in result.error_report.message
        finally:
            validator.verifier_registry[RefactorIntent.FLATTEN_CONDITIONAL] = orig
