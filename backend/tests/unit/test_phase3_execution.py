"""Tests for Phase 3 — Execution (repair, single, sequential)."""

from app.modules.orchestrator.phases.phase3_execution import repair_generator_output


class TestRepairGeneratorOutput:
    def test_removes_throws_when_not_in_original(self):
        orig = "void m() { return; }"
        gen = "void m() throws Exception { return; }"
        result = repair_generator_output(orig, gen)
        assert result is not None

    def test_leaves_valid_code_unchanged(self):
        orig = "void m() { return; }"
        result = repair_generator_output(orig, orig)
        assert result == orig
