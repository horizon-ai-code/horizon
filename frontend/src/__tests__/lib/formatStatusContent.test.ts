import { describe, it, expect } from 'vitest';
import { formatStatusContent } from '@/lib/formatStatusContent';

describe('formatStatusContent', () => {
  it('returns summary from first line', () => {
    expect(formatStatusContent('Start.\nMore').summary).toBe('Start.');
  });
  it('detects JSON blocks', () => {
    const r = formatStatusContent('```json\n{"a":1}\n```\nDone');
    expect(r.summary).toBeTruthy();
  });
  it('detects standalone JSON', () => {
    const r = formatStatusContent('{"a":1}');
    expect(r).toBeDefined();
  });
  it('extracts Key:Value tags', () => {
    const r = formatStatusContent('**Category:** CONTROL_FLOW\nMore');
    expect(r.tags.length).toBeGreaterThanOrEqual(1);
  });
  it('handles empty', () => { expect(formatStatusContent('').summary).toBe(''); });
  it('handles plain text', () => { expect(formatStatusContent('plain').summary).toBe('plain'); });
  it('returns structured output', () => {
    const r = formatStatusContent('test');
    expect(r).toHaveProperty('summary');
    expect(r).toHaveProperty('tags');
    expect(r).toHaveProperty('details');
  });
});
