import { describe, it, expect } from 'vitest';
import {
  handleEnterKey,
  handleTabKey,
  handleShiftTab,
  handleClosingBrace,
  formatCode,
} from '@/lib/indentation';

describe('handleEnterKey', () => {
  it('inserts newline with matching indent from previous line', () => {
    const { value, cursor } = handleEnterKey('    int x = 1;', 14, 14);
    expect(value).toBe('    int x = 1;\n    ');
    expect(cursor).toBe(19);
  });

  it('handles empty input', () => {
    const { value, cursor } = handleEnterKey('', 0, 0);
    expect(value).toBe('\n');
    expect(cursor).toBe(1);
  });

  it('auto-closes brace and indents body', () => {
    const { value } = handleEnterKey('if (x) {', 8, 8);
    expect(value).toBe('if (x) {\n    \n}');
  });

  it('places cursor inside the brace block', () => {
    const { cursor } = handleEnterKey('if (x) {', 8, 8);
    expect(cursor).toBe(13);
  });

  it('does not double-close if } already on same line', () => {
    const { value } = handleEnterKey('int[] a = {1, 2, 3};', 20, 20);
    expect(value).toBe('int[] a = {1, 2, 3};\n');
  });

  it('handles mid-line enter (splits line)', () => {
    const { value, cursor } = handleEnterKey('foo bar baz', 4, 4);
    expect(value).toBe('foo \nbar baz');
    expect(cursor).toBe(5);
  });

  it('preserves indent with tabs', () => {
    const { value } = handleEnterKey('\t\tint x = 1;', 12, 12);
    expect(value).toBe('\t\tint x = 1;\n\t\t');
  });

  it('handles nested braces', () => {
    const { value } = handleEnterKey('    if (x) {', 12, 12);
    expect(value).toBe('    if (x) {\n        \n    }');
  });
});

describe('handleTabKey', () => {
  it('inserts 4 spaces at cursor (no selection)', () => {
    const { value, cursor } = handleTabKey('int x;', 0, 0);
    expect(value).toBe('    int x;');
    expect(cursor).toBe(4);
  });

  it('inserts 4 spaces mid-line', () => {
    const { value, cursor } = handleTabKey('intx;', 3, 3);
    expect(value).toBe('int    x;');
    expect(cursor).toBe(7);
  });

  it('indents all selected lines by 4', () => {
    const { value } = handleTabKey('a\nb\nc', 0, 5);
    expect(value).toBe('    a\n    b\n    c');
  });

  it('preserves partial line selection indent', () => {
    const { value } = handleTabKey('ab\ncd', 0, 2);
    expect(value).toBe('    ab\ncd');
  });
});

describe('handleShiftTab', () => {
  it('removes up to 4 spaces from line start', () => {
    const { value, cursor } = handleShiftTab('        int x;', 8, 8);
    expect(value).toBe('    int x;');
    expect(cursor).toBe(4);
  });

  it('removes only what is available', () => {
    const { value, cursor } = handleShiftTab('  int x;', 2, 2);
    expect(value).toBe('int x;');
    expect(cursor).toBe(0);
  });

  it('does nothing on empty indent', () => {
    const { value, cursor } = handleShiftTab('int x;', 0, 0);
    expect(value).toBe('int x;');
    expect(cursor).toBe(0);
  });

  it('does nothing if cursor is not at indent boundary', () => {
    const { value, cursor } = handleShiftTab('    int x;', 6, 6);
    expect(value).toBe('    int x;');
    expect(cursor).toBe(6);
  });

  it('dedents all selected lines', () => {
    const { value } = handleShiftTab('    a\n    b\n    c', 0, 17);
    expect(value).toBe('a\nb\nc');
  });

  it('dedents mixed-indent selected lines', () => {
    const { value } = handleShiftTab('        a\n    b', 0, 14);
    expect(value).toBe('    a\nb');
  });
});

describe('handleClosingBrace', () => {
  it('dedents over-indented closing brace', () => {
    const { value, cursor } = handleClosingBrace(
      'if (x) {\n        }\n',
      'if (x) {\n        }'.length
    )!;
    expect(value).toBe('if (x) {\n    }\n');
    expect(cursor).toBeGreaterThan(0);
  });

  it('returns null when already correctly indented', () => {
    const result = handleClosingBrace(
      'if (x) {\n    }\n',
      'if (x) {\n    }'.length
    );
    expect(result).toBeNull();
  });

  it('returns null when no indent to remove', () => {
    const result = handleClosingBrace('}\n', 1);
    expect(result).toBeNull();
  });

  it('handles nested braces correctly', () => {
    const { value } = handleClosingBrace(
      'if (x) {\n    if (y) {\n            }\n    }\n',
      'if (x) {\n    if (y) {\n            }'.length
    )!;
    expect(value).toBe('if (x) {\n    if (y) {\n        }\n    }\n');
  });
});

describe('formatCode', () => {
  it('returns empty for empty input', () => {
    expect(formatCode('')).toBe('');
  });

  it('indents lines inside braces', () => {
    const result = formatCode('public class Foo {\npublic void bar() {\n// code\n}\n}');
    expect(result).toBe('public class Foo {\n    public void bar() {\n        // code\n    }\n}');
  });

  it('handles already partially indented input', () => {
    const result = formatCode('if (x) {\n  doThing();\n}');
    expect(result).toBe('if (x) {\n    doThing();\n}');
  });

  it('strips existing inconsistent indentation', () => {
    const result = formatCode('{\n        x = 1;\n  y = 2;\n}');
    expect(result).toBe('{\n    x = 1;\n    y = 2;\n}');
  });

  it('handles } else { pattern', () => {
    const result = formatCode('if (x) {\nfoo();\n} else {\nbar();\n}');
    expect(result).toBe('if (x) {\n    foo();\n} else {\n    bar();\n}');
  });

  it('handles } catch (Exception e) { pattern', () => {
    const result = formatCode('try {\nx();\n} catch (Exception e) {\ny();\n}');
    expect(result).toBe('try {\n    x();\n} catch (Exception e) {\n    y();\n}');
  });

  it('preserves single-line brace constructs', () => {
    const result = formatCode('int[] a = {1, 2, 3};\nint x = 1;');
    expect(result).toBe('int[] a = {\n    1,\n    2,\n    3\n};\nint x = 1;');
  });

  it('preserves empty lines', () => {
    const result = formatCode('a = 1;\n\nb = 2;');
    expect(result).toBe('a = 1;\n\nb = 2;');
  });

  it('handles deeply nested code', () => {
    const result = formatCode('class X {\nvoid a() {\nif (x) {\nwhile (y) {\ndo();\n}\n}\n}\n}');
    expect(result).toBe(
      'class X {\n    void a() {\n        if (x) {\n            while (y) {\n                do();\n            }\n        }\n    }\n}'
    );
  });
});
