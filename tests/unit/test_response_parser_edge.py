"""Verification tests for response_parser.py changes."""
import unittest

from app.utils.response_parser import ResponseParser


class TestPlausibleJava(unittest.TestCase):
    def test_is_plausible_java_valid(self):
        """Valid Java snippets pass the plausibility check."""
        self.assertTrue(ResponseParser._is_plausible_java("public class A { void m() {} }"))
        self.assertTrue(ResponseParser._is_plausible_java("int x = 5;"))
        self.assertTrue(ResponseParser._is_plausible_java("if (a > b) { return true; }"))

    def test_is_plausible_java_invalid(self):
        """Non-Java snippets fail the plausibility check."""
        self.assertFalse(ResponseParser._is_plausible_java(""))
        self.assertFalse(ResponseParser._is_plausible_java("abc"))

    def test_plausible_gate_still_filters_xml(self):
        """The full extract_xml pipeline rejects non-Java content via the gate."""
        result = ResponseParser.extract_xml(
            '<code>  </code>', "code"
        )
        self.assertIsNone(result)


class TestExtractJsonBraces(unittest.TestCase):
    def test_extract_json_braces_nested(self):
        """Stack-based matching extracts outermost JSON with nested braces."""
        text = 'prefix {"outer": {"inner": "value"}} suffix'
        result = ResponseParser._extract_json_braces(text)
        self.assertEqual(result, '{"outer": {"inner": "value"}}')

    def test_extract_json_braces_no_brace(self):
        """When no brace exists, return None."""
        result = ResponseParser._extract_json_braces("no braces here")
        self.assertIsNone(result)

    def test_extract_json_braces_multiple_objects(self):
        """Only the first outermost JSON object is returned."""
        text = '{"first": 1} trailing {"second": 2}'
        result = ResponseParser._extract_json_braces(text)
        self.assertEqual(result, '{"first": 1}')


class TestCommentRegex(unittest.TestCase):
    def test_json_comment_regex_doesnt_strip_urls_in_strings(self):
        """extract_json_text preserves // inside string literals (e.g. URLs)."""
        text = '```json\n{"url": "http://example.com/path", "count": 5}\n```'
        raw = ResponseParser.extract_json_text(text)
        import json
        parsed = json.loads(raw)
        self.assertEqual(parsed["url"], "http://example.com/path")
        self.assertEqual(parsed["count"], 5)
