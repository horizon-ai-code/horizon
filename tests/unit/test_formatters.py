import unittest
import json
from app.utils.formatters import format_agent_output, format_plan_for_generator

class TestFormatters(unittest.TestCase):
    def test_intent_packet_formatting(self):
        message = "Intent Classified"
        content = json.dumps({
            "refactor_category": "METHOD_MOVEMENT",
            "specific_intent": "EXTRACT_METHOD",
            "scope_anchor": {
                "unit_type": "CLASS_UNIT",
                "class": "Calculator"
            }
        })
        result = format_agent_output(message, content)
        self.assertIn("**Category:** `METHOD_MOVEMENT`", result)
        self.assertIn("**Intent:** `EXTRACT_METHOD`", result)
        self.assertIn("**Target Class:** `Calculator`", result)

    def test_ast_mutation_formatting(self):
        message = "Plan generated"
        content = json.dumps({
            "target_class": "AuthService",
            "ast_mutations": [
                {
                    "action": "ADD_METHOD",
                    "target": "validateToken",
                    "details": {
                        "logic_changes": ["Move JWT logic here", "Add null checks"]
                    }
                }
            ]
        })
        result = format_agent_output(message, content)
        self.assertIn("**Target Class:** `AuthService`", result)
        self.assertIn("- **ADD_METHOD** on `validateToken`", result)
        self.assertIn("- *Move JWT logic here*", result)

    def test_validation_finding_formatting(self):
        message = "Errors detected"
        content = json.dumps({
            "total_faults": 1,
            "is_recoverable": True,
            "findings": [
                {
                    "failure_tier": "TIER_1_SYNTAX",
                    "error_report": {
                        "message": "Missing semicolon",
                        "faulty_node": "System.out.println"
                    },
                    "recovery_hint": "Add ';' at the end of the line."
                }
            ]
        })
        result = format_agent_output(message, content)
        self.assertIn("**Total Faults:** 1", result)
        self.assertIn("**[TIER_1_SYNTAX]**", result)
        self.assertIn("> Missing semicolon", result)
        self.assertIn("*Hint:* Add ';' at the end of the line.", result)

    def test_validator_output_formatting(self):
        message = "Structural Checks Failed (1 issues)."
        content = json.dumps([
            {
                "failure_tier": "TIER_2_C_INTENT_MATH",
                "error_report": {
                    "message": "Nesting depth did not decrease.",
                    "faulty_node": "IfStatement"
                },
                "recovery_hint": "Check if the refactoring actually achieved the structural goal."
            }
        ])
        result = format_agent_output(message, content)
        self.assertIn("**Total Faults:** 1", result)
        self.assertIn("**[TIER_2_C_INTENT_MATH]**", result)
        self.assertIn("> Nesting depth did not decrease.", result)
        self.assertIn("- Node: `IfStatement`", result)
        self.assertIn("- *Hint:* Check if the refactoring actually achieved the structural goal.", result)
        self.assertNotIn("```json", result)

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
