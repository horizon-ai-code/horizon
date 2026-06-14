import re
from typing import Any, TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def detect_repetition(text: str, min_pattern: int = 80, threshold: int = 3) -> bool:
    """Detect if the model is stuck in a generation loop.

    Strips trailing structural characters (closing brackets, braces, commas)
    then counts non-overlapping occurrences of the last min_pattern characters.
    If they appear >= threshold times, the model is repeating itself.
    """
    if len(text) < min_pattern * threshold:
        return False
    clean = text.rstrip(" \n\r\t]},>")
    if len(clean) < min_pattern * threshold:
        return False
    return clean.count(clean[-min_pattern:]) >= threshold


class ResponseParser:
    @staticmethod
    def _is_plausible_java(text: str) -> bool:
        """Quick check: does the text look like Java code?

        Tries javalang parse first, falls back to checking for keywords.
        """
        if len(text) < 5:
            return False
        # Quick check: must have { or ; to be statement-level Java
        if "{" not in text and ";" not in text:
            return False
        # Try javalang parse on snippets that are likely complete
        try:
            import javalang
            wrapped = f"class _W_ {{ {text} }}" if "class" not in text[:100] else text
            javalang.parse.parse(wrapped)
            return True
        except Exception:
            pass
        return True  # Accept if javalang fails — the gates below catch syntax

    @staticmethod
    def _iter_string_aware(text: str, start: int = 0):
        """Yield (index, char, in_string) for each char, tracking string context."""
        in_string = False
        escape = False
        for i in range(start, len(text)):
            c = text[i]
            if escape:
                escape = False
                yield i, c, in_string
                continue
            if c == '\\':
                escape = True
                yield i, c, in_string
                continue
            if c == '"':
                in_string = not in_string
            yield i, c, in_string

    @staticmethod
    def _replace_python_keywords(json_str: str) -> str:
        """Replace Python None/True/False outside string boundaries only.

        Uses manual iteration to track string context, preventing
        corruption of string values like 'set to None'.
        """
        parts = []
        i = 0
        in_str = False
        escape = False
        while i < len(json_str):
            c = json_str[i]
            if escape:
                escape = False
                parts.append(c)
                i += 1
                continue
            if c == '\\':
                escape = True
                parts.append(c)
                i += 1
                continue
            if c == '"':
                in_str = not in_str
                parts.append(c)
                i += 1
                continue
            if in_str:
                parts.append(c)
                i += 1
                continue
            # Outside string — check for keywords
            for kw, replacement in [("None", "null"), ("True", "true"), ("False", "false")]:
                if json_str[i:i+len(kw)] == kw and \
                   (i == 0 or not json_str[i-1].isalnum()) and \
                   (i+len(kw) >= len(json_str) or not json_str[i+len(kw)].isalnum()):
                    parts.append(replacement)
                    i += len(kw)
                    break
            else:
                parts.append(c)
                i += 1
        return "".join(parts)

    @staticmethod
    def _extract_json_braces(text: str) -> str | None:
        """Extract outermost JSON object using brace-depth counting.

        Handles nested braces correctly unlike simple find/rfind.
        Tracks string state to avoid miscounting braces inside strings.
        """
        start = text.find("{")
        if start == -1:
            return None
        depth = 0
        for i, c, in_str in ResponseParser._iter_string_aware(text, start):
            if in_str:
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return text[start:i + 1]
        return None

    @staticmethod
    def extract_xml(text: str | None, tag: str) -> str | None:
        """Extracts content between XML-style tags and performs basic syntax validation for Java."""
        if text is None:
            return None
        # Strip thinking blocks first
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)

        # Strip preamble before first <code> tag (for model that talks before generating)
        if tag == "code":
            first = text.find(f"<{tag}")
            if first > 0:
                text = text[first:]

        pattern = rf"<{tag}\b[^>]*>(.*?)</{tag}>"
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)

        if match:
            content = match.group(1).strip()
            # Basic Java syntax validation if it's a 'code' tag
            if tag == "code":
                if not ResponseParser._is_plausible_java(content):
                    return None
            return content
        return None

    @staticmethod
    def extract_json(text: str | None, model: type[T]) -> T:
        """Extracts and validates JSON from text, even if wrapped in markdown blocks."""
        if text is None:
            raise ValueError("Cannot extract JSON from None")

        # Strip thinking blocks
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)

        # Look for json code blocks
        json_block_pattern = r"```json\s*(.*?)\s*```"
        match = re.search(json_block_pattern, text, re.DOTALL | re.IGNORECASE)

        json_str = ""
        if match:
            json_str = match.group(1).strip()
        else:
            extracted = ResponseParser._extract_json_braces(text)
            if extracted:
                json_str = extracted.strip()
            else:
                raise ValueError("No JSON found in response")

        # Strip single-line comments (//...) that break JSON parsing
        json_str = re.sub(r'(?<![:"\w])//.*$', '', json_str, flags=re.MULTILINE)

        # Fix Python-isms (None -> null, True -> true, False -> false)
        # String-aware to avoid corrupting values like "set to None"
        json_str = ResponseParser._replace_python_keywords(json_str)

        # Proactively remove trailing commas before closing braces/brackets
        cleaned_json = ResponseParser._remove_trailing_commas(json_str)
        return model.model_validate_json(cleaned_json)

    @staticmethod
    def _remove_trailing_commas(json_str: str) -> str:
        """Remove trailing commas before ] or } but not inside strings."""
        result = []
        skip_until = -1
        for i, c, in_str in ResponseParser._iter_string_aware(json_str):
            if i <= skip_until:
                continue
            if in_str:
                result.append(c)
                continue
            if c == ',':
                j = i + 1
                while j < len(json_str) and json_str[j] in ' \t\n\r':
                    j += 1
                if j < len(json_str) and json_str[j] in ']}':
                    skip_until = j
                    result.append(json_str[j])
                    continue
            result.append(c)
        return ''.join(result)

    @staticmethod
    def extract_json_text(text: str | None) -> str:
        """Extracts raw JSON string from text, stripping markdown blocks and thinking tags."""
        if text is None:
            return "{}"
        # Strip thinking blocks
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
        # Look for json code blocks
        json_block_pattern = r"```json\s*(.*?)\s*```"
        match = re.search(json_block_pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            return match.group(1).strip()
        # Try to find the first '{' and last '}' via stack-based matching
        extracted = ResponseParser._extract_json_braces(text)
        if extracted:
            return extracted.strip()
        return "{}"

    @staticmethod
    def parse_guaranteed(text: str | None, tag: str, model: type[T] | None = None) -> Any:
        """
        Tries to extract XML first, then JSON if model is provided.
        Falls back to raw text (minus thinking) if nothing else works.
        """
        if text is None:
            return ""

        # 1. Try XML
        xml_content = ResponseParser.extract_xml(text, tag)
        if xml_content:
            if model:
                try:
                    return ResponseParser.extract_json(xml_content, model)
                except Exception:
                    return xml_content # Return raw XML content if JSON parse fails
            return xml_content

        # 2. Try JSON directly in the text if model provided
        if model:
            try:
                return ResponseParser.extract_json(text, model)
            except Exception:
                pass

        # 3. Fallback: Return text without thoughts
        return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()
