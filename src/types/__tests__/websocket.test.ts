import { describe, it, expect } from 'vitest';
import type { SingleRequest } from '@/types/websocket';

describe('SingleRequest type', () => {
  it('can be constructed with required fields', () => {
    const req: SingleRequest = {
      type: "single",
      code: "public class Test {}",
      user_instruction: "Extract method",
    };
    expect(req.type).toBe("single");
    expect(req.code).toBe("public class Test {}");
    expect(req.user_instruction).toBe("Extract method");
  });
});
