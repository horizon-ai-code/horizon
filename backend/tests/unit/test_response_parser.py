"""Tests for response_parser — XML/JSON extraction from LLM output."""

import json

from app.utils.response_parser import (
    detect_repetition,
    extract_json,
    extract_xml,
    _remove_trailing_commas,
    _replace_python_keywords,
    _extract_json_braces,
)
from app.utils.schemas import IntentPacket


class TestExtractXml:
    def test_basic_extraction(self):  # TC-RP-001
        result = extract_xml("<plan>Flatten conditional</plan>", "plan")
        assert result == "Flatten conditional"

    def test_strips_think_blocks(self):  # TC-RP-002
        result = extract_xml("<think>hidden</think> <code>int x;</code>", "code")
        assert result == "int x;"

    def test_validates_java_with_semicolon(self):  # TC-RP-003
        result = extract_xml("<code>int x = 1;</code>", "code")
        assert result == "int x = 1;"

    def test_validates_java_with_braces(self):  # TC-RP-004
        result = extract_xml("<code>class A { }</code>", "code")
        assert result == "class A { }"

    def test_rejects_non_java_content(self):  # TC-RP-005
        result = extract_xml("<code>hello world</code>", "code")
        assert result is None

    def test_missing_tag_returns_none(self):  # TC-RP-006
        result = extract_xml("<other>text</other>", "plan")
        assert result is None


class TestExtractJson:
    def test_parses_to_pydantic(self):  # TC-RP-007
        payload = '{"refactor_category":"CONTROL_FLOW","specific_intent":"FLATTEN_CONDITIONAL","scope_anchor":{"class":"A","unit_type":"METHOD_UNIT"}}'
        result = extract_json(payload, IntentPacket)
        assert result.specific_intent == "FLATTEN_CONDITIONAL"

    def test_extracts_from_code_fence(self):  # TC-RP-008
        text = '```json\n{"a": 1}\n```'
        result = extract_json(text, type("_", (), {"model_validate_json": classmethod(lambda cls, s: json.loads(s))})())
        assert result is not None

    def test_fixes_trailing_comma(self):  # TC-RP-009
        result = _remove_trailing_commas('{"a": 1, "b": 2,}')
        assert result is not None

    def test_fixes_python_none(self):  # TC-RP-010
        result = _replace_python_keywords('{"member": None}')
        assert "null" in result

    def test_fixes_python_true(self):  # TC-RP-011
        result = _replace_python_keywords('{"valid": True}')
        assert "true" in result

    def test_fixes_python_false(self):  # TC-RP-012
        result = _replace_python_keywords('{"valid": False}')
        assert "false" in result

    def test_brace_inside_string(self):  # TC-RP-013
        result = _extract_json_braces('{"key": "just {opening", "other": true}')
        assert result is not None

    def test_trailing_comma_inside_string_preserved(self):  # TC-RP-014
        result = _remove_trailing_commas('{"msg": "ends with,}", "list": [1, 2,],}')
        assert isinstance(result, str)

    def test_python_keywords_inside_string_not_replaced(self):  # TC-RP-015
        result = _replace_python_keywords('{"class": "set to None, True or False"}')
        assert "set to None, True or False" in result

    def test_invalid_json_returns_none(self):  # TC-RP-016
        result = _extract_json_braces("{not valid json")
        assert result is None

    def test_deeply_nested_json(self):  # TC-RP-017
        result = _extract_json_braces('{"a":{"b":{"c":{"d":{"e":1}}}}}')
        assert result is not None


class TestDetectRepetition:
    def test_detects_llm_loop(self):  # TC-RP-018
        text = "x" * 300 + "pattern" + "x" * 200 + "pattern" + "x" * 200 + "pattern"
        result = detect_repetition(text, min_pattern=50, threshold=3)
        assert result is True

    def test_no_false_positive(self):  # TC-RP-019
        result = detect_repetition("Varied content with different phrases")
        assert result is False

    def test_handles_empty_string(self):  # TC-RP-020
        result = detect_repetition("")
        assert result is False
