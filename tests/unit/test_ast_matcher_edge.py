"""Verification tests for ast_matcher.py changes.

Covers: _find_method_body bug fix (was crashing on multi-item trees).
"""
import unittest

from app.utils.ast_matcher import ASTMatcher


class TestFindMethodBody(unittest.TestCase):
    def test_find_method_body_in_wrapped_code(self):
        """When code has no 'class' keyword, wrapping applies and method is found."""
        code = "void myMethod() { int x = 1; }"
        body = ASTMatcher._find_method_body(code, "myMethod")
        self.assertIsNotNone(body)
        self.assertIn("myMethod", body)

    def test_find_method_body_nonexistent(self):
        """When method doesn't exist, return None instead of crashing."""
        code = "void realMethod() { }"
        body = ASTMatcher._find_method_body(code, "fakeMethod")
        self.assertIsNone(body)
