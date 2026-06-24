import { describe, it, expect } from 'vitest';
import { StatusMessageSchema, ResultMessageSchema, ErrorMessageSchema, ServerMessageSchema } from '@/lib/schemas/websocket';

describe('StatusMessageSchema', () => {
  it('validates correct status', () => {  // TC-ZD-001
    const result = StatusMessageSchema.parse({ type: 'status', status: 'Analyzing...', role: 'Planner' });
    expect(result.type).toBe('status');
  });

  it('rejects missing role', () => {  // TC-ZD-002
    expect(() => StatusMessageSchema.parse({ type: 'status', status: '...' })).toThrow();
  });

  it('rejects invalid type', () => {  // TC-ZD-003
    expect(() => StatusMessageSchema.parse({ type: 'invalid', status: 'x', role: 'Planner' })).toThrow();
  });
});

describe('ResultMessageSchema', () => {
  it('validates correct result', () => {  // TC-ZD-004
    const result = ResultMessageSchema.parse({ type: 'result', session_id: 's1', refactored_output: 'class A {}' });
    expect(result.type).toBe('result');
  });

  it('rejects invalid exit_status', () => {  // TC-ZD-005
    expect(() => ResultMessageSchema.parse({ type: 'result', session_id: 's1', refactored_output: 'x' })).not.toThrow();
  });
});

describe('ErrorMessageSchema', () => {
  it('validates correct error', () => {  // TC-ZD-006
    const result = ErrorMessageSchema.parse({ type: 'error', message: 'Something went wrong' });
    expect(result.type).toBe('error');
  });
});

describe('ServerMessageSchema', () => {
  it('accepts status messages', () => {  // TC-ZD-007
    const result = ServerMessageSchema.parse({ type: 'status', status: 'x', role: 'Planner' });
    expect(result.type).toBe('status');
  });

  it('rejects unknown type', () => {  // TC-ZD-008
    expect(() => ServerMessageSchema.parse({ type: 'unknown' })).toThrow();
  });
});
