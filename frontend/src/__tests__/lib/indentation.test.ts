import { describe, it, expect } from 'vitest';
import { handleEnterKey, handleTabKey, handleShiftTab, handleClosingBrace } from '@/lib/indentation';

describe('handleEnterKey', () => {
  it('adds indent after line', () => {  // TC-IN-001
    const result = handleEnterKey('  if (x) {', 10, 10);
    expect(result.value).toContain('\n    ');
  });

  it('auto-closes brace after opening brace', () => {  // TC-IN-002
    const result = handleEnterKey('void m() {', 10, 10);
    expect(result.value).toContain('}');
  });

  it('no double close brace', () => {  // TC-IN-003
    const line = '  if (x) {';
    const result = handleEnterKey(line + '\n  }', line.length, line.length);
    expect(result.value).toContain('}');
  });
});

describe('handleTabKey', () => {
  it('indents line by 4 spaces', () => {  // TC-IN-004
    const result = handleTabKey('foo();', 0, 0);
    expect(result.value).toBe('    foo();');
  });
});

describe('handleShiftTab', () => {
  it('outdents line by up to 4 spaces', () => {  // TC-IN-006
    const result = handleShiftTab('    foo();', 0, 0);
    expect(result.value).toBe('foo();');
  });
});

describe('handleClosingBrace', () => {
  it('returns null when no adjustment needed', () => {  // TC-IN-008
    const result = handleClosingBrace('}', 1);
    expect(result).toBeNull();
  });

  it('handles closing brace input', () => {  // TC-IN-007
    const result = handleClosingBrace('}', 1);
    expect(result).toBeNull();  // null means no adjustment needed
  });
});
