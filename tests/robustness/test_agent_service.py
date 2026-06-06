"""Verification tests for agent_service.py changes.

Covers: _count_tokens fallback (len//4 instead of word count).
"""
import unittest
from app.modules.agent_service import AgentService


class TestCountTokens(unittest.TestCase):
    def test_count_tokens_from_usage(self):
        """When chunk has usage data, use completion_tokens."""
        chunks = [
            {"usage": {"completion_tokens": 42}},
        ]
        count = AgentService._count_tokens(chunks, "some content")
        self.assertEqual(count, 42)

    def test_count_tokens_fallback(self):
        """When no usage data, use len(content) // 4."""
        content = "x" * 100
        count = AgentService._count_tokens([], content)
        self.assertEqual(count, 25)
