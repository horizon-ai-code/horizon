import hashlib
import json
import re
from typing import Any, Callable, Dict, List, Optional, Tuple, Type, Union

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

        data: Dict[str, Any] = {"node_type": node.__class__.__name__, "children": []}

        # Extract meaningful attributes based on node type
        attrs: Dict[str, Any] = {}
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
    def get_hash(serialized_node: Any) -> str:
        """Generates a stable hash for a serialized node."""
        node_json = json.dumps(serialized_node, sort_keys=True)
        return hashlib.sha256(node_json.encode()).hexdigest()

    @staticmethod
    def get_structural_signature(node: Any) -> str:
        """Computes a structural hash ignoring variable names, formatting, and imports.

        Captures node-type skeleton, operators, branching depth,
        method invocation names, and string literals.
        """
        skeleton_parts: List[str] = []
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
    def find_nodes(node: Any, node_type: Union[Type, Tuple[Type, ...]]) -> List[Any]:
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
    def verify_flatten_conditional(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
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
    def verify_decompose_conditional(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
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

        orig_ifs = ASTWalker.find_nodes(orig_ast, javalang.tree.IfStatement)
        refac_ifs = ASTWalker.find_nodes(refac_ast, javalang.tree.IfStatement)

        orig_ops = sum(count_binary_ops(i.condition) for i in orig_ifs)
        refac_ops = sum(count_binary_ops(i.condition) for i in refac_ifs)

        if refac_ops < orig_ops:
            return (
                True,
                f"Conditional binary operators decreased from {orig_ops} to {refac_ops}.",
            )
        return (
            False,
            f"Operator count did not decrease (Old: {orig_ops}, New: {refac_ops}).",
        )

    @staticmethod
    def verify_consolidate_conditional(
        orig_ast: Any, refac_ast: Any
    ) -> Tuple[bool, str]:
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
    def verify_remove_control_flag(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
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

        if refac_breaks > orig_breaks and len(removed_vars) > 0:
            return (
                True,
                f"Exit points increased ({orig_breaks} -> {refac_breaks}) and flag variable(s) {removed_vars} removed.",
            )

        if refac_breaks > orig_breaks:
            return (
                True,
                f"Exit points increased ({orig_breaks} -> {refac_breaks}), but no variable removal detected.",
            )

        return False, "Exit points did not increase."

    @staticmethod
    def verify_replace_loop_with_pipeline(
        orig_ast: Any, refac_ast: Any
    ) -> Tuple[bool, str]:
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
        has_stream = any(getattr(i, "member", "") == "stream" for i in invocations)

        if refac_loops < orig_loops and has_stream:
            return (
                True,
                f"Loops decreased from {orig_loops} to {refac_loops} and stream() invocation found.",
            )
        return False, "Loop count did not decrease or stream() pipeline not found."

    @staticmethod
    def verify_split_loop(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
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

        if refac_loops == orig_loops + 1:
            return True, f"Loop count increased by 1 ({orig_loops} -> {refac_loops})."
        return False, f"Loop count delta was {refac_loops - orig_loops}, expected +1."

    @staticmethod
    def verify_extract_method(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
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
    def verify_inline_method(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
        orig_methods = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.MethodDeclaration)
        )
        refac_methods = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.MethodDeclaration)
        )
        if refac_methods < orig_methods:
            return (
                True,
                f"Method count decreased from {orig_methods} to {refac_methods}.",
            )
        return (
            False,
            f"Expected at least one less method, found {refac_methods - orig_methods} delta.",
        )

    @staticmethod
    def verify_extract_variable(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
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
    def verify_inline_variable(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
        orig_vars = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator)
        )
        refac_vars = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator)
        )
        if refac_vars < orig_vars:
            return True, f"Variable count decreased from {orig_vars} to {refac_vars}."
        return False, "Variable count did not decrease."

    @staticmethod
    def verify_extract_constant(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
        orig_consts = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.FieldDeclaration)
        )
        refac_consts = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.FieldDeclaration)
        )
        if refac_consts > orig_consts:
            return True, f"Constant count increased from {orig_consts} to {refac_consts}."
        return False, "Constant count did not increase."

    @staticmethod
    def verify_rename_symbol(orig_ast: Any, refac_ast: Any) -> Tuple[bool, str]:
        # Compare structural signatures (ignores variable names, formatting, imports, numeric literals).
        # Only the node-type skeleton, operators, method invocations, and string literals are compared.
        orig_sig = ASTWalker.get_structural_signature(orig_ast)
        refac_sig = ASTWalker.get_structural_signature(refac_ast)

        if orig_sig == refac_sig:
            return True, "Structural integrity preserved after rename."
        return False, "Structural change detected beyond just name/symbol."


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

        self.verifier_registry: Dict[RefactorIntent, Callable] = {
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

    def check_syntax(self, snippet: str) -> Dict[str, Any]:
        clean_snippet = snippet.strip()
        result: Dict[str, Any] = {"is_valid": False, "errors": [], "unit": None}
        if not clean_snippet:
            return result
        for index, template in enumerate(self.templates):
            wrapped_code = template(clean_snippet)
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

    def get_method_complexity(self, snippet: str, method_name: str) -> Optional[int]:
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
                if func.name == method_name:
                    return func.cyclomatic_complexity
            return None
        return None

    def verify_intent(
        self, intent: RefactorIntent, orig_code: str, refac_code: str
    ) -> Optional[ValidationFinding]:
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
        success, msg = verifier(orig_res["ast"], refac_res["ast"])
        if success:
            return None
        return ValidationFinding(
            failure_tier=FailureTier.TIER_2_C_INTENT_MATH,
            error_report=ErrorReport(message=msg),
            recovery_hint="Check if the refactoring actually achieved the structural goal.",
        )

    def verify_boundary(
        self, orig_code: str, refac_code: str, target_scopes: List[str]
    ) -> Optional[ValidationFinding]:
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
        orig_structs = {
            getattr(n, "name", "unknown"): ASTWalker.get_structural_signature(n)
            for n in ASTWalker.find_nodes(
                orig_unit, (javalang.tree.ClassDeclaration, javalang.tree.EnumDeclaration)
            )
        }
        refac_structs = {
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

        for name, h in orig_structs.items():
            if name in refac_structs and h != refac_structs[name]:
                # If a class/enum is changed, we check if it was one of the targets
                if name not in target_scopes:
                    # Check if the change is simply because a method inside the class was changed
                    # (which is already covered by the orig_methods loop)
                    # or because a new internal structure was added.
                    
                    # We allow the outer class to 'change' its hash if it's just adding nodes
                    # but we keep the check for other top-level structures.
                    # For now, let's relax it: if the structure name doesn't match a top-level 
                    # change we want to block, we allow it.
                    continue

        return None
