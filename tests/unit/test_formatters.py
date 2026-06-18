import unittest

from app.utils.formatters import format_plan_for_generator


class TestFormatters(unittest.TestCase):

    # ---- format_plan_for_generator tests ----

    def test_plan_empty_mutations(self):
        plan = {"target_class": "A", "ast_mutations": []}
        result = format_plan_for_generator(plan, "class A { }")
        self.assertIn("Base Code:", result)
        self.assertIn("No mutations to apply", result)
        self.assertIn("<code>class A { }</code>", result)

    def test_plan_single_mutation(self):
        plan = {
            "target_class": "A",
            "ast_mutations": [
                {
                    "action": "MODIFY_METHOD",
                    "target": "calc",
                    "details": {
                        "modifiers": ["public"],
                        "type": "double",
                        "parameters": [],
                        "logic_changes": ["Replace literal with constant"],
                        "body_abstract": "Use PI instead of 3.14159",
                    },
                }
            ],
        }
        result = format_plan_for_generator(plan, "class A { double calc() { return 3.14159; } }")
        self.assertIn("1. MODIFY_METHOD calc", result)
        self.assertIn("- Modifiers: public", result)
        self.assertIn("- Returns: double", result)
        self.assertIn("- Change: Replace literal with constant", result)
        self.assertIn("- Body: Use PI instead of 3.14159", result)
        self.assertIn("VERIFY before outputting:", result)
        self.assertIn("(1 total)", result)

    def test_plan_multiple_mutations(self):
        plan = {
            "target_class": "Circle",
            "ast_mutations": [
                {
                    "action": "ADD_CONSTANT",
                    "target": "PI",
                    "details": {
                        "modifiers": ["static", "final"],
                        "type": "double",
                        "parameters": [],
                        "logic_changes": [],
                        "body_abstract": "Declare PI = 3.14159",
                    },
                },
                {
                    "action": "MODIFY_METHOD",
                    "target": "calculateArea",
                    "details": {
                        "modifiers": ["public"],
                        "type": "",
                        "parameters": [],
                        "logic_changes": ["Replace 3.14159 with PI"],
                        "body_abstract": "Replace literal with PI",
                    },
                },
                {
                    "action": "MODIFY_METHOD",
                    "target": "calculateCircumference",
                    "details": {
                        "modifiers": ["public"],
                        "type": "",
                        "parameters": [],
                        "logic_changes": ["Replace 3.14159 with PI"],
                        "body_abstract": "Replace literal with PI",
                    },
                },
            ],
        }
        result = format_plan_for_generator(plan, "class Circle { ... }")
        self.assertIn("(3 total)", result)
        self.assertIn("1. ADD_CONSTANT PI", result)
        self.assertIn("2. MODIFY_METHOD calculateArea", result)
        self.assertIn("3. MODIFY_METHOD calculateCircumference", result)
        self.assertIn("- Modifiers: static final", result)

    def test_plan_with_parameters(self):
        plan = {
            "target_class": "Calc",
            "ast_mutations": [
                {
                    "action": "ADD_METHOD",
                    "target": "helper",
                    "details": {
                        "modifiers": ["private"],
                        "type": "double",
                        "parameters": [
                            {"type": "double", "name": "subtotal"},
                            {"type": "double", "name": "taxRate"},
                        ],
                        "logic_changes": ["Extract tax logic"],
                        "body_abstract": "Compute tax and round",
                    },
                }
            ],
        }
        result = format_plan_for_generator(plan, "class Calc { }")
        self.assertIn("- Parameters: double subtotal, double taxRate", result)

    def test_plan_handles_string_parameters(self):
        plan = {
            "target_class": "A",
            "ast_mutations": [
                {
                    "action": "MODIFY_METHOD",
                    "target": "m",
                    "details": {
                        "parameters": ["int x", "String y"],
                    },
                }
            ],
        }
        result = format_plan_for_generator(plan, "class A { }")
        self.assertIn("- Parameters: int x, String y", result)

    def test_plan_no_details(self):
        plan = {
            "target_class": "A",
            "ast_mutations": [
                {"action": "RENAME_SYMBOL", "target": "x", "details": {}}
            ],
        }
        result = format_plan_for_generator(plan, "class A { }")
        self.assertIn("1. RENAME_SYMBOL x", result)
        self.assertNotIn("- Modifiers:", result)
        self.assertNotIn("- Returns:", result)
        self.assertNotIn("- Parameters:", result)

    def test_plan_base_code_preserved(self):
        code = "public class X { void m() { int a = 1; } }"
        plan = {"ast_mutations": [{"action": "MODIFY_METHOD", "target": "m", "details": {}}]}
        result = format_plan_for_generator(plan, code)
        self.assertIn(f"<code>{code}</code>", result)

if __name__ == "__main__":
    unittest.main()
