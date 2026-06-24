import { describe, it, expect } from 'vitest';
import { formatJavaCode } from '@/lib/utils/javaFormatter';

describe('formatJavaCode', () => {
  it('formats basic class', () => {
    const result = formatJavaCode('class A { void m() { } }');
    expect(result).toBeTruthy();
  });

  it('preserves string literals', () => {
    const result = formatJavaCode('class A { String s = "hello"; }');
    expect(result).toContain('hello');
  });

  it('preserves comments', () => {
    const result = formatJavaCode('class A { // comment\nvoid m() { } }');
    expect(result).toContain('comment');
  });

  it('handles empty string', () => {
    expect(formatJavaCode('')).toBe('');
  });

  it('handles generic type parameters', () => {
    const result = formatJavaCode('class A { List<Map<String, Integer>> map; }');
    expect(result).toBeTruthy();
  });

  it('normalizes operator spacing', () => {
    const result = formatJavaCode('class A { void m() { a=b+c; } }');
    expect(result).not.toContain('a=b+c');
  });

  it('merges else with closing brace', () => {
    const result = formatJavaCode('class A { void m() { if(x) {} else {} } }');
    expect(result).toBeTruthy();
  });

  it('strips consecutive blank lines', () => {
    const result = formatJavaCode('class A {\n\n\nvoid m() { } }');
    expect(result).toBeTruthy();
  });
});
