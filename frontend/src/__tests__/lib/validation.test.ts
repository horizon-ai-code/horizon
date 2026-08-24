import { describe, it, expect } from "vitest";
import {
  validateSubmission,
  CODE_MIN_LENGTH,
  CODE_MAX_LENGTH,
  INSTRUCTION_MIN_LENGTH,
  INSTRUCTION_MAX_LENGTH,
} from "@/lib/validation";

const VALID_CODE = "class A { void m() {} }";
const VALID_INSTRUCTION = "refactor this";

describe("validateSubmission", () => {
  it("passes for valid input", () => {
    const e = validateSubmission(VALID_CODE, VALID_INSTRUCTION);
    expect(e.source).toBeNull();
    expect(e.instruction).toBeNull();
  });

  it("rejects empty source", () => {
    expect(validateSubmission("", VALID_INSTRUCTION).source).toMatch(/required/i);
    expect(validateSubmission("   \n  ", VALID_INSTRUCTION).source).toMatch(/required/i);
  });

  it("rejects source under minimum length", () => {
    expect(validateSubmission("class A", VALID_INSTRUCTION).source).toContain(String(CODE_MIN_LENGTH));
  });

  it("rejects source over maximum length", () => {
    const big = "a".repeat(CODE_MAX_LENGTH + 1);
    expect(validateSubmission(big, VALID_INSTRUCTION).source).toMatch(/exceeds maximum/i);
  });

  it("accepts source at exactly max length", () => {
    const edge = "a".repeat(CODE_MAX_LENGTH);
    expect(validateSubmission(edge, VALID_INSTRUCTION).source).toBeNull();
  });

  it("rejects empty instruction", () => {
    expect(validateSubmission(VALID_CODE, "").instruction).toMatch(/required/i);
  });

  it("rejects instruction under minimum length", () => {
    expect(validateSubmission(VALID_CODE, "ab").instruction).toContain(String(INSTRUCTION_MIN_LENGTH));
  });

  it("accepts instruction at exactly min length", () => {
    expect(validateSubmission(VALID_CODE, "abc").instruction).toBeNull();
  });

  it("rejects instruction over maximum length", () => {
    const big = "a".repeat(INSTRUCTION_MAX_LENGTH + 1);
    expect(validateSubmission(VALID_CODE, big).instruction).toMatch(/exceeds maximum/i);
  });

  it("validates fields independently", () => {
    const e = validateSubmission("", "ab");
    expect(e.source).not.toBeNull();
    expect(e.instruction).not.toBeNull();
    const ok = validateSubmission(VALID_CODE, "");
    expect(ok.source).toBeNull();
  });
});
