import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RefactorInput from '@/components/features/workspace/RefactorInput';
import { CODE_MAX_LENGTH, INSTRUCTION_MAX_LENGTH, CODE_MIN_LENGTH, INSTRUCTION_MIN_LENGTH } from '@/lib/validation';

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark', setTheme: vi.fn() }),
}));

vi.mock('@/store/useChatStore', () => {
  const state = {
    tourMode: false,
    draftSession: { sourceCode: '', inputInstruction: '' },
    updateDraftSession: vi.fn(),
  };
  const fn = (selector?: (s: typeof state) => unknown) => (selector ? selector(state) : state);
  fn.getState = () => state;
  return { useChatStore: fn };
});

const baseProps = {
  sessionId: null,
  setInputInstruction: vi.fn(),
  inputError: false,
  setInputError: vi.fn(),
  validateBeforeSubmit: vi.fn().mockReturnValue(true),
  startAnalysis: vi.fn(),
  startSingleRefactor: vi.fn(),
  stopAnalysis: vi.fn(),
  appState: 'idle' as const,
};

describe('RefactorInput submit gating (FR-002)', () => {
  it('enables Run for valid input', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode="class A { void m() {} }"
        inputInstruction="refactor this"
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).not.toBeDisabled();
  });

  it('disables Run when source code exceeds max length', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode={"a".repeat(CODE_MAX_LENGTH + 1)}
        inputInstruction="refactor this"
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });

  it('disables Run when instruction exceeds max length', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode="class A { void m() {} }"
        inputInstruction={"a".repeat(INSTRUCTION_MAX_LENGTH + 1)}
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });

  it('enables Run at exactly max lengths', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode={"c".repeat(CODE_MAX_LENGTH)}
        inputInstruction={"i".repeat(INSTRUCTION_MAX_LENGTH)}
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).not.toBeDisabled();
  });

  it('disables Run when source code is under minimum length', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode={"class"}
        inputInstruction="refactor this"
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });

  it('disables Run when instruction is under minimum length', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode="class A { void m() {} }"
        inputInstruction={"a".repeat(INSTRUCTION_MIN_LENGTH - 1)}
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });

  it('enables Run at exactly minimum lengths', () => {
    render(
      <RefactorInput
        {...baseProps}
        sourceCode={"c".repeat(CODE_MIN_LENGTH)}
        inputInstruction={"i".repeat(INSTRUCTION_MIN_LENGTH)}
      />
    );
    expect(screen.getByRole('button', { name: /run/i })).not.toBeDisabled();
  });
});
