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
});
