"""Tests for ASTMatcher — mutation enrichment with concrete find/replace."""

from app.utils.ast_matcher import ASTMatcher


class TestFindClassDeclaration:
    def test_finds_class_line(self):
        code = "\n\nclass A {\n}"
        result = ASTMatcher._find_class_declaration_line(code)
        assert result is not None
        assert "class" in result

    def test_handles_enum(self):
        code = "\ninterface B {\n}"
        result = ASTMatcher._find_class_declaration_line(code)
        assert result is not None
        assert "interface" in result


class TestFindMethodBody:
    def test_finds_method_by_name(self):
        code = "class A { void calculate() { return; } }"
        result = ASTMatcher._find_method_body(code, "calculate")
        assert result is not None

    def test_missing_method_returns_none(self):
        code = "class A { void other() {} }"
        result = ASTMatcher._find_method_body(code, "missing")
        assert result is None


class TestExtractMethodText:
    def test_extracts_with_nested_braces(self):
        code = """class A {
    void m() {
        if (x) {
            doWork();
        }
    }
}"""
        result = ASTMatcher._extract_method_text(code, "m")
        assert result is not None
        assert "if" in result

    def test_deeply_nested(self):
        code = """class A {
    void m() {
        if (a) { if (b) { if (c) { if (d) { if (e) {} } } } }
    }
}"""
        result = ASTMatcher._extract_method_text(code, "m")
        assert result is not None


class TestEnrichMutations:
    def test_enrich_add_constant(self):
        code = "class A {\n    void m() {}\n}"
        details = {"value": "100"}
        ASTMatcher._enrich_add_constant(code, details, "MAX_SIZE", "void m() {}", "m")
        assert "insert_after" in details

    def test_enrich_mutations_empty_list(self):
        result = ASTMatcher.enrich_mutations("code", [], "FLATTEN_CONDITIONAL", None)
        assert result == []
