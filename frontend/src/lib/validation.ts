export const CODE_MIN_LENGTH = 10;
export const CODE_MAX_LENGTH = 100_000;
export const INSTRUCTION_MIN_LENGTH = 3;
export const INSTRUCTION_MAX_LENGTH = 10_000;

export interface SubmissionErrors {
  source: string | null;
  instruction: string | null;
}

export function validateSubmission(
  sourceCode: string,
  instruction: string
): SubmissionErrors {
  const errors: SubmissionErrors = { source: null, instruction: null };

  if (!sourceCode.trim()) {
    errors.source = "Source code is required.";
  } else if (sourceCode.length > CODE_MAX_LENGTH) {
    errors.source = `Code exceeds maximum length of ${CODE_MAX_LENGTH.toLocaleString()} characters.`;
  } else if (sourceCode.trim().length < CODE_MIN_LENGTH) {
    errors.source = `Code must be at least ${CODE_MIN_LENGTH} characters.`;
  }

  if (!instruction.trim()) {
    errors.instruction = "Refactoring instruction is required.";
  } else if (instruction.length > INSTRUCTION_MAX_LENGTH) {
    errors.instruction = `Instruction exceeds maximum length of ${INSTRUCTION_MAX_LENGTH.toLocaleString()} characters.`;
  } else if (instruction.trim().length < INSTRUCTION_MIN_LENGTH) {
    errors.instruction = `Instruction must be at least ${INSTRUCTION_MIN_LENGTH} characters.`;
  }

  return errors;
}
