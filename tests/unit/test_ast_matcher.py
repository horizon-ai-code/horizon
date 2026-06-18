import unittest

from app.utils.ast_matcher import ASTMatcher


class TestASTMatcher(unittest.TestCase):
    def test_enrich_mutations_flatten(self):
        code = "public class A { void m() { if(a) { if(b) {} } } }"
        mutations = [{"action": "MODIFY_METHOD", "target": "m"}]
        result = ASTMatcher.enrich_mutations(
            code, mutations, intent="FLATTEN_CONDITIONAL", target_method="m"
        )
        self.assertEqual(len(result), 1)
        self.assertIn("details", result[0])

    def test_enrich_mutations_add_constant(self):
        code = "public class A { void m() { int x = 10000; } }"
        mutations = [
            {"action": "ADD_CONSTANT", "target": "MAX_SIZE", "details": {"value": "10000"}},
            {"action": "MODIFY_METHOD", "target": "m", "details": {}},
        ]
        result = ASTMatcher.enrich_mutations(
            code, mutations, intent="EXTRACT_CONSTANT", target_method="m"
        )
        add_const = result[0]
        self.assertEqual(add_const["details"].get("value"), "10000")
        self.assertIsNotNone(add_const["details"].get("insert_after"))

    def test_enrich_mutations_rename_symbol(self):
        code = "public class A { void oldName() {} }"
        mutations = [
            {"action": "RENAME_SYMBOL", "target": "oldName",
             "details": {"body_abstract": "Rename oldName to newName"}},
        ]
        result = ASTMatcher.enrich_mutations(code, mutations)
        details = result[0].get("details", {})
        self.assertEqual(details.get("find_text"), "oldName")
        self.assertEqual(details.get("replace_text"), "newName")

    def test_enrich_mutations_empty_list(self):
        result = ASTMatcher.enrich_mutations("public class A {}", [])
        self.assertEqual(result, [])

    def test_find_method_body_exists(self):
        code = "public class A { void testMethod() { int x = 1; } }"
        body = ASTMatcher._find_method_body(code, "testMethod")
        self.assertIsNotNone(body)
        self.assertIn("testMethod", body)

    def test_find_method_body_missing(self):
        code = "public class A { void methodA() {} }"
        body = ASTMatcher._find_method_body(code, "methodB")
        self.assertIsNone(body)

    def test_find_class_declaration_line(self):
        code = "public class MyClass {\n    void m() {}\n}"
        line = ASTMatcher._find_class_declaration_line(code)
        self.assertIsNotNone(line)
        self.assertIn("class", line)
