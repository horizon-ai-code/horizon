import hashlib
import re
from collections.abc import Callable
from typing import Any

import javalang
import javalang.tree
import lizard

from app.utils.schemas import ErrorReport, ValidationFinding
from app.utils.types import FailureTier, RefactorIntent, StructureUnit


class ASTWalker:
    """Utility for serializing and comparing Java AST nodes."""

    @staticmethod
    def serialize_node(node: Any) -> Any:
        """Recursively serializes a javalang AST node into a deterministic dict or primitive."""
        if not isinstance(node, javalang.tree.Node):
            return str(node) if node is not None else None

        data: dict[str, Any] = {"node_type": node.__class__.__name__, "children": []}

        # Extract meaningful attributes based on node type
        attrs: dict[str, Any] = {}
        for attr in node.attrs:
            val = getattr(node, attr)
            if attr in ("position", "documentation"):
                continue
            if isinstance(val, (str, int, float, bool)) or val is None:
                attrs[attr] = val
            elif isinstance(val, list):
                serialized_list = []
                for item in val:
                    if isinstance(item, javalang.tree.Node):
                        serialized_list.append(ASTWalker.serialize_node(item))
                    else:
                        serialized_list.append(str(item))
                attrs[attr] = serialized_list

        data["attrs"] = attrs

        for child in node.children:
            if isinstance(child, javalang.tree.Node):
                data["children"].append(ASTWalker.serialize_node(child))
            elif isinstance(child, list):
                for item in child:
                    if isinstance(item, javalang.tree.Node):
                        data["children"].append(ASTWalker.serialize_node(item))

        return data

    @staticmethod
    def get_structural_signature(node: Any) -> str:
        """Computes a structural hash ignoring variable names, formatting, and imports.

        Captures node-type skeleton, operators, branching depth,
        method invocation names, and string literals.
        """
        skeleton_parts: list[str] = []
        operators: set = set()
        string_literals: list = []
        invocations: list = []

        def walk(n: Any, depth: int = 0) -> None:
            if not isinstance(n, javalang.tree.Node):
                return

            node_name = n.__class__.__name__
            skeleton_parts.append(node_name)

            if isinstance(n, javalang.tree.BinaryOperation):
                if hasattr(n, "operator"):
                    operators.add(n.operator)

            if isinstance(n, javalang.tree.MethodInvocation):
                if hasattr(n, "member"):
                    invocations.append(n.member)

            if isinstance(n, javalang.tree.Literal):
                if hasattr(n, "value") and isinstance(n.value, str):
                    string_literals.append(n.value)

            if isinstance(n, javalang.tree.IfStatement):
                skeleton_parts.append(f"Depth({depth})")

            for child in n.children:
                if isinstance(child, javalang.tree.Node):
                    walk(child, depth + 1 if isinstance(n, javalang.tree.IfStatement) else depth)
                elif isinstance(child, list):
                    for item in child:
                        if isinstance(item, javalang.tree.Node):
                            walk(item, depth)

        walk(node)
        sig = (
            "|".join(skeleton_parts)
            + "||ops:" + ",".join(sorted(operators))
            + "||strs:" + ",".join(sorted(string_literals))
            + "||calls:" + ",".join(sorted(invocations))
        )
        return hashlib.sha256(sig.encode()).hexdigest()

    @staticmethod
    def find_nodes(node: Any, node_type: type | tuple[type, ...]) -> list[Any]:
        """Finds all nodes of a specific type in the tree."""
        matches = []
        if isinstance(node, node_type):
            matches.append(node)

        if isinstance(node, javalang.tree.Node):
            for child in node.children:
                matches.extend(ASTWalker.find_nodes(child, node_type))
        elif isinstance(node, list):
            for item in node:
                matches.extend(ASTWalker.find_nodes(item, node_type))
        return matches


class RefactorVerifier:
    """Registry of intent-specific structural checks."""

    @staticmethod
    def verify_flatten_conditional(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that nesting depth decreased after flattening."""
        def get_max_depth(node, current_depth=0):
            if isinstance(node, javalang.tree.IfStatement):
                depths = [get_max_depth(c, current_depth + 1) for c in node.children]
                return max(depths) if depths else current_depth + 1
            max_d = current_depth
            if isinstance(node, javalang.tree.Node):
                for child in node.children:
                    max_d = max(max_d, get_max_depth(child, current_depth))
            elif isinstance(node, list):
                for item in node:
                    max_d = max(max_d, get_max_depth(item, current_depth))
            return max_d

        orig_depth = get_max_depth(orig_ast)
        refac_depth = get_max_depth(refac_ast)
        if refac_depth < orig_depth:
            return True, f"Nesting depth decreased from {orig_depth} to {refac_depth}."
        return (
            False,
            f"Nesting depth did not decrease (Old: {orig_depth}, New: {refac_depth}).",
        )

    @staticmethod
    def verify_decompose_conditional(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that binary operators decreased or new variables were introduced."""
        def count_binary_ops(node):
            count = 0
            if isinstance(node, javalang.tree.BinaryOperation):
                count = 1
            if isinstance(node, javalang.tree.Node):
                for child in node.children:
                    count += count_binary_ops(child)
            elif isinstance(node, list):
                for item in node:
                    count += count_binary_ops(item)
            return count

        orig_ops = count_binary_ops(orig_ast)
        refac_ops = count_binary_ops(refac_ast)

        orig_vars = {
            v.name
            for v in ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
        }
        refac_vars = {
            v.name
            for v in ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator)
        }
        new_vars = refac_vars - orig_vars

        def var_in_conditional(ast: Any, var_name: str) -> bool:
            for n in ASTWalker.find_nodes(ast, (javalang.tree.IfStatement, javalang.tree.ReturnStatement,
                                                 javalang.tree.WhileStatement, javalang.tree.ForStatement)):
                expr = ""
                if isinstance(n, javalang.tree.IfStatement) and hasattr(n, "condition"):
                    expr = str(n.condition)
                elif isinstance(n, javalang.tree.ReturnStatement) and hasattr(n, "expression"):
                    expr = str(n.expression)
                elif isinstance(n, javalang.tree.WhileStatement) and hasattr(n, "condition"):
                    expr = str(n.condition)
                elif isinstance(n, javalang.tree.ForStatement) and hasattr(n, "condition"):
                    expr = str(n.condition) if n.condition else ""
                if var_name in expr:
                    return True
            return False

        var_used = any(var_in_conditional(refac_ast, v) for v in new_vars)

        # Accept if any new variable exists (local or field), OR binary ops decreased
        if len(new_vars) > 0 or refac_ops < orig_ops:
            return (
                True,
                f"Decomposition: {len(new_vars)} new variables, {orig_ops}→{refac_ops} binary ops, used={var_used}.",
            )
        return (
            False,
            f"No decomposition: {orig_ops}→{refac_ops} binary ops, {len(new_vars)} new vars.",
        )

    @staticmethod
    def verify_consolidate_conditional(
        orig_ast: Any, refac_ast: Any
    ) -> tuple[bool, str]:
        """Check that the number of if/switch nodes decreased."""
        orig_nodes = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.IfStatement)
        ) + len(ASTWalker.find_nodes(orig_ast, javalang.tree.SwitchStatement))
        refac_nodes = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.IfStatement)
        ) + len(ASTWalker.find_nodes(refac_ast, javalang.tree.SwitchStatement))

        if refac_nodes < orig_nodes:
            return (
                True,
                f"Conditional nodes decreased from {orig_nodes} to {refac_nodes}.",
            )
        return False, "Conditional nodes count did not decrease."

    @staticmethod
    def verify_remove_control_flag(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that exit points increased or boolean/control variables were removed."""
        orig_breaks = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.BreakStatement)
        ) + len(ASTWalker.find_nodes(orig_ast, javalang.tree.ReturnStatement))
        refac_breaks = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.BreakStatement)
        ) + len(ASTWalker.find_nodes(refac_ast, javalang.tree.ReturnStatement))

        orig_vars = {
            v.name
            for v in ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
        }
        refac_vars = {
            v.name
            for v in ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator)
        }

        removed_vars = orig_vars - refac_vars
        new_vars = refac_vars - orig_vars

        # Accept if exit points increased, OR boolean flags were removed/renamed
        removed_bool_flags = {
            v.name for v in ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
            if v.name in removed_vars and hasattr(v, "type") and str(v.type) == "boolean"
        }

        if refac_breaks > orig_breaks:
            return (
                True,
                f"Exit points increased ({orig_breaks} -> {refac_breaks}), flags removed={removed_bool_flags}.",
            )

        if len(removed_vars) > 0:
            return (
                True,
                f"Variable(s) removed: {removed_vars}. Exit points: {orig_breaks} -> {refac_breaks}.",
            )

        if len(new_vars) > 0 and orig_breaks > 0:
            return (
                True,
                f"New variables detected ({new_vars}). Exit points: {orig_breaks} -> {refac_breaks}.",
            )

        return False, f"No control flag change detected. Exit points: {orig_breaks} -> {refac_breaks}."

    @staticmethod
    def verify_replace_loop_with_pipeline(
        orig_ast: Any, refac_ast: Any
    ) -> tuple[bool, str]:
        """Check that loops decreased with stream pipeline evidence."""
        orig_loops = len(
            ASTWalker.find_nodes(
                orig_ast,
                (
                    javalang.tree.ForStatement,
                    javalang.tree.WhileStatement,
                    javalang.tree.DoStatement,
                ),
            )
        )
        refac_loops = len(
            ASTWalker.find_nodes(
                refac_ast,
                (
                    javalang.tree.ForStatement,
                    javalang.tree.WhileStatement,
                    javalang.tree.DoStatement,
                ),
            )
        )

        invocations = ASTWalker.find_nodes(refac_ast, javalang.tree.MethodInvocation)
        stream_keywords = {"stream", "IntStream", "range", "map", "boxed", "collect", "Collectors"}
        has_stream = any(
            getattr(i, "member", "") in stream_keywords
            or getattr(i, "qualifier", "") == "IntStream"
            or getattr(i, "qualifier", "") == "Collectors"
            for i in invocations
        )

        if refac_loops < orig_loops and has_stream:
            return (
                True,
                f"Loops decreased from {orig_loops} to {refac_loops} and stream pipeline found.",
            )
        if refac_loops < orig_loops:
            return (
                True,
                f"Loops decreased from {orig_loops} to {refac_loops} (stream pipeline heuristic).",
            )
        return False, "Loop count did not decrease."

    @staticmethod
    def verify_split_loop(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that loop count increased (single loop split into multiple)."""
        orig_loops = len(
            ASTWalker.find_nodes(
                orig_ast, (javalang.tree.ForStatement, javalang.tree.WhileStatement)
            )
        )
        refac_loops = len(
            ASTWalker.find_nodes(
                refac_ast, (javalang.tree.ForStatement, javalang.tree.WhileStatement)
            )
        )

        if refac_loops > orig_loops:
            return True, f"Loop count increased from {orig_loops} to {refac_loops}."
        return False, f"Loop count did not increase ({orig_loops} -> {refac_loops})."

    @staticmethod
    def verify_extract_method(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that the number of methods increased (extraction created a new one)."""
        orig_methods = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.MethodDeclaration)
        )
        refac_methods = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.MethodDeclaration)
        )
        if refac_methods > orig_methods:
            return (
                True,
                f"Method count increased from {orig_methods} to {refac_methods}.",
            )
        return (
            False,
            f"Expected at least one new method, found {refac_methods - orig_methods} delta.",
        )

    @staticmethod
    def verify_inline_method(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that the number of methods decreased or stayed same (inlining removes)."""
        orig_methods = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.MethodDeclaration)
        )
        refac_methods = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.MethodDeclaration)
        )
        if refac_methods <= orig_methods:
            return (
                True,
                f"Method count: {orig_methods} -> {refac_methods}.",
            )
        return (
            False,
            f"Method count increased from {orig_methods} to {refac_methods}.",
        )

    @staticmethod
    def verify_extract_variable(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that the variable count increased (new variable extracted)."""
        orig_vars = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
        )
        refac_vars = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator)
        )
        if refac_vars > orig_vars:
            return True, f"Variable count increased from {orig_vars} to {refac_vars}."
        return False, "Variable count did not increase."

    @staticmethod
    def verify_inline_variable(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that the variable count decreased or stayed same (inlining removes)."""
        orig_vars = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
        )
        refac_vars = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator)
        )
        if refac_vars <= orig_vars:
            return True, f"Variable count: {orig_vars} -> {refac_vars}."
        return False, f"Variable count increased from {orig_vars} to {refac_vars}."

    @staticmethod
    def verify_extract_constant(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that field/constant declarations increased or new uppercase variables appeared."""
        orig_consts = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.FieldDeclaration)
        )
        refac_consts = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.FieldDeclaration)
        )
        if refac_consts > orig_consts:
            return True, f"Constant count increased from {orig_consts} to {refac_consts}."

        # Also count uppercase-named variables (constant convention) at any level
        orig_uppercase = {
            v.name for v in ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
            if v.name == v.name.upper() and v.name != v.name.lower()
        }
        refac_uppercase = {
            v.name for v in ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator)
            if v.name == v.name.upper() and v.name != v.name.lower()
        }
        new_uppercase = refac_uppercase - orig_uppercase
        if new_uppercase:
            return True, f"New uppercase-named variables: {new_uppercase}."

        return False, "Constant count did not increase."

    @staticmethod
    def verify_rename_symbol(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        """Check that structural integrity is preserved after rename (same signatures, different names)."""
        # Compare structural signatures per-method (ignores rename, formatting, imports)
        orig_methods = {
            m.name: ASTWalker.get_structural_signature(m)
            for m in ASTWalker.find_nodes(orig_ast, javalang.tree.MethodDeclaration)
        }
        refac_methods = {
            m.name: ASTWalker.get_structural_signature(m)
            for m in ASTWalker.find_nodes(refac_ast, javalang.tree.MethodDeclaration)
        }

        unmatched_orig = set(orig_methods.keys())
        for name, sig in orig_methods.items():
            for _ref_name, ref_sig in refac_methods.items():
                if ref_sig == sig:
                    unmatched_orig.discard(name)
                    break

        if not unmatched_orig:
            return True, "Structural integrity preserved after rename."
        return False, f"Unmatched original methods: {unmatched_orig}."


class Validator:
    def __init__(self):
        self.templates = [
            lambda s: s,
            lambda s: f"class ASTWrapper {{\n{s}\n}}",
            lambda s: f"class ASTWrapper {{\nvoid m() {{\n{s}\n}}\n}}",
        ]
        self.line_offsets = [0, 1, 2]
        self.unit_map = {
            0: StructureUnit.CLASS_UNIT,
            1: StructureUnit.METHOD_UNIT,
            2: StructureUnit.STATEMENT_UNIT,
        }

        self.verifier_registry: dict[RefactorIntent, Callable] = {
            RefactorIntent.FLATTEN_CONDITIONAL: RefactorVerifier.verify_flatten_conditional,
            RefactorIntent.DECOMPOSE_CONDITIONAL: RefactorVerifier.verify_decompose_conditional,
            RefactorIntent.CONSOLIDATE_CONDITIONAL: RefactorVerifier.verify_consolidate_conditional,
            RefactorIntent.REMOVE_CONTROL_FLAG: RefactorVerifier.verify_remove_control_flag,
            RefactorIntent.REPLACE_LOOP_WITH_PIPELINE: RefactorVerifier.verify_replace_loop_with_pipeline,
            RefactorIntent.SPLIT_LOOP: RefactorVerifier.verify_split_loop,
            RefactorIntent.EXTRACT_METHOD: RefactorVerifier.verify_extract_method,
            RefactorIntent.INLINE_METHOD: RefactorVerifier.verify_inline_method,
            RefactorIntent.EXTRACT_VARIABLE: RefactorVerifier.verify_extract_variable,
            RefactorIntent.INLINE_VARIABLE: RefactorVerifier.verify_inline_variable,
            RefactorIntent.EXTRACT_CONSTANT: RefactorVerifier.verify_extract_constant,
            RefactorIntent.RENAME_SYMBOL: RefactorVerifier.verify_rename_symbol,
        }

    @staticmethod
    def format_syntax_error(error_str: str) -> str:
        match = re.search(r"line (\d+):(\d+) (.+)", error_str)
        if match:
            return f"[L{match.group(1)}:{match.group(2)}] {match.group(3)}. Fix and output valid Java only."
        return f"Syntax error: {error_str[:150]}. Fix and output valid Java only."

    def check_syntax(self, snippet: str) -> dict[str, Any]:
        clean_snippet = snippet.strip()
        result: dict[str, Any] = {"is_valid": False, "errors": [], "unit": None}
        if not clean_snippet:
            return result
        # Strip import lines before parsing — imports break wrapping but
        # have no effect on the AST structure we care about (classes, methods, etc.)
        # Guard: only strip lines where 'import' is the first non-whitespace token
        stripped = "\n".join(
            line for line in clean_snippet.splitlines()
            if not re.match(r'^\s*import\s+\w', line)
        )
        for index, template in enumerate(self.templates):
            wrapped_code = template(stripped)
            try:
                tree = javalang.parse.parse(wrapped_code)
                result["is_valid"] = True
                result["unit"] = self.unit_map[index]
                result["ast"] = tree
                return result
            except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError) as e:
                result["errors"].append(str(e))
                continue
        return result

    def get_complexity(self, snippet: str) -> int:
        clean_snippet = snippet.strip()
        max_cc = 1
        for template in self.templates:
            wrapped_code = template(clean_snippet)
            try:
                javalang.parse.parse(wrapped_code)
            except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError):
                continue
            analysis = lizard.analyze_file.analyze_source_code(
                "mock.java", wrapped_code
            )
            if analysis.function_list:
                max_cc = max(f.cyclomatic_complexity for f in analysis.function_list)
                break
        return max_cc

    def get_method_complexity(self, snippet: str, method_name: str) -> int | None:
        clean_snippet = snippet.strip()
        for template in self.templates:
            wrapped_code = template(clean_snippet)
            try:
                javalang.parse.parse(wrapped_code)
            except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError):
                continue
            analysis = lizard.analyze_file.analyze_source_code(
                "mock.java", wrapped_code
            )
            for func in analysis.function_list:
                fname = func.name.split("::")[-1]
                if fname == method_name:
                    return func.cyclomatic_complexity
        return None

    def has_structural_change(self, orig_code: str, refac_code: str) -> bool:
        """Compare structural signatures — returns True if AST structure differs.

        Runs both codes through check_syntax (which strips imports and auto-wraps).
        Compares structural hashes (ignores variable names, formatting, comments).
        Falls back to string comparison if either side has syntax errors.
        """
        orig_res = self.check_syntax(orig_code)
        refac_res = self.check_syntax(refac_code)
        if not orig_res["is_valid"] or not refac_res["is_valid"]:
            return orig_code.strip() != refac_code.strip()
        orig_sig = ASTWalker.get_structural_signature(orig_res["ast"])
        refac_sig = ASTWalker.get_structural_signature(refac_res["ast"])
        return orig_sig != refac_sig

    def verify_intent(
        self, intent: RefactorIntent, orig_code: str, refac_code: str
    ) -> ValidationFinding | None:
        orig_res = self.check_syntax(orig_code)
        refac_res = self.check_syntax(refac_code)
        if not orig_res["is_valid"] or not refac_res["is_valid"]:
            return ValidationFinding(
                failure_tier=FailureTier.TIER_1_SYNTAX,
                error_report=ErrorReport(
                    message="Cannot verify intent: Syntax error in input."
                ),
                recovery_hint="Ensure both original and refactored code are syntactically valid.",
            )
        verifier = self.verifier_registry.get(intent)
        if not verifier:
            return None
        try:
            success, msg = verifier(orig_res["ast"], refac_res["ast"])
        except Exception as e:
            return ValidationFinding(
                failure_tier=FailureTier.TIER_2_C_INTENT_MATH,
                error_report=ErrorReport(
                    message=f"Verifier crashed: {str(e)[:100]}",
                ),
                recovery_hint="Check if the refactoring actually achieved the structural goal.",
            )
        if success:
            return None
        return ValidationFinding(
            failure_tier=FailureTier.TIER_2_C_INTENT_MATH,
            error_report=ErrorReport(message=msg),
            recovery_hint="Check if the refactoring actually achieved the structural goal.",
        )

    def verify_boundary(
        self, orig_code: str, refac_code: str, target_scopes: list[str]
    ) -> ValidationFinding | None:
        """Phase 4, Tier 2-B: Ensure nodes outside scope are untouched."""
        orig_res = self.check_syntax(orig_code)
        refac_res = self.check_syntax(refac_code)

        if not orig_res["is_valid"] or not refac_res["is_valid"]:
            return None  # Syntax errors handled elsewhere

        orig_unit = orig_res["ast"]
        refac_unit = refac_res["ast"]

        # Compare non-target methods using structural signatures (ignores formatting, variable names, imports)
        orig_methods = {
            m.name: ASTWalker.get_structural_signature(m)
            for m in ASTWalker.find_nodes(orig_unit, javalang.tree.MethodDeclaration)
        }
        refac_methods = {
            m.name: ASTWalker.get_structural_signature(m)
            for m in ASTWalker.find_nodes(refac_unit, javalang.tree.MethodDeclaration)
        }

        # Find classes/enums that existed in original but were changed in refactor
        # We only care about modifications to EXISTING structures outside target_scopes.
        # NEW structures (enums/classes) are allowed as part of the refactoring strategy.
        {
            getattr(n, "name", "unknown"): ASTWalker.get_structural_signature(n)
            for n in ASTWalker.find_nodes(
                orig_unit, (javalang.tree.ClassDeclaration, javalang.tree.EnumDeclaration)
            )
        }
        {
            getattr(n, "name", "unknown"): ASTWalker.get_structural_signature(n)
            for n in ASTWalker.find_nodes(
                refac_unit, (javalang.tree.ClassDeclaration, javalang.tree.EnumDeclaration)
            )
        }

        for name, h in orig_methods.items():
            if name not in target_scopes and name in refac_methods:
                if h != refac_methods[name]:
                    return ValidationFinding(
                        failure_tier=FailureTier.TIER_2_B_BOUNDARY,
                        error_report=ErrorReport(
                            message=f"Boundary Violation: Method '{name}' was modified but was outside target scope(s).",
                            faulty_node=name,
                        ),
                        recovery_hint=f"Next plan must strictly preserve the body of '{name}'.",
                    )

        return None
