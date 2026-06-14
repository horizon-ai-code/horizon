import json
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


def format_agent_output(message: str, content: str | None) -> str:
    """
    Parses structured JSON content from agents and formats it into
    human-readable Markdown. Returns the original message if no content
    or if parsing fails.
    """
    if not content:
        return message

    try:
        data = json.loads(content)
    except (json.JSONDecodeError, TypeError):
        return message  # Fallback to just the message if not JSON

    formatted_md = ""

    # 1. Intent Packet Formatting
    if isinstance(data, dict) and "specific_intent" in data and "refactor_category" in data:
        formatted_md = f"**Category:** `{data.get('refactor_category')}`\n"
        formatted_md += f"**Intent:** `{data.get('specific_intent')}`\n"

        anchor = data.get("scope_anchor", {})
        if anchor:
            formatted_md += f"**Target Unit:** `{anchor.get('unit_type')}`\n"
            if anchor.get('class'):
                formatted_md += f"**Target Class:** `{anchor.get('class')}`\n"
            if anchor.get('member'):
                formatted_md += f"**Target Member:** `{anchor.get('member')}`\n"

    # 2. AST Modification Plan Formatting
    elif isinstance(data, dict) and "ast_mutations" in data:
        target_class = data.get("target_class", "Unknown Class")
        formatted_md = f"**Target Class:** `{target_class}`\n\n**Mutations:**\n"
        for mut in data.get("ast_mutations", []):
            action = mut.get("action", "")
            target = mut.get("target", "")
            formatted_md += f"- **{action}** on `{target}`\n"
            details = mut.get("details", {})
            if details:
                logic = details.get("logic_changes", [])
                for change in logic:
                    formatted_md += f"  - *{change}*\n"

    # 3. Validation Feedback Formatting
    elif isinstance(data, dict) and "findings" in data and "total_faults" in data:
        formatted_md = f"**Total Faults:** {data.get('total_faults')} (Recoverable: {'Yes' if data.get('is_recoverable') else 'No'})\n\n"
        for finding in data.get("findings", []):
            tier = finding.get("failure_tier", "")
            formatted_md += f"**[{tier}]**\n"
            error = finding.get("error_report", {})
            if error.get("message"):
                formatted_md += f"> {error.get('message')}\n"
            if error.get("faulty_node"):
                formatted_md += f"- Node: `{error.get('faulty_node')}`\n"
            if finding.get("recovery_hint"):
                formatted_md += f"- *Hint:* {finding.get('recovery_hint')}\n"
            formatted_md += "\n"

    # 4. Structural Auditor Verdict Formatting
    elif isinstance(data, dict) and "verdict" in data and "issues" in data:
        verdict = data.get("verdict")
        icon = "✅" if verdict == "ACCEPT" else "❌"
        formatted_md = f"**Verdict:** {icon} {verdict}\n"
        issues = data.get("issues", [])
        if issues:
            formatted_md += "\n**Issues:**\n"
            for issue in issues:
                formatted_md += f"- {issue}\n"

    # 5. Validator Output Formatting (list of ValidationFindings)
    elif isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict) and "failure_tier" in data[0] and "error_report" in data[0]:
        formatted_md = f"**Total Faults:** {len(data)}\n\n"
        for finding in data:
            tier = finding.get("failure_tier", "")
            formatted_md += f"**[{tier}]**\n"
            error = finding.get("error_report", {})
            if error.get("message"):
                formatted_md += f"> {error.get('message')}\n"
            if error.get("faulty_node"):
                formatted_md += f"- Node: `{error.get('faulty_node')}`\n"
            if finding.get("recovery_hint"):
                formatted_md += f"- *Hint:* {finding.get('recovery_hint')}\n"
            formatted_md += "\n"

    # Fallback for generic JSON dict
    elif isinstance(data, dict):
        formatted_md = "```json\n" + json.dumps(data, indent=2) + "\n```"
    elif isinstance(data, list):
        formatted_md = "```json\n" + json.dumps(data, indent=2) + "\n```"

    if formatted_md:
        return f"{message}\n\n{formatted_md}"

    return message
