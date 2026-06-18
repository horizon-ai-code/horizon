"""Halstead complexity metrics and Maintainability Index computation."""
import math
import re
from dataclasses import dataclass

import javalang
import javalang.tree


@dataclass
class HalsteadMetrics:
    n1: int = 0    # distinct operators
    N1: int = 0    # total operators
    n2: int = 0    # distinct operands
    N2: int = 0    # total operands
    vocabulary: int = 0
    length: int = 0
    volume: float = 0.0
    difficulty: float = 0.0
    effort: float = 0.0

    @property
    def mi(self) -> float:
        if self.volume <= 0:
            return 0
        v = self.volume
        return max(0, 171 - 5.2 * math.log2(v) - 0.23 * 0 - 16.2 * 0)


def compute_mi(code: str, cc: int) -> tuple[HalsteadMetrics, float]:
    metrics = _compute_halstead(code)
    if metrics.volume <= 0:
        return metrics, 0.0

    loc = max(1, _count_loc(code))
    mi = 171 - 5.2 * math.log2(metrics.volume) - 0.23 * cc - 16.2 * math.log2(loc)
    mi = max(0.0, min(171.0, mi))
    return metrics, round(mi, 2)


def _count_loc(code: str) -> int:
    lines = code.strip().split('\n')
    count = 0
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('//') and not stripped.startswith('/*') and not stripped.startswith('*'):
            count += 1
    return max(1, count)


def _compute_halstead(code: str) -> HalsteadMetrics:
    cleaned = _prepare_code(code)

    try:
        tree = javalang.parse.parse(cleaned)
    except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError, Exception):
        return HalsteadMetrics()

    distinct_operators: set[str] = set()
    total_operators = 0
    distinct_operands: set[str] = set()
    total_operands = 0

    def walk(node):
        nonlocal total_operators, total_operands

        if isinstance(node, javalang.tree.BinaryOperation):
            if hasattr(node, 'operator'):
                distinct_operators.add(node.operator)
                total_operators += 1
            walk(node.operandl)
            walk(node.operandr)

        elif isinstance(node, javalang.tree.TernaryExpression):
            distinct_operators.add("?:")
            total_operators += 1
            if hasattr(node, 'condition'):
                walk(node.condition)
            if hasattr(node, 'if_true'):
                walk(node.if_true)
            if hasattr(node, 'if_false'):
                walk(node.if_false)

        elif isinstance(node, javalang.tree.MethodInvocation):
            if hasattr(node, 'member'):
                distinct_operators.add("()")
                total_operators += 1
                distinct_operands.add(node.member)
                total_operands += 1
            if hasattr(node, 'arguments'):
                for arg in node.arguments:
                    walk(arg)

        elif isinstance(node, javalang.tree.Assignment):
            distinct_operators.add("=")
            total_operators += 1
            if hasattr(node, 'expressionl'):
                walk(node.expressionl)
            if hasattr(node, 'value'):
                walk(node.value)

        elif isinstance(node, javalang.tree.Cast):
            distinct_operators.add("cast")
            total_operators += 1

        elif isinstance(node, javalang.tree.ArraySelector):
            distinct_operators.add("[]")
            total_operators += 1

        elif isinstance(node, javalang.tree.IfStatement):
            distinct_operators.add("if")
            total_operators += 1

        elif isinstance(node, javalang.tree.ForStatement):
            distinct_operators.add("for")
            total_operators += 1

        elif isinstance(node, javalang.tree.WhileStatement):
            distinct_operators.add("while")
            total_operators += 1

        elif isinstance(node, javalang.tree.DoStatement):
            distinct_operators.add("do")
            total_operators += 1

        elif isinstance(node, javalang.tree.ReturnStatement):
            distinct_operators.add("return")
            total_operators += 1

        elif isinstance(node, javalang.tree.ThrowStatement):
            distinct_operators.add("throw")
            total_operators += 1

        elif isinstance(node, javalang.tree.VariableDeclaration):
            if hasattr(node, 'type'):
                type_node = node.type
                if hasattr(type_node, 'name'):
                    distinct_operands.add(type_node.name)
                    total_operands += 1
            if hasattr(node, 'declarators'):
                for decl in node.declarators:
                    if hasattr(decl, 'name'):
                        distinct_operands.add(decl.name)
                        total_operands += 1
                    if hasattr(decl, 'initializer'):
                        walk(decl.initializer)

        elif isinstance(node, javalang.tree.MemberReference):
            if hasattr(node, 'member'):
                distinct_operands.add(node.member)
                total_operands += 1

        elif isinstance(node, javalang.tree.Literal):
            if hasattr(node, 'value'):
                val = str(node.value)
                distinct_operands.add(val)
                total_operands += 1

        elif isinstance(node, javalang.tree.ClassReference):
            if hasattr(node, 'name'):
                distinct_operands.add(node.name)
                total_operands += 1

        elif isinstance(node, javalang.tree.ClassDeclaration):
            distinct_operators.add("class")
            total_operators += 1
            if hasattr(node, 'name'):
                distinct_operands.add(node.name)
                total_operands += 1

        elif isinstance(node, javalang.tree.MethodDeclaration):
            distinct_operators.add("method")
            total_operators += 1
            if hasattr(node, 'name'):
                distinct_operands.add(node.name)
                total_operands += 1

        # Generic recursion for all tree nodes
        if isinstance(node, javalang.tree.Node):
            for child in node.children:
                if isinstance(child, javalang.tree.Node):
                    walk(child)
                elif isinstance(child, list):
                    for item in child:
                        if isinstance(item, javalang.tree.Node):
                            walk(item)

    walk(tree)

    metrics = HalsteadMetrics(
        n1=len(distinct_operators),
        N1=total_operators,
        n2=len(distinct_operands),
        N2=total_operands,
    )

    metrics.vocabulary = metrics.n1 + metrics.n2
    metrics.length = metrics.N1 + metrics.N2
    if metrics.vocabulary > 1 and metrics.length > 0:
        metrics.volume = metrics.length * math.log2(metrics.vocabulary)
        metrics.difficulty = (metrics.n1 * metrics.N2) / (2 * max(1, metrics.n2))
        metrics.effort = metrics.difficulty * metrics.volume

    return metrics


def _prepare_code(code: str) -> str:
    """Wrap bare methods in a class for javalang parsing."""
    code = code.strip()
    if not re.search(r'\bclass\s+\w+', code):
        code = f"class _W_ {{ {code} }}"
    return code
