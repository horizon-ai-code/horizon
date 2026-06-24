import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {  // TC-CN-001
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters falsy values', () => {  // TC-CN-002
    expect(cn('foo', false, 'bar', undefined, null, 'baz')).toBe('foo bar baz');
  });

  it('handles conditional objects', () => {  // TC-CN-003
    expect(cn('base', { active: true, disabled: false })).toBe('base active');
  });

  it('resolves tailwind conflicts via twMerge', () => {  // TC-CN-004
    expect(cn('px-4', 'px-2')).toBe('px-2');
  });

  it('returns empty string for no args', () => {  // TC-CN-005
    expect(cn()).toBe('');
  });

  it('handles arrays', () => {  // TC-CN-006
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });
});
