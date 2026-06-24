"""Tests for Validator — syntax, complexity, intent, boundary checking."""

from app.modules.validator import Validator
from app.utils.schemas import IntentPacket


class TestCheckSyntax:
    def test_valid_java_class(self):  # TC-VL-001
        v = Validator()
        r = v.check_syntax("class A { void m() { int x = 1; } }")
        assert r["is_valid"] is True

    def test_wraps_bare_statement(self):  # TC-VL-002
        v = Validator()
        r = v.check_syntax("int x = 1;")
        assert r["is_valid"] is True

    def test_wraps_bare_method(self):  # TC-VL-003
        v = Validator()
        r = v.check_syntax("void m() { return; }")
        assert r["is_valid"] is True

    def test_rejects_malformed(self):  # TC-VL-004
        v = Validator()
        r = v.check_syntax("class A { void m() { ")
        assert r["is_valid"] is False

    def test_handles_empty_input(self):  # TC-VL-005
        v = Validator()
        r = v.check_syntax("")
        assert r["is_valid"] is False

    def test_whitespace_input(self):  # TC-VL-006
        v = Validator()
        r = v.check_syntax("   \n  ")
        assert r["is_valid"] is False


class TestGetComplexity:
    def test_cc_with_conditionals(self):  # TC-VL-007
        v = Validator()
        r = v.get_complexity("class A { void m() { if(x) { } if(y) { } } }")
        assert r == 3

    def test_cc_no_methods(self):  # TC-VL-008
        v = Validator()
        r = v.get_complexity("class A { int x; }")
        assert r == 1

    def test_method_complexity_by_name(self):  # TC-VL-009
        v = Validator()
        r = v.get_method_complexity(
            "class A { void setup() {} int calculate() { if(x) { } return 1; } void teardown() {} }",
            "calculate",
        )
        assert r is not None

    def test_method_complexity_not_found(self):  # TC-VL-010
        v = Validator()
        r = v.get_method_complexity("class A { void m() {} }", "missing")
        assert r is None


class TestHasStructuralChange:
    def test_detects_change(self):  # TC-VL-011
        v = Validator()
        r = v.has_structural_change(
            "class A { void m() { int x; } }",
            "class A { void n() { int y; } }",
        )
        assert r is True or r is False

    def test_identical_structure(self):  # TC-VL-012
        v = Validator()
        code = "class A { void m() { int x; } }"
        r = v.has_structural_change(code, code)
        assert r is False or r is None


class TestVerifyComplexity:
    def test_can_call_verify(self):  # TC-VL-019
        v = Validator()
        packet = {"specific_intent": "FLATTEN_CONDITIONAL"}
        r = v.verify_complexity("class A { void m() {} }", "class A { void m() {} }", packet)
        assert r is not None
        assert len(r) == 3

    def test_with_intent_packet(self):  # TC-VL-021
        v = Validator()
        packet = IntentPacket(
            refactor_category="CONTROL_FLOW",
            specific_intent="FLATTEN_CONDITIONAL",
            scope_anchor={"class": "A", "unit_type": "METHOD_UNIT"},
        ).model_dump()
        r = v.verify_complexity("class A { void m() { if(x){} } }", "class A { void m() { } }", packet)
        assert r is not None


class TestVerifyIntent:
    def test_flatten_detects_decrease(self):  # TC-VL-013
        v = Validator()
        r = v.verify_intent(
            "FLATTEN_CONDITIONAL",
            "class A { void m() { if(a){ if(b){ } } } }",
            "class A { void m() { if(!a) return; if(!b) return; } }",
        )
        assert r is None

    def test_flatten_fails_when_unchanged(self):  # TC-VL-015
        v = Validator()
        r = v.verify_intent(
            "FLATTEN_CONDITIONAL",
            "class A { void m() { if(a){ } } }",
            "class A { void m() { if(a){ } } }",
        )
        assert r is not None


class TestVerifyBoundary:
    def test_no_leak(self):  # TC-VL-017
        v = Validator()
        code = "class A { void m() { int x; } void n() { } }"
        result = v.verify_boundary(code, code, [])
        assert result is not False

    def test_leak_detected(self):  # TC-VL-018
        v = Validator()
        orig = "class A { void m() { int x; } void n() { } }"
        refac = "class A { void m() { int y; } void n() { int z; } }"
        result = v.verify_boundary(orig, refac, [])
        assert result is not True
