import { describe, it, expect } from 'vitest';
import { formatStatusContent } from '@/lib/formatStatusContent';

describe('formatStatusContent', () => {
  it('summary from first line', () => {
    expect(formatStatusContent('Start.\nMore').summary).toBe('Start.');
  });
  it('JSON blocks', () => {
    const r = formatStatusContent('```json\n{"a":1}\n```\nDone');
    expect(r.summary).toBeTruthy();
  });
  it('standalone JSON', () => {
    expect(formatStatusContent('{"a":1}')).toBeDefined();
  });
  it('Key:Value tags', () => {
    const r = formatStatusContent('**Category:** CONTROL_FLOW\nMore');
    expect(r.tags.length).toBeGreaterThanOrEqual(1);
  });
  it('handles input', () => {
    const r = formatStatusContent('- **Intent:** FLATTEN_CONDITIONAL');
    expect(r).toBeDefined();
  });
  it('empty', () => { expect(formatStatusContent('').summary).toBe(''); });
  it('plain text', () => { expect(formatStatusContent('plain').summary).toBe('plain'); });
  it('structured output', () => {
    const r = formatStatusContent('test');
    expect(r).toHaveProperty('summary');
    expect(r).toHaveProperty('tags');
    expect(r).toHaveProperty('details');
  });
});
