"""Tests for ResponseParser — XML/JSON extraction from LLM output."""

import json
import pytest
from app.utils.response_parser import ResponseParser, detect_repetition
from app.utils.schemas import IntentPacket


class TestExtractXml:
    def test_basic_extraction(self):
        result = ResponseParser.extract_xml("<plan>Flatten conditional</plan>", "plan")
        assert result == "Flatten conditional"

    def test_strips_think_blocks(self):
        result = ResponseParser.extract_xml("<think>hidden</think> <code>int x;</code>", "code")
        assert result == "int x;"

    def test_validates_java_with_semicolon(self):
        result = ResponseParser.extract_xml("<code>int x = 1;</code>", "code")
        assert result == "int x = 1;"

    def test_validates_java_with_braces(self):
        result = ResponseParser.extract_xml("<code>class A { }</code>", "code")
        assert result == "class A { }"

    def test_rejects_non_java_content(self):
        result = ResponseParser.extract_xml("<code>hello world</code>", "code")
        assert result is None

    def test_missing_tag_returns_none(self):
        result = ResponseParser.extract_xml("<other>text</other>", "plan")
        assert result is None


class TestExtractJson:
    def test_parses_to_pydantic(self):
        payload = '{"refactor_category":"CONTROL_FLOW","specific_intent":"FLATTEN_CONDITIONAL","scope_anchor":{"class":"A","unit_type":"METHOD_UNIT"}}'
        result = ResponseParser.extract_json(payload, IntentPacket)
        assert result.specific_intent == "FLATTEN_CONDITIONAL"

    def test_extracts_from_code_fence(self):
        text = '```json\n{"a": 1}\n```'
        result = ResponseParser.extract_json_text(text)
        assert json.loads(result) == {"a": 1}

    def test_fixes_trailing_comma(self):
        text = '{"a": 1, "b": 2,}'
        result = ResponseParser.extract_json_text(text)
        assert isinstance(result, str)

    def test_fixes_python_none(self):
        result = ResponseParser._replace_python_keywords('{"member": None}')
        assert "null" in result

    def test_fixes_python_true(self):
        result = ResponseParser._replace_python_keywords('{"valid": True}')
        assert "true" in result

    def test_fixes_python_false(self):
        result = ResponseParser._replace_python_keywords('{"valid": False}')
        assert "false" in result

    def test_brace_inside_string(self):
        text = '{"key": "just {opening", "other": true}'
        result = ResponseParser.extract_json_text(text)
        assert result is not None

    def test_trailing_comma_inside_string_preserved(self):
        text = '{"msg": "ends with,}", "list": [1, 2,],}'
        result = ResponseParser.extract_json_text(text)
        assert isinstance(result, str)

    def test_python_keywords_inside_string_not_replaced(self):
        text = '{"class": "set to None, True or False"}'
        result = ResponseParser._replace_python_keywords(text)
        assert "set to None, True or False" in result

    def test_invalid_json_returns_none(self):
        result = ResponseParser._extract_json_braces("{not valid json")
        assert result is None

    def test_deeply_nested_json(self):
        text = '{"a":{"b":{"c":{"d":{"e":1}}}}}'
        result = ResponseParser._extract_json_braces(text)
        assert result is not None


class TestDetectRepetition:
    def test_detects_llm_loop(self):
        text = "x" * 300 + "pattern" + "x" * 200 + "pattern" + "x" * 200 + "pattern"
        result = detect_repetition(text, min_pattern=50, threshold=3)
        assert result is True

    def test_no_false_positive(self):
        text = "Varied content with different phrases"
        result = detect_repetition(text)
        assert result is False

    def test_handles_empty_string(self):
        result = detect_repetition("")
        assert result is False
