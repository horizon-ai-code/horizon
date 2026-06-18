import re
from typing import Any

import javalang


class ASTMatcher:
    """Computes concrete mutation details from original code + plan context.

    The Planner produces abstract mutations (action + target). This module
    enriches them with exact find_text/replace_text and insert_after by
    analyzing the original Java code with javalang.
    """

    @staticmethod
    def enrich_mutations(
        code: str,
        mutations: list[dict[str, Any]],
        intent: str | None = None,
        target_method: str | None = None,
    ) -> list[dict[str, Any]]:
        for m in mutations:
            action = m.get("action", "")
            target = m.get("target", "")
            details = m.get("details", {})
            body = details.get("body_abstract", "") or ""

            if action == "ADD_CONSTANT":
                ASTMatcher._enrich_add_constant(code, details, target, body, target_method)

            elif action == "ADD_FIELD":
                ASTMatcher._enrich_add_field(code, details, target, body)

            elif action == "ADD_DECLARATION":
                ASTMatcher._enrich_add_declaration(code, details, target, body)

            elif action == "ADD_METHOD":
                ASTMatcher._enrich_add_method(code, details, target, body)

            elif action == "SPLIT_BODY":
                ASTMatcher._enrich_add_method(code, details, target, body)

            elif action == "MODIFY_METHOD":
                ASTMatcher._enrich_modify_method(code, details, target, body, intent, mutations)

            elif action == "RENAME_SYMBOL":
                ASTMatcher._enrich_rename_symbol(code, details, target, body)

            m["details"] = details
        return mutations

    @staticmethod
    def _find_class_declaration_line(code: str) -> str | None:
        """Find the first class/enum/interface declaration line (anchor for insert_after)."""
        lines = code.split('\n')
        for line in lines:
            stripped = line.strip()
            if re.match(r'^\s*(public\s+)?(class|enum|interface)\s+\w+', stripped):
                # Return line as-is (original whitespace)
                return line
        return None

    @staticmethod
    def _find_method_body(code: str, method_name: str) -> str | None:
        """Find a method body by name, return the full method declaration."""
        try:
            import re
            wrapped = f"class _W_ {{ {code} }}" if not re.search(r'\bclass\s+\w+\s*\{', code[:100]) else code
            tree = javalang.parse.parse(wrapped)
            for _path, node in tree:
                if isinstance(node, javalang.tree.MethodDeclaration):
                    if node.name == method_name:
                        return ASTMatcher._extract_method_text(code, method_name)
        except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError, ValueError):
            pass
        return None

    @staticmethod
    def _extract_method_text(code: str, method_name: str) -> str | None:
        """Extract method declaration text from source code using simple line matching."""
        lines = code.split('\n')
        start_idx = -1
        brace_depth = 0
        opened = False
        for i, line in enumerate(lines):
            stripped = line.strip()
            if f" {method_name}(" in stripped or stripped.startswith(f"{method_name}("):
                start_idx = i
            if start_idx >= 0:
                if not opened:
                    brace_depth += stripped.count('{') - stripped.count('}')
                    if stripped.count('{') > 0:
                        opened = True
                else:
                    brace_depth += stripped.count('{') - stripped.count('}')
                if opened and brace_depth <= 0:
                    return '\n'.join(lines[start_idx:i + 1])
        return None

    @staticmethod
    def _find_literal_in_code(code: str, literal: str, method_name: str | None = None) -> bool:
        """Check if a literal value appears in the code (optionally within a specific method)."""
        if method_name:
            method_text = ASTMatcher._find_method_body(code, method_name)
            if not method_text:
                return False
            return literal in method_text
        return literal in code

    @staticmethod
    def _enrich_add_constant(
        code: str,
        details: dict[str, Any],
        target: str,
        body: str,
        target_method: str | None,
    ) -> None:
        """Enrich ADD_CONSTANT with insert_after and find/replace.

        The planner provides 'value' (the literal). The matcher:
        - Sets insert_after to class declaration
        - Uses value + target as find/replace when MODIFY_METHOD references them
        """
        if not details.get("insert_after"):
            decl = ASTMatcher._find_class_declaration_line(code)
            if decl:
                details["insert_after"] = decl

    @staticmethod
    def _enrich_add_field(
        code: str,
        details: dict[str, Any],
        target: str,
        body: str,
    ) -> None:
        """Enrich ADD_FIELD with insert_after."""
        if not details.get("insert_after"):
            decl = ASTMatcher._find_class_declaration_line(code)
            if decl:
                details["insert_after"] = decl

    @staticmethod
    def _enrich_add_declaration(
        code: str,
        details: dict[str, Any],
        target: str,
        body: str,
    ) -> None:
        """Enrich ADD_DECLARATION with insert_after based on scope."""
        scope = details.get("scope", "local")
        if scope == "local":
            # Local variable — no insert_after needed, generated inline
            details["insert_after"] = target
        elif not details.get("insert_after"):
            decl = ASTMatcher._find_class_declaration_line(code)
            if decl:
                details["insert_after"] = decl

    @staticmethod
    def _enrich_add_method(
        code: str,
        details: dict[str, Any],
        target: str,
        body: str,
    ) -> None:
        """Enrich ADD_METHOD with insert_after."""
        if not details.get("insert_after"):
            decl = ASTMatcher._find_class_declaration_line(code)
            if decl:
                details["insert_after"] = decl

    @staticmethod
    def _enrich_modify_method(
        code: str,
        details: dict[str, Any],
        target: str,
        body: str,
        intent: str | None,
        all_mutations: list[dict[str, Any]],
    ) -> None:
        """Enrich MODIFY_METHOD with find_text/replace_text.

        For EXTRACT_CONSTANT: uses ADD_CONSTANT mutations' value + target
        to create find/replace pairs.
        """
        if intent == "EXTRACT_CONSTANT":
            # Find sibling ADD_CONSTANT mutations for value info
            for m in all_mutations:
                if m.get("action") == "ADD_CONSTANT":
                    value = m.get("details", {}).get("value")
                    const_name = m.get("target")
                    if value and const_name:
                        if not details.get("find_text"):
                            details["find_text"] = value
                        if not details.get("replace_text"):
                            details["replace_text"] = const_name
                        break

    @staticmethod
    def _enrich_rename_symbol(
        code: str,
        details: dict[str, Any],
        target: str,
        body: str,
    ) -> None:
        """Enrich RENAME_SYMBOL with find_text/replace_text.

        Parses body_abstract like 'Rename m to rowCount' for the new name.
        find_text is the old name (mutation target).
        """
        if not details.get("find_text"):
            details["find_text"] = target

        if not details.get("replace_text"):
            # Try to extract new name from body_abstract
            # Patterns: "Rename X to Y", "X → Y", "X -> Y", "rename symbol X to Y"
            m = re.search(r'(?:rename\s+`?\w+`?\s+to\s+|→|->)\s*`?(\w+)`?', body, re.IGNORECASE)
            if m:
                details["replace_text"] = m.group(1)
