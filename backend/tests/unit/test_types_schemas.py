"""Tests for Pydantic types and schemas — model validation."""

import pytest
from pydantic import ValidationError

from app.utils.schemas import IntentPacket, ScopeAnchor
from app.utils.types import HaltRequest, RefactorRequest


class TestRefactorRequest:
    def test_valid_request(self):
        req = RefactorRequest(type="multi", code="class A {}", user_instruction="refactor")
        assert req.code == "class A {}"

    def test_empty_code_rejected(self):
        with pytest.raises(ValidationError):
            RefactorRequest(type="multi", code="", user_instruction="refactor")

    def test_short_instruction_rejected(self):
        with pytest.raises(ValidationError):
            RefactorRequest(type="multi", code="class A {}", user_instruction="ab")


class TestIntentPacket:
    def test_valid_intent(self):
        packet = IntentPacket(
            refactor_category="CONTROL_FLOW",
            specific_intent="FLATTEN_CONDITIONAL",
            scope_anchor={"class": "A", "unit_type": "METHOD_UNIT"},
        )
        assert packet.specific_intent == "FLATTEN_CONDITIONAL"

    def test_invalid_category_rejected(self):
        with pytest.raises(ValidationError):
            IntentPacket(
                refactor_category="INVALID",
                specific_intent="FLATTEN_CONDITIONAL",
                scope_anchor={"class": "A", "unit_type": "METHOD_UNIT"},
            )

    def test_invalid_intent_rejected(self):
        with pytest.raises(ValidationError):
            IntentPacket(
                refactor_category="CONTROL_FLOW",
                specific_intent="NOT_A_REAL_INTENT",
                scope_anchor={"class": "A", "unit_type": "METHOD_UNIT"},
            )


class TestScopeAnchor:
    def test_optional_member_none(self):
        anchor = ScopeAnchor(class_name="A", member=None, unit_type="METHOD_UNIT")
        assert anchor.member is None


class TestHaltRequest:
    def test_valid_halt(self):
        req = HaltRequest(type="halt")
        assert req.type == "halt"
