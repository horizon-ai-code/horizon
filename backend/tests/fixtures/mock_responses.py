"""Templated LLM response dicts for mocked AgentService.generate()."""

INTENT_CLASSIFIER_RESPONSE = {
    "choices": [{
        "message": {
            "content": """{
                "classification_scratchpad": "Flatten nested if",
                "intent_packet": {
                    "refactor_category": "CONTROL_FLOW",
                    "specific_intent": "FLATTEN_CONDITIONAL",
                    "scope_anchor": {"class": "A", "unit_type": "METHOD_UNIT"}
                }
            }"""
        }
    }]
}

BAD_JSON_RESPONSE = {
    "choices": [{
        "message": {"content": "not valid json"}
    }]
}

ARCHITECT_ANALYSIS_RESPONSE = {
    "choices": [{
        "message": {
            "content": """{
                "analysis_scratchpad": "Target calculate method",
                "primary_targets": [{"name": "m", "kind": "method"}],
                "secondary_targets": [],
                "new_structures": [],
                "must_preserve": []
            }"""
        }
    }]
}

AST_ARCHITECT_RESPONSE = {
    "choices": [{
        "message": {
            "content": """{
                "architect_scratchpad": "Plan modification",
                "ast_modification_plan": {
                    "target_class": "A",
                    "ast_mutations": [
                        {"action": "MODIFY_METHOD", "target": "m", "details": {}}
                    ]
                }
            }"""
        }
    }]
}

SINGLE_MUTATION_RESPONSE = {
    "choices": [{
        "message": {
            "content": "<code>class A { void m() { return; } }</code>"
        }
    }]
}

JUDGE_ACCEPT_RESPONSE = {
    "choices": [{
        "message": {
            "content": """{
                "audit_scratchpad": {"variable_trace": [], "logic_comparison": ""},
                "verdict": "ACCEPT",
                "issues": []
            }"""
        }
    }]
}

JUDGE_REVISE_RESPONSE = {
    "choices": [{
        "message": {
            "content": """{
                "audit_scratchpad": {"variable_trace": [], "logic_comparison": ""},
                "verdict": "REVISE",
                "issues": [{"issue_type": "logic_drift", "description": "Logic changed"}]
            }"""
        }
    }]
}

INSIGHTS_RESPONSE = {
    "choices": [{
        "message": {
            "content": """{
                "insights": [
                    {"title": "Complexity", "details": "Reduced from 5 to 3"}
                ]
            }"""
        }
    }]
}
