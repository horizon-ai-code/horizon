"""Verification tests for validator.py changes.

Covers: get_hash removed, import stripping regex fix.
"""
import unittest
from app.modules.validator import ASTWalker, Validator


class TestDeadCodeRemoved(unittest.TestCase):
    def test_get_hash_not_available(self):
        """get_hash was deleted; verify it doesn't exist on ASTWalker."""
        with self.assertRaises(AttributeError):
            ASTWalker.get_hash


class TestImportStripping(unittest.TestCase):
    def setUp(self):
        self.validator = Validator()

    def test_import_stripping_preserves_strings(self):
        """Import stripping regex doesn't match inside string literals."""
        code = '''class A {
    String query = "select import from table";
    void m() {}
}'''
        result = self.validator.check_syntax(code)
        self.assertTrue(result["is_valid"])
