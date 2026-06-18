"""Tests for judge structured issue types and override logic."""
import unittest

from pydantic import ValidationError

from app.utils.schemas import AuditIssue, AuditScratchpad, AuditTrace, StructuralAuditorResponse


class TestAuditIssue(unittest.TestCase):

    def test_valid_issue_types(self):
        for t in ["IDENTICAL_CODE", "LOGIC_DRIFT", "SEMANTIC_DRIFT"]:
            issue = AuditIssue(issue_type=t, description="test")
            self.assertEqual(issue.issue_type, t)

    def test_invalid_issue_type_raises(self):
        with self.assertRaises(ValidationError):
            AuditIssue(issue_type="INVALID_TYPE", description="test")

    def test_description_max_length(self):
        with self.assertRaises(ValidationError):
            AuditIssue(issue_type="IDENTICAL_CODE", description="x" * 101)

    def test_empty_description(self):
        issue = AuditIssue(issue_type="IDENTICAL_CODE", description="")
        self.assertEqual(issue.description, "")


class TestStructuralAuditorResponse(unittest.TestCase):

    def make_valid_response(self, verdict: str, issue_type: str = "IDENTICAL_CODE"):
        scratchpad = AuditScratchpad(
            variable_trace=[AuditTrace(original="a", refactored="b")],
            logic_comparison="same",
        )
        issues = [AuditIssue(issue_type=issue_type, description="test")]
        return StructuralAuditorResponse(
            audit_scratchpad=scratchpad,
            verdict=verdict,
            issues=issues,
        )

    def test_accept(self):
        r = self.make_valid_response("ACCEPT")
        self.assertEqual(r.verdict, "ACCEPT")
        self.assertEqual(len(r.issues), 1)

    def test_revise(self):
        r = self.make_valid_response("REVISE", "LOGIC_DRIFT")
        self.assertEqual(r.verdict, "REVISE")
        self.assertEqual(r.issues[0].issue_type, "LOGIC_DRIFT")

    def test_invalid_verdict_raises(self):
        with self.assertRaises(ValidationError):
            self.make_valid_response("APPROVE")

    def test_empty_issues(self):
        scratchpad = AuditScratchpad(logic_comparison="same")
        r = StructuralAuditorResponse(
            audit_scratchpad=scratchpad,
            verdict="ACCEPT",
            issues=[],
        )
        self.assertEqual(len(r.issues), 0)

    def test_issues_are_audit_issue_objects(self):
        scratchpad = AuditScratchpad(logic_comparison="check")
        r = StructuralAuditorResponse(
            audit_scratchpad=scratchpad,
            verdict="REVISE",
            issues=[
                AuditIssue(issue_type="IDENTICAL_CODE", description="identical"),
                AuditIssue(issue_type="SEMANTIC_DRIFT", description="behavior differs"),
            ],
        )
        self.assertEqual(len(r.issues), 2)
        self.assertEqual(r.issues[0].issue_type, "IDENTICAL_CODE")
        self.assertEqual(r.issues[1].issue_type, "SEMANTIC_DRIFT")

    def test_json_schema_includes_enum(self):
        schema = StructuralAuditorResponse.model_json_schema()
        defs = schema.get("$defs", schema.get("definitions", {}))
        # Find AuditIssue in defs
        issue_schema = defs.get("AuditIssue", {})
        if not issue_schema:
            issue_schema = schema["properties"]["issues"]["items"]
        issue_type_schema = issue_schema.get("properties", {}).get("issue_type", {})
        self.assertIn("enum", issue_type_schema)
        self.assertEqual(
            issue_type_schema["enum"],
            ["IDENTICAL_CODE", "LOGIC_DRIFT", "SEMANTIC_DRIFT"],
        )

    def test_model_validate_json(self):
        json_str = '''{
            "audit_scratchpad": {
                "variable_trace": [{"original": "x", "refactored": "y", "mapping": null}],
                "logic_comparison": "same"
            },
            "verdict": "REVISE",
            "issues": [{"issue_type": "IDENTICAL_CODE", "description": "no changes"}]
        }'''
        r = StructuralAuditorResponse.model_validate_json(json_str)
        self.assertEqual(r.verdict, "REVISE")
        self.assertEqual(r.issues[0].issue_type, "IDENTICAL_CODE")


class TestJudgeOverrideLogic(unittest.TestCase):
    """Test the structural-hash override logic that corrects judge hallucinations.

    Uses Validator.has_structural_change() instead of string comparison,
    so whitespace, comments, renames, and import changes don't trigger false overrides.
    """

    def setUp(self):
        from app.modules.validator import Validator
        self.validator = Validator()

    def test_identical_code_code_changed_should_override(self):
        """Judge says IDENTICAL_CODE but literal value changed — override."""
        base_code = "class A { int foo() { return 1; } }"
        working_code = "class A { int foo() { return 2; } }"
        self.assertTrue(self.validator.has_structural_change(base_code, working_code))

    def test_identical_code_code_unchanged_should_not_override(self):
        """Code is identical — no override."""
        base_code = "class A { int foo() { return 1; } }"
        working_code = base_code
        self.assertFalse(self.validator.has_structural_change(base_code, working_code))

    def test_logic_drift_no_override(self):
        """LOGIC_DRIFT is never overridden regardless of structural change.
        The override only fires for IDENTICAL_CODE — the orchestrator checks
        the issue type before calling has_structural_change."""
        base_code = "class A { int foo() { return 1; } }"
        working_code = "class A { int foo() { return 2; } }"
        self.assertTrue(self.validator.has_structural_change(base_code, working_code))
        # LOGIC_DRIFT would still not be overridden — the orchestrator's
        # condition `audit_res.issues[0].issue_type == "IDENTICAL_CODE"` would be False

    def test_rename_only_should_not_override(self):
        """Variable rename only — structural hash is identical, no override.
        This is the key improvement over string comparison."""
        base_code = "class A { int foo() { int x = 1; return x; } }"
        working_code = "class A { int foo() { int y = 1; return y; } }"
        self.assertFalse(self.validator.has_structural_change(base_code, working_code))

    def test_whitespace_change_should_not_override(self):
        """Whitespace-only change — structural hash is identical, no override."""
        base_code = "class A { int foo() { return 1; } }"
        working_code = "class A {   int foo() {\n    return 1;\n  } }"
        self.assertFalse(self.validator.has_structural_change(base_code, working_code))

    def test_import_change_should_not_override(self):
        """Import change only — structural hash is identical (imports stripped)."""
        base_code = "import java.util.List;\nclass A { int foo() { return 1; } }"
        working_code = "import java.util.ArrayList;\nclass A { int foo() { return 1; } }"
        self.assertFalse(self.validator.has_structural_change(base_code, working_code))

    def test_add_method_structural_change(self):
        """Adding a new method changes the AST structure — override should fire."""
        base_code = "class A { int foo() { return 1; } }"
        working_code = "class A { int foo() { return 1; } int bar() { return 2; } }"
        self.assertTrue(self.validator.has_structural_change(base_code, working_code))

    def test_syntax_error_fallback_to_string(self):
        """If either code has syntax errors, falls back to string comparison."""
        base_code = "class A { int foo() { return 1; } }"
        working_code = "this is not valid java"
        self.assertTrue(self.validator.has_structural_change(base_code, working_code))
        working_code = base_code
        self.assertFalse(self.validator.has_structural_change(base_code, working_code))


if __name__ == "__main__":
    unittest.main()
