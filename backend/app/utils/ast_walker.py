import hashlib
from typing import Any

import javalang.tree


class ASTWalker:
    @staticmethod
    def serialize_node(node: Any) -> Any:
        if not isinstance(node, javalang.tree.Node):
            return str(node) if node is not None else None

        data: dict[str, Any] = {"node_type": node.__class__.__name__, "children": []}

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
