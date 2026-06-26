from typing import Any

import javalang.tree

from app.utils.ast_walker import ASTWalker


class RefactorVerifier:
    @staticmethod
    def verify_flatten_conditional(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
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

        if len(new_vars) > 0 or refac_ops < orig_ops:
            return (
                True,
                f"Decomposition: {len(new_vars)} new variables, {orig_ops}->{refac_ops} binary ops, used={var_used}.",
            )
        return (
            False,
            f"No decomposition: {orig_ops}->{refac_ops} binary ops, {len(new_vars)} new vars.",
        )

    @staticmethod
    def verify_consolidate_conditional(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_nodes = len(
            ASTWalker.find_nodes(orig_ast, javalang.tree.IfStatement)
        ) + len(ASTWalker.find_nodes(orig_ast, javalang.tree.SwitchStatement))
        refac_nodes = len(
            ASTWalker.find_nodes(refac_ast, javalang.tree.IfStatement)
        ) + len(ASTWalker.find_nodes(refac_ast, javalang.tree.SwitchStatement))

        if refac_nodes < orig_nodes:
            return (True, f"Conditional nodes decreased from {orig_nodes} to {refac_nodes}.")
        return False, "Conditional nodes count did not decrease."

    @staticmethod
    def verify_remove_control_flag(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
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
    def verify_replace_loop_with_pipeline(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_loops = len(
            ASTWalker.find_nodes(
                orig_ast,
                (javalang.tree.ForStatement, javalang.tree.WhileStatement, javalang.tree.DoStatement),
            )
        )
        refac_loops = len(
            ASTWalker.find_nodes(
                refac_ast,
                (javalang.tree.ForStatement, javalang.tree.WhileStatement, javalang.tree.DoStatement),
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
        orig_loops = len(
            ASTWalker.find_nodes(orig_ast, (javalang.tree.ForStatement, javalang.tree.WhileStatement))
        )
        refac_loops = len(
            ASTWalker.find_nodes(refac_ast, (javalang.tree.ForStatement, javalang.tree.WhileStatement))
        )

        if refac_loops > orig_loops:
            return True, f"Loop count increased from {orig_loops} to {refac_loops}."
        return False, f"Loop count did not increase ({orig_loops} -> {refac_loops})."

    @staticmethod
    def verify_extract_method(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_methods = len(ASTWalker.find_nodes(orig_ast, javalang.tree.MethodDeclaration))
        refac_methods = len(ASTWalker.find_nodes(refac_ast, javalang.tree.MethodDeclaration))
        if refac_methods > orig_methods:
            return (True, f"Method count increased from {orig_methods} to {refac_methods}.")
        return (False, f"Expected at least one new method, found {refac_methods - orig_methods} delta.")

    @staticmethod
    def verify_inline_method(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_methods = len(ASTWalker.find_nodes(orig_ast, javalang.tree.MethodDeclaration))
        refac_methods = len(ASTWalker.find_nodes(refac_ast, javalang.tree.MethodDeclaration))
        if refac_methods <= orig_methods:
            return (True, f"Method count: {orig_methods} -> {refac_methods}.")
        return (False, f"Method count increased from {orig_methods} to {refac_methods}.")

    @staticmethod
    def verify_extract_variable(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_vars = len(ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator))
        refac_vars = len(ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator))
        if refac_vars > orig_vars:
            return True, f"Variable count increased from {orig_vars} to {refac_vars}."
        return False, "Variable count did not increase."

    @staticmethod
    def verify_inline_variable(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_vars = len(ASTWalker.find_nodes(orig_ast, javalang.tree.VariableDeclarator))
        refac_vars = len(ASTWalker.find_nodes(refac_ast, javalang.tree.VariableDeclarator))
        if refac_vars <= orig_vars:
            return True, f"Variable count: {orig_vars} -> {refac_vars}."
        return False, f"Variable count increased from {orig_vars} to {refac_vars}."

    @staticmethod
    def verify_extract_constant(orig_ast: Any, refac_ast: Any) -> tuple[bool, str]:
        orig_consts = len(ASTWalker.find_nodes(orig_ast, javalang.tree.FieldDeclaration))
        refac_consts = len(ASTWalker.find_nodes(refac_ast, javalang.tree.FieldDeclaration))
        if refac_consts > orig_consts:
            return True, f"Constant count increased from {orig_consts} to {refac_consts}."

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
