import unittest

from app.modules.validator import ASTWalker, RefactorVerifier, Validator


class TestValidatorNew(unittest.TestCase):
    def setUp(self):
        self.validator = Validator()

    def test_syntax_check_valid(self):
        code = "public class A { void m() { int x = 1; } }"
        res = self.validator.check_syntax(code)
        self.assertTrue(res["is_valid"])
        self.assertIsNotNone(res["ast"])

    def test_ast_walker_serialization(self):
        code = "int x = 5;"
        res = self.validator.check_syntax(code)
        serialized = ASTWalker.serialize_node(res["ast"])
        self.assertIsInstance(serialized, dict)
        self.assertEqual(serialized["node_type"], "CompilationUnit")

    def test_verify_flatten_conditional_success(self):
        orig = "void m() { if(a) { if(b) { doSomething(); } } }"
        refac = "void m() { if(a && b) { doSomething(); } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]

        success, msg = RefactorVerifier.verify_flatten_conditional(orig_ast, refac_ast)
        self.assertTrue(success)
        self.assertIn("decreased", msg)

    def test_verify_extract_method_success(self):
        orig = "class A { void m() { int x = 1; } }"
        refac = "class A { void m() { helper(); } void helper() { int x = 1; } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]

        success, msg = RefactorVerifier.verify_extract_method(orig_ast, refac_ast)
        self.assertTrue(success)
        self.assertIn("increased", msg)

    def test_verify_boundary_violation(self):
        orig = "class A { void target() {} void other() { int x = 1; } }"
        # Refactor target but accidentally change other()
        refac = (
            "class A { void target() { \n // done \n } void other() { int y = 2; } }"
        )

        finding = self.validator.verify_boundary(orig, refac, ["target"])
        self.assertIsNotNone(finding)
        self.assertIn("Boundary Violation", finding.error_report.message)  # type: ignore

    def test_verify_decompose_conditional(self):
        orig = "class A { void m() { if(a && b || c) { doSomething(); } } }"
        refac = "class A { void m() { boolean cond = a && b || c; if(cond) { doSomething(); } } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_decompose_conditional(
            orig_ast, refac_ast
        )
        self.assertTrue(success)

    def test_verify_consolidate_conditional(self):
        orig = "class A { void m() { if(a) { doX(); } else if(b) { doX(); } } }"
        refac = "class A { void m() { if(a || b) { doX(); } } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_consolidate_conditional(
            orig_ast, refac_ast
        )
        self.assertTrue(success)

    def test_verify_remove_control_flag(self):
        orig = "class A { void m() { boolean flag = true; for(int i=0; i<10; i++) { if(i==5) flag=false; if(flag) { doX(); } } } }"
        refac = "class A { void m() { for(int i=0; i<10; i++) { if(i==5) break; doX(); } } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_remove_control_flag(orig_ast, refac_ast)
        self.assertTrue(success)

    def test_verify_replace_loop_with_pipeline(self):
        orig = (
            "class A { void m(List<String> list) { for(String s : list) { doX(s); } } }"
        )
        refac = "class A { void m(List<String> list) { list.stream().forEach(this::doX); } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_replace_loop_with_pipeline(
            orig_ast, refac_ast
        )
        self.assertTrue(success)

    def test_verify_split_loop(self):
        orig = "class A { void m() { for(int i=0; i<10; i++) { doX(); doY(); } } }"
        refac = "class A { void m() { for(int i=0; i<10; i++) { doX(); } for(int i=0; i<10; i++) { doY(); } } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_split_loop(orig_ast, refac_ast)
        self.assertTrue(success)

    def test_verify_inline_method(self):
        orig = "class A { void m() { helper(); } void helper() { doX(); } }"
        refac = "class A { void m() { doX(); } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_inline_method(orig_ast, refac_ast)
        self.assertTrue(success)

    def test_verify_extract_variable(self):
        orig = "class A { void m() { doX(a.b.c()); } }"
        refac = "class A { void m() { Object val = a.b.c(); doX(val); } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_extract_variable(orig_ast, refac_ast)
        self.assertTrue(success)

    def test_verify_inline_variable(self):
        orig = "class A { void m() { Object val = a.b.c(); doX(val); } }"
        refac = "class A { void m() { doX(a.b.c()); } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_inline_variable(orig_ast, refac_ast)
        self.assertTrue(success)

    def test_verify_extract_constant(self):
        orig = "class A { void m() { double a = 3.14 * 2 * 2; } }"
        refac = "class A { static final double PI = 3.14; void m() { double a = PI * 2 * 2; } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_extract_constant(orig_ast, refac_ast)
        self.assertTrue(success)

    def test_verify_rename_symbol(self):
        orig = "class A { void foo() { int x = 1; } }"
        refac = "class A { void bar() { int y = 1; } }"
        orig_ast = self.validator.check_syntax(orig)["ast"]
        refac_ast = self.validator.check_syntax(refac)["ast"]
        success, msg = RefactorVerifier.verify_rename_symbol(orig_ast, refac_ast)
        self.assertTrue(success)


if __name__ == "__main__":
    unittest.main()
