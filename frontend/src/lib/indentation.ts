import { js_beautify } from 'js-beautify';

const INDENT = '    ';

const BEAUTIFY_OPTIONS = {
  indent_size: 4,
  indent_with_tabs: false,
  brace_style: 'collapse' as const,
  space_in_empty_paren: false,
  preserve_newlines: true,
  max_preserve_newlines: 2,
  jslint_happy: false,
  end_with_newline: false,
};

export function formatCode(raw: string): string {
  return js_beautify(raw, BEAUTIFY_OPTIONS);
}

function getLineStart(value: string, pos: number): number {
  return value.lastIndexOf('\n', pos - 1) + 1;
}

function getLineEnd(value: string, pos: number): number {
  const end = value.indexOf('\n', pos);
  return end === -1 ? value.length : end;
}

export interface IndentResult {
  value: string;
  cursor: number;
}

export function handleEnterKey(
  value: string,
  selectionStart: number,
  selectionEnd: number
): IndentResult {
  const lineStart = getLineStart(value, selectionStart);
  const currentLine = value.slice(lineStart, selectionStart);
  const indent = currentLine.match(/^[ \t]*/)?.[0] ?? '';

  const trimmed = currentLine.trimEnd();
  const endsWithBrace = trimmed.endsWith('{');

  if (endsWithBrace) {
    const restOfLine = value.slice(selectionEnd, getLineEnd(value, selectionEnd));
    const alreadyClosed = /^\s*}/.test(restOfLine) || restOfLine.includes('}');

    if (!alreadyClosed) {
      const insertion = `\n${indent}${INDENT}\n${indent}}`;
      return {
        value: value.slice(0, selectionEnd) + insertion + value.slice(selectionEnd),
        cursor: selectionEnd + 1 + indent.length + INDENT.length,
      };
    }
  }

  const insertion = `\n${indent}`;
  return {
    value: value.slice(0, selectionEnd) + insertion + value.slice(selectionStart),
    cursor: selectionStart + 1 + indent.length,
  };
}

export function handleTabKey(
  value: string,
  selectionStart: number,
  selectionEnd: number
): IndentResult {
  if (selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd),
      cursor: selectionStart + INDENT.length,
    };
  }

  const selected = value.slice(selectionStart, selectionEnd);
  const indented = INDENT + selected.replace(/\n/g, `\n${INDENT}`);
  const cursorAdjust = selected.includes('\n') ? 4 : 0;

  return {
    value: value.slice(0, selectionStart) + indented + value.slice(selectionEnd),
    cursor: selectionStart + INDENT.length + cursorAdjust,
  };
}

export function handleShiftTab(
  value: string,
  selectionStart: number,
  selectionEnd: number
): IndentResult {
  if (selectionStart === selectionEnd) {
    const lineStart = getLineStart(value, selectionStart);
    const beforeCursor = value.slice(lineStart, selectionStart);

    if (!/^[ \t]*$/.test(beforeCursor)) {
      return { value, cursor: selectionStart };
    }

    const lineContent = value.slice(lineStart, getLineEnd(value, selectionStart));
    const leading = lineContent.match(/^[ \t]*/)?.[0] ?? '';
    const removeCount = Math.min(4, leading.length);
    if (removeCount === 0) return { value, cursor: selectionStart };

    return {
      value: value.slice(0, lineStart) + value.slice(lineStart + removeCount),
      cursor: selectionStart - removeCount,
    };
  }

  const selected = value.slice(selectionStart, selectionEnd);
  const dedented = selected
    .split('\n')
    .map((line) => {
      const leading = line.match(/^[ \t]*/)?.[0] ?? '';
      const remove = Math.min(4, leading.length);
      return line.slice(remove);
    })
    .join('\n');

  return {
    value: value.slice(0, selectionStart) + dedented + value.slice(selectionEnd),
    cursor: selectionStart,
  };
}

export function handleClosingBrace(
  value: string,
  selectionStart: number
): IndentResult | null {
  const lineStart = getLineStart(value, selectionStart);
  const line = value.slice(lineStart, selectionStart);
  const currentIndent = line.match(/^[ \t]*/)?.[0] ?? '';
  const indentLevel = currentIndent.length / 4;
  if (indentLevel === 0) return null;

  let braceCount = 0;
  for (let i = 0; i < selectionStart - 1; i++) {
    if (value[i] === '{') braceCount++;
    if (value[i] === '}') braceCount--;
  }

  const expectedIndent = Math.max(0, braceCount) * 4;
  if (currentIndent.length <= expectedIndent) return null;

  const newIndent = ' '.repeat(expectedIndent);
  const newLine = newIndent + line.trimStart();
  return {
    value: value.slice(0, lineStart) + newLine + value.slice(selectionStart),
    cursor: selectionStart - (currentIndent.length - expectedIndent),
  };
}
