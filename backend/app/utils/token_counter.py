from typing import Any


def count_tokens(chunks: list[dict[str, Any]], content: str) -> int:
    for chunk in reversed(chunks):
        usage = chunk.get("usage")
        if usage:
            tokens = usage.get("completion_tokens")
            if tokens:
                return tokens
    return len(content) // 4
