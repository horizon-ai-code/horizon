"""Sample AST mutation plans for AST matcher and formatter tests."""

SINGLE_MODIFY = {
    "ast_mutations": [
        {"action": "MODIFY_METHOD", "target": "calculate", "details": {"body": "return x + 1;"}}
    ]
}

THREE_MUTATIONS = {
    "target_class": "A",
    "ast_mutations": [
        {"action": "RENAME_SYMBOL", "target": "oldName", "details": {"new_name": "newName"}},
        {"action": "ADD_CONSTANT", "target": "MAX_SIZE", "details": {"value": "100", "type": "int"}},
        {"action": "MODIFY_METHOD", "target": "calculate", "details": {"body": "return MAX_SIZE;"}},
    ]
}

EMPTY_MUTATIONS = {"ast_mutations": []}

DUPLICATE_MUTATIONS = {
    "target_class": "A",
    "ast_mutations": [
        {"action": "MODIFY_METHOD", "target": "calculate", "details": {}},
        {"action": "MODIFY_METHOD", "target": "calculate", "details": {}},
        {"action": "ADD_FIELD", "target": "name", "details": {}},
    ]
}
