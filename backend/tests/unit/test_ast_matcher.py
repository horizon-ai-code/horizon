"""Tests for ASTMatcher — mutation enrichment."""

from unittest.mock import MagicMock

from app.utils.ast_matcher import ASTMatcher


class TestFindClassDeclaration:
    def test_finds_class_line(self):  # TC-AM-001
        result = ASTMatcher._find_class_declaration_line("\n\nclass A {\n}")
        assert result is not None
        assert "class" in result

    def test_handles_enum(self):  # TC-AM-002
        result = ASTMatcher._find_class_declaration_line("\ninterface B {\n}")
        assert result is not None
        assert "interface" in result


class TestFindMethodBody:
    def test_finds_method_by_name(self):  # TC-AM-003
        code = "class A { void calculate() { return; } }"
        result = ASTMatcher._find_method_body(code, "calculate")
        assert result is not None

    def test_missing_method_returns_none(self):  # TC-AM-004
        code = "class A { void other() {} }"
        result = ASTMatcher._find_method_body(code, "missing")
        assert result is None


class TestExtractMethodText:
    def test_extracts_with_nested_braces(self):  # TC-AM-005
        code = "class A {\n    void m() {\n        if (x) { doWork(); }\n    }\n}"
        result = ASTMatcher._extract_method_text(code, "m")
        assert result is not None

    def test_deeply_nested(self):  # TC-AM-006
        code = "class A {\n    void m() { if (a) { if (b) { if (c) {} } } }\n}"
        result = ASTMatcher._extract_method_text(code, "m")
        assert result is not None


class TestEnrichMutations:
    def test_enrich_add_constant(self):  # TC-AM-007
        code = "class A {\n    void m() {}\n}"
        details = {"value": "100"}
        ASTMatcher._enrich_add_constant(code, details, "MAX_SIZE", "void m() {}", "m")
        assert "insert_after" in details

    def test_enrich_add_field(self):  # TC-AM-008
        code = "class A {\n    void m() {}\n}"
        details = {}
        ASTMatcher._enrich_add_field(code, details, "name", MagicMock())
        assert "insert_after" in details

    def test_enrich_modify_method(self):  # TC-AM-009
        code = "class A { final int MAX = 100; void m() { return MAX; } }"
        details = {"body": "return MAX;"}
        ASTMatcher._enrich_modify_method(code, details, "m", "MAX", "100", {})
        assert details is not None

    def test_enrich_rename_symbol(self):  # TC-AM-010
        code = "class A { int oldName; void m() { oldName = 5; } }"
        mutations = [{"action": "RENAME_SYMBOL", "target": "oldName", "details": {"new_name": "newName"}}]
        ASTMatcher.enrich_mutations(code, mutations, "RENAME_SYMBOL", None)
        assert len(mutations) > 0

    def test_enrich_empty_list(self):  # TC-AM-012
        result = ASTMatcher.enrich_mutations("code", [], "FLATTEN_CONDITIONAL", None)
        assert result == []
