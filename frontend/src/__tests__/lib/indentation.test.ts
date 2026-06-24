import { describe, it, expect } from 'vitest';
import { handleEnterKey, handleTabKey, handleShiftTab, handleClosingBrace } from '@/lib/indentation';

describe('handleEnterKey', () => {
  it('adds indent after line', () => {
    const result = handleEnterKey('  if (x) {', 10, 10);
    expect(result.value).toContain('\n    ');
  });
});

describe('handleTabKey', () => {
  it('indents line by 4 spaces', () => {
    const result = handleTabKey('foo();', 0, 0);
    expect(result.value).toBe('    foo();');
  });
});

describe('handleShiftTab', () => {
  it('outdents line by up to 4 spaces', () => {
    const result = handleShiftTab('    foo();', 0, 0);
    expect(result.value).toBe('foo();');
  });
});

describe('handleClosingBrace', () => {
  it('returns null when no adjustment needed', () => {
    const result = handleClosingBrace('}', 1);
    expect(result).toBeNull();
  });
});
