import { describe, it, expect } from 'vitest';
import { formatStatusContent } from '@/lib/formatStatusContent';

describe('formatStatusContent', () => {
  it('returns summary from first line', () => {
    const r = formatStatusContent('Starting analysis.\nMore details here');
    expect(r.summary).toBe('Starting analysis.');
  });

  it('handles empty input', () => {
    const r = formatStatusContent('');
    expect(r.summary).toBe('');
  });

  it('handles plain text', () => {
    const r = formatStatusContent('plain text');
    expect(r.summary).toBe('plain text');
  });

  it('returns structured output', () => {
    const r = formatStatusContent('Starting analysis.');
    expect(r).toHaveProperty('summary');
    expect(r).toHaveProperty('tags');
    expect(r).toHaveProperty('details');
  });
});
