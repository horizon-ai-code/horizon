"""Tests for Orchestrator._repair_generator_output."""
import unittest
from app.modules.orchestrator import Orchestrator


class TestRepairGeneratorOutput(unittest.TestCase):
    """Validates the regex/line-based Java output repair logic."""

    def setUp(self):
        self.repair = Orchestrator._repair_generator_output

    def test_unchanged_code_passes_through(self):
        code = "class A { void m() { return 1; } }"
        self.assertEqual(self.repair(code, code), code)

    def test_strips_extra_throws(self):
        orig = "class A { void m() { } }"
        gen = "class A { void m() throws IOException { } }"
        result = self.repair(orig, gen)
        self.assertNotIn("throws", result)

    def test_strips_extra_null_checks(self):
        orig = "class A { void m() { return x; } }"
        gen = "class A { void m() { if (x == null) return null; return x; } }"
        result = self.repair(orig, gen)
        self.assertNotIn("if (x == null)", result)

    def test_preserves_existing_null_checks(self):
        orig = "class A { void m() { if (x == null) return; doWork(); } }"
        gen = "class A { void m() { if (x == null) return; doWork(); extraWork(); } }"
        result = self.repair(orig, gen)
        self.assertIn("if (x == null)", result)
        self.assertIn("doWork()", result)
        self.assertIn("extraWork()", result)

    def test_does_not_remove_code_around_no_brace_null_check(self):
        """No-brace null check should not eat subsequent statements."""
        orig = "class A { void m() { return; } }"
        gen = "class A { void m() { if (x == null) return; doWork(); } }"
        result = self.repair(orig, gen)
        self.assertIn("doWork()", result)

    def test_strips_extra_public_modifier(self):
        orig = "class A { void m() { } }"
        gen = "class A { public void m() { } }"
        result = self.repair(orig, gen)
        self.assertNotIn("public", result)

    def test_preserves_existing_public_modifier(self):
        orig = "class A { public void m() { } }"
        gen = "class A { public void m() { return 1; } }"
        result = self.repair(orig, gen)
        self.assertIn("public void m()", result)
