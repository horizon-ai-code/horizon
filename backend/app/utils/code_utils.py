import re
from typing import Any


def strip_outer_wrapper(code: str, base_code: str) -> str:
    """Strip the outermost class wrapper if base had none and refactored has one.

    Preserves import lines and inner class content.
    """
    if "class" in base_code:
        return code
    text = code.strip()
    class_match = re.search(r"(?:public|private|protected|static|abstract|final|\s)*class\s+\w+", text)
    if not class_match:
        return code
    brace_start = text.find("{", class_match.end())
    if brace_start == -1:
        return code

    import_lines = [line for line in code.splitlines()
                    if line.strip().startswith("import ")]

    depth = 0
    for i in range(brace_start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                inner = text[brace_start + 1: i].strip()
                if import_lines:
                    inner = "\n".join(import_lines) + "\n\n" + inner
                return inner
    return code


def order_mutations(mutations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Order mutations by dependency: RENAME first, then ADD_*, then MODIFY."""

    def sort_key(m: dict[str, Any]) -> int:
        action = m.get("action", "")
        if action == "RENAME_SYMBOL":
            return 0
        if action.startswith("ADD_") or action == "SPLIT_BODY":
            return 1
        if action in ("MODIFY_METHOD", "REMOVE_METHOD"):
            return 2
        return 3

    return sorted(mutations, key=sort_key)
