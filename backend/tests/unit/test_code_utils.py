"""Tests for code_utils — wrapper stripping and mutation ordering."""

from app.utils.code_utils import order_mutations, strip_outer_wrapper
from app.utils.types import MutationAction


class TestStripOuterWrapper:
    def test_removes_fabricated_wrapper(self):
        generated = "public class Temp { void m() { return; } }"
        base = "void m() { return; }"
        result = strip_outer_wrapper(generated, base)
        assert "Temp" not in result

    def test_preserves_when_no_wrapper(self):
        code = "class A { void m() {} }"
        result = strip_outer_wrapper(code, code)
        assert result == code

    def test_class_body_only_unchanged(self):
        code = "class A { void m() {} }"
        result = strip_outer_wrapper(code, code)
        assert result == code


class TestOrderMutations:
    def test_rename_first(self):
        mutations = [
            {"action": MutationAction.MODIFY_METHOD, "target": "calc", "details": {}},
            {"action": MutationAction.RENAME_SYMBOL, "target": "old", "details": {}},
        ]
        result = order_mutations(mutations)
        assert result[0]["action"] == MutationAction.RENAME_SYMBOL

    def test_stable_within_group(self):
        mutations = [
            {"action": MutationAction.MODIFY_METHOD, "target": "a", "details": {}},
            {"action": MutationAction.MODIFY_METHOD, "target": "b", "details": {}},
        ]
        result = order_mutations(mutations)
        assert result[0]["target"] == "a"
        assert result[1]["target"] == "b"

    def test_add_before_modify(self):
        mutations = [
            {"action": MutationAction.REMOVE_METHOD, "target": "old", "details": {}},
            {"action": MutationAction.ADD_DECLARATION, "target": "tmp", "details": {}},
            {"action": MutationAction.MODIFY_METHOD, "target": "calc", "details": {}},
        ]
        result = order_mutations(mutations)
        actions = [m["action"] for m in result]
        add_idx = actions.index(MutationAction.ADD_DECLARATION)
        modify_idx = actions.index(MutationAction.MODIFY_METHOD)
        remove_idx = actions.index(MutationAction.REMOVE_METHOD)
        assert add_idx < modify_idx
        assert add_idx < remove_idx
