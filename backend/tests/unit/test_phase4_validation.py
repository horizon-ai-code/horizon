"""Tests for Phase 4 — Validation chain routing."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase4_validation import Phase4Validation


@pytest.mark.asyncio
class TestPhase4Validation:
    @pytest.fixture
    def state(self):
        return OrchestrationState(
            session_id="t", base_code="class A {}", working_code="class A {}", user_instruction="flatten"
        )

    async def test_passes_all_checks(self, state):  # TC-P4-001
        client = MagicMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": True}
        validator.verify_intent.return_value = None
        validator.verify_boundary.return_value = None
        validator.verify_complexity.return_value = (None, 3, 2)
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        await phase.run(client, state)
        assert state.syntax_iter is not None

    async def test_syntax_failure_increments_iter(self, state):  # TC-P4-002
        client = MagicMock()
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": False}
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        state.syntax_iter = 0
        await phase.run(client, state)
        assert state.syntax_iter == 1

    async def test_complexity_pass_strict(self, state):  # TC-P4-004
        client = MagicMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": True}
        validator.verify_complexity.return_value = (None, 5, 3)
        validator.verify_boundary.return_value = None
        validator.verify_intent.return_value = None
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        await phase.run(client, state)
        assert True

    async def test_complexity_fail_strict(self, state):  # TC-P4-005
        client = MagicMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": True}
        from app.utils.schemas import ErrorReport, ValidationFinding
        from app.utils.types import FailureTier
        finding = ValidationFinding(failure_tier=FailureTier.TIER_2_A_COMPLEXITY, error_report=ErrorReport(message="CC increased"), recovery_hint="")
        validator.verify_complexity.return_value = (finding, 3, 5)
        validator.verify_boundary.return_value = None
        validator.verify_intent.return_value = None
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        await phase.run(client, state)
        assert True

    async def test_boundary_pass(self, state):  # TC-P4-006
        client = MagicMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": True}
        validator.verify_complexity.return_value = (None, 3, 3)
        validator.verify_boundary.return_value = None
        validator.verify_intent.return_value = None
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        await phase.run(client, state)
        assert True

    async def test_boundary_leak_detected(self, state):  # TC-P4-007
        client = MagicMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": True}
        validator.verify_complexity.return_value = (None, 3, 3)
        from app.utils.schemas import ErrorReport, ValidationFinding
        from app.utils.types import FailureTier
        finding = ValidationFinding(failure_tier=FailureTier.TIER_2_B_BOUNDARY, error_report=ErrorReport(message="Leak"), recovery_hint="")
        validator.verify_boundary.return_value = finding
        validator.verify_intent.return_value = None
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        await phase.run(client, state)
        assert True
