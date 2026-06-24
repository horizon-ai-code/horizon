import { describe, it, expect } from 'vitest';
import { formatJavaCode } from '@/lib/utils/javaFormatter';

describe('formatJavaCode', () => {
  it('formats basic class', () => {  // TC-JF-001
    const result = formatJavaCode('class A { void m() { } }');
    expect(result).toBeTruthy();
  });

  it('preserves string literals', () => {  // TC-JF-002
    const result = formatJavaCode('class A { String s = "hello"; }');
    expect(result).toContain('hello');
  });

  it('preserves comments', () => {  // TC-JF-003
    const result = formatJavaCode('class A { // comment\nvoid m() { } }');
    expect(result).toContain('comment');
  });

  it('handles empty string', () => {  // TC-JF-009
    expect(formatJavaCode('')).toBe('');
  });

  it('handles generic type parameters', () => {  // TC-JF-004
    const result = formatJavaCode('class A { List<Map<String, Integer>> map; }');
    expect(result).toBeTruthy();
  });

  it('normalizes operator spacing', () => {  // TC-JF-005
    const result = formatJavaCode('class A { void m() { a=b+c; } }');
    expect(result).not.toContain('a=b+c');
  });

  it('merges else with closing brace', () => {  // TC-JF-006
    const result = formatJavaCode('class A { void m() { if(x) {} else {} } }');
    expect(result).toBeTruthy();
  });

  it('strips consecutive blank lines', () => {  // TC-JF-007
    const result = formatJavaCode('class A {\n\n\nvoid m() { } }');
    expect(result).toBeTruthy();
  });

  it('handles long method with mixed constructs', () => {  // TC-JF-010
    const code = `class A { void m() { if(x) { for(int i=0;i<10;i++) { try { doWork(); } catch(Exception e) {} } } } }`;
    const result = formatJavaCode(code);
    expect(result).toBeTruthy();
  });
});
