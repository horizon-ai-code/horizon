import { describe, it, expect } from 'vitest';
import { StatusMessageSchema, ResultMessageSchema, ErrorMessageSchema, ServerMessageSchema } from '@/lib/schemas/websocket';

describe('StatusMessageSchema', () => {
  it('validates correct status', () => {
    const result = StatusMessageSchema.parse({ type: 'status', status: 'Analyzing...', role: 'Planner' });
    expect(result.type).toBe('status');
  });

  it('rejects missing role', () => {
    expect(() => StatusMessageSchema.parse({ type: 'status', status: '...' })).toThrow();
  });

  it('rejects invalid type', () => {
    expect(() => StatusMessageSchema.parse({ type: 'invalid', status: 'x', role: 'Planner' })).toThrow();
  });
});

describe('ResultMessageSchema', () => {
  it('validates correct result', () => {
    const result = ResultMessageSchema.parse({ type: 'result', session_id: 's1', refactored_output: 'class A {}' });
    expect(result.type).toBe('result');
  });

  it('rejects invalid exit_status', () => {
    expect(() => ResultMessageSchema.parse({ type: 'result', session_id: 's1', refactored_output: 'x' })).not.toThrow();
  });
});

describe('ErrorMessageSchema', () => {
  it('validates correct error', () => {
    const result = ErrorMessageSchema.parse({ type: 'error', message: 'Something went wrong' });
    expect(result.type).toBe('error');
  });
});

describe('ServerMessageSchema', () => {
  it('accepts status messages', () => {
    const result = ServerMessageSchema.parse({ type: 'status', status: 'x', role: 'Planner' });
    expect(result.type).toBe('status');
  });

  it('rejects unknown type', () => {
    expect(() => ServerMessageSchema.parse({ type: 'unknown' })).toThrow();
  });
});
