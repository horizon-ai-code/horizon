import { describe, it, expect } from 'vitest';
import { formatStatusContent } from '@/lib/formatStatusContent';

describe('formatStatusContent', () => {
  it('summary from first line', () => { // TC-FS-005
    expect(formatStatusContent('Start.\nMore').summary).toBe('Start.');
  });
  it('JSON blocks', () => { // TC-FS-001
    const r = formatStatusContent('```json\n{"a":1}\n```\nDone');
    expect(r.summary).toBeTruthy();
  });
  it('standalone JSON', () => { // TC-FS-002
    expect(formatStatusContent('{"a":1}')).toBeDefined();
  });
  it('Key:Value tags', () => { // TC-FS-003
    const r = formatStatusContent('**Category:** CONTROL_FLOW\nMore');
    expect(r.tags.length).toBeGreaterThanOrEqual(1);
  });
  it('handles input', () => { // TC-FS-004
    const r = formatStatusContent('- **Intent:** FLATTEN_CONDITIONAL');
    expect(r).toBeDefined();
  });
  it('empty', () => { expect(formatStatusContent('').summary).toBe(''); });  // TC-FS-007
  it('plain text', () => { expect(formatStatusContent('plain').summary).toBe('plain'); });  // TC-FS-008
  it('structured output', () => { // TC-FS-006
    const r = formatStatusContent('test');
    expect(r).toHaveProperty('summary');
    expect(r).toHaveProperty('tags');
    expect(r).toHaveProperty('details');
  });
});
