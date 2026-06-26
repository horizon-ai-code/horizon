import { describe, it, expect } from 'vitest';
import { ErrorMessageSchema } from '@/lib/schemas/websocket';

describe('ErrorMessageSchema', () => {
  it('validates correct error', () => {  // TC-ZD-006
    const result = ErrorMessageSchema.parse({ type: 'error', message: 'Something went wrong' });
    expect(result.type).toBe('error');
  });
});
