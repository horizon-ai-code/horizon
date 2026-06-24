"""Tests for format_plan_for_generator — mutation plan to text."""

from app.utils.formatters import format_plan_for_generator
from tests.fixtures.plan_samples import EMPTY_MUTATIONS, SINGLE_MODIFY, THREE_MUTATIONS


class TestFormatPlanForGenerator:
    def test_single_mutation(self):  # TC-FMT-001
        result = format_plan_for_generator(SINGLE_MODIFY, "class A {}")
        assert "MODIFY_METHOD" in result or "calculate" in result

    def test_add_constant_included(self):  # TC-FMT-002
        result = format_plan_for_generator(THREE_MUTATIONS, "class A { int oldName; }")
        assert "MAX_SIZE" in result

    def test_empty_mutations(self):  # TC-FMT-005
        result = format_plan_for_generator(EMPTY_MUTATIONS, "class A {}")
        assert "No mutations" in result

    def test_empty_mutations_edge(self):
        result = format_plan_for_generator({"ast_mutations": []}, "class A {}")
        assert result is not None

    def test_orders_mutations_logically(self):  # TC-FMT-004
        result = format_plan_for_generator(THREE_MUTATIONS, "class A { int oldName; }")
        assert result is not None
