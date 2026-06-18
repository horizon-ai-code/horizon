"""Tests for Orchestrator pure-logic static methods."""
import unittest

from app.modules.orchestrator import Orchestrator
from app.utils.types import RefactorIntent


class TestCCRules(unittest.TestCase):
    def test_all_intents_have_rules(self):
        expected_intents = {
            RefactorIntent.FLATTEN_CONDITIONAL,
            RefactorIntent.DECOMPOSE_CONDITIONAL,
            RefactorIntent.CONSOLIDATE_CONDITIONAL,
            RefactorIntent.REMOVE_CONTROL_FLAG,
            RefactorIntent.REPLACE_LOOP_WITH_PIPELINE,
            RefactorIntent.SPLIT_LOOP,
            RefactorIntent.EXTRACT_METHOD,
            RefactorIntent.INLINE_METHOD,
            RefactorIntent.EXTRACT_VARIABLE,
            RefactorIntent.INLINE_VARIABLE,
            RefactorIntent.EXTRACT_CONSTANT,
            RefactorIntent.RENAME_SYMBOL,
        }
        self.assertEqual(set(Orchestrator.CC_RULES.keys()), expected_intents)

    def test_get_cc_rule_returns_correct_rules(self):
        cases = [
            (RefactorIntent.FLATTEN_CONDITIONAL, "LOOSENED"),
            (RefactorIntent.DECOMPOSE_CONDITIONAL, "EXTRACT_RULE"),
            (RefactorIntent.CONSOLIDATE_CONDITIONAL, "STRICT"),
            (RefactorIntent.REMOVE_CONTROL_FLAG, "STRICT"),
            (RefactorIntent.REPLACE_LOOP_WITH_PIPELINE, "STRICT"),
            (RefactorIntent.SPLIT_LOOP, "LOOSENED"),
            (RefactorIntent.EXTRACT_METHOD, "EXTRACT_RULE"),
            (RefactorIntent.INLINE_METHOD, "SKIP"),
            (RefactorIntent.EXTRACT_VARIABLE, "STRICT"),
            (RefactorIntent.INLINE_VARIABLE, "STRICT"),
            (RefactorIntent.EXTRACT_CONSTANT, "STRICT"),
            (RefactorIntent.RENAME_SYMBOL, "STRICT"),
        ]
        for intent, expected in cases:
            with self.subTest(intent=intent):
                self.assertEqual(Orchestrator._get_cc_rule(intent), expected)

    def test_get_cc_rule_defaults_to_strict(self):
        self.assertEqual(Orchestrator._get_cc_rule("UNKNOWN_INTENT"), "STRICT")


class TestOrderMutations(unittest.TestCase):
    def test_rename_first(self):
        mutations = [
            {"action": "MODIFY_METHOD", "target": "bar"},
            {"action": "RENAME_SYMBOL", "target": "baz"},
            {"action": "ADD_METHOD", "target": "qux"},
        ]
        ordered = Orchestrator._order_mutations(mutations)
        self.assertEqual(ordered[0]["action"], "RENAME_SYMBOL")

    def test_add_before_modify(self):
        mutations = [
            {"action": "MODIFY_METHOD", "target": "bar"},
            {"action": "ADD_METHOD", "target": "new_method"},
        ]
        ordered = Orchestrator._order_mutations(mutations)
        self.assertEqual(ordered[0]["action"], "ADD_METHOD")

    def test_unknown_action_last(self):
        mutations = [
            {"action": "UNKNOWN", "target": "x"},
            {"action": "RENAME_SYMBOL", "target": "y"},
        ]
        ordered = Orchestrator._order_mutations(mutations)
        self.assertEqual(ordered[0]["action"], "RENAME_SYMBOL")

    def test_split_body_treated_as_add(self):
        mutations = [
            {"action": "MODIFY_METHOD", "target": "bar"},
            {"action": "SPLIT_BODY", "target": "baz"},
        ]
        ordered = Orchestrator._order_mutations(mutations)
        self.assertEqual(ordered[0]["action"], "SPLIT_BODY")


class TestStripOuterWrapper(unittest.TestCase):
    def setUp(self):
        self.strip = Orchestrator._strip_outer_wrapper

    def test_strips_class_wrapper_when_base_has_no_class(self):
        base = "void m() { return 1; }"
        code = "class Wrapper { void m() { return 1; } }"
        result = self.strip(code, base)
        self.assertIn("void m()", result)
        self.assertNotIn("class Wrapper", result)

    def test_returns_code_when_base_has_class(self):
        base = "class Base { void m() { } }"
        code = "class Base { void m() { return 1; } }"
        result = self.strip(code, base)
        self.assertEqual(result, code)

    def test_no_wrapper_class_passes_through(self):
        base = "void m() { return 0; }"
        result = self.strip(base, base)
        self.assertEqual(result, base)

    def test_preserves_inner_content(self):
        base = "int x; int y;"
        code = "class _W_ { int x; int y; }"
        result = self.strip(code, base)
        self.assertIn("int x;", result)
        self.assertIn("int y;", result)


if __name__ == "__main__":
    unittest.main()
