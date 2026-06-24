"""Tests for Phase 4 — Validation chain."""

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

    async def test_run_with_mocked_validator(self, state):
        client = MagicMock()
        state.intent_packet = {"specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"target_class": "A"}}
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": True}
        validator.verify_intent.return_value = None
        validator.verify_boundary.return_value = None
        validator.verify_complexity.return_value = (None, 1, 1)
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        await phase.run(client, state)
        assert state.syntax_iter is not None

    async def test_syntax_failure_routes_to_heal(self, state):
        client = MagicMock()
        validator = MagicMock()
        validator.check_syntax.return_value = {"is_valid": False}
        notify = AsyncMock()
        phase = Phase4Validation(validator, notify)
        state.syntax_iter = 0
        await phase.run(client, state)
        assert state.syntax_iter == 1
