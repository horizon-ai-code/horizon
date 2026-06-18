from typing import Any


def format_plan_for_generator(plan: dict[str, Any], base_code: str) -> str:
    """
    Converts a JSON AST modification plan into linear text instructions
    for the Generator model. Easier for 3B models to parse than nested JSON.
    """
    mutations = plan.get("ast_mutations", [])
    if not mutations:
        return (
            f"Base Code:\n<code>{base_code}</code>\n\n"
            f"No mutations to apply. Return the code unchanged."
        )

    instructions: list[str] = [
        f"Base Code:\n<code>{base_code}</code>\n",
        f"Instructions — apply in order ({len(mutations)} total):",
    ]

    for i, m in enumerate(mutations, 1):
        action = m.get("action", "?")
        target = m.get("target", "?")
        details = m.get("details", {})

        instruction = f"\n{i}. {action} {target}"

        modifiers = details.get("modifiers", [])
        if modifiers:
            instruction += f"\n   - Modifiers: {' '.join(modifiers)}"

        rtype = details.get("type")
        if rtype:
            instruction += f"\n   - Returns: {rtype}"

        params = details.get("parameters", [])
        if params:
            param_parts = []
            for p in params:
                if isinstance(p, dict):
                    param_parts.append(f"{p.get('type', '?')} {p.get('name', '?')}")
                elif isinstance(p, str):
                    param_parts.append(p)
                else:
                    param_parts.append(str(p))
            instruction += f"\n   - Parameters: {', '.join(param_parts)}"

        logic_changes = details.get("logic_changes", [])
        for lc in logic_changes:
            instruction += f"\n   - Change: {lc}"

        body = details.get("body_abstract")
        if body:
            instruction += f"\n   - Body: {body}"

        value = details.get("value")
        if value:
            instruction += f"\n   - Value: {value}"

        find_text = details.get("find_text")
        if find_text:
            instruction += f"\n   - Find: {find_text}"

        replace_text = details.get("replace_text")
        if replace_text:
            instruction += f"\n   - Replace: {replace_text}"

        insert_after = details.get("insert_after")
        if insert_after:
            instruction += f"\n   - Insert after: {insert_after}"

        instructions.append(instruction)

    instructions.append("\nVERIFY before outputting:")
    instructions.append("  - All mutations applied?")
    instructions.append("  - Method signatures unchanged unless instructed?")
    instructions.append("  - Output ONLY the code in <code> tags.")

    return "\n".join(instructions)
