import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RefactorInput from '@/components/features/workspace/RefactorInput';

vi.mock('@/store/useChatStore', () => ({
  useChatStore: (selector?: any) => {
    const store = {
      draftSession: {
        sourceCode: '',
        refactoredOutput: '',
        activeStep: 0,
        inputInstruction: '',
        terminalEntries: [],
        isTerminalCollapsed: false,
        appState: 'idle' as const,
        showFlowchartModal: false,
        orchestrationResult: {
          replaySteps: [],
          metrics: [],
          summary: '',
          diffHighlights: { added: [], removed: [] },
        },
      },
      updateDraftSession: vi.fn(),
    };
    return selector ? selector(store) : store;
  },
}));

describe('RefactorInput', () => {
  const defaultProps = {
    sessionId: null,
    sourceCode: 'public class Test {}',
    inputInstruction: 'refactor this',
    setInputInstruction: vi.fn(),
    inputError: false,
    setInputError: vi.fn(),
    validateBeforeSubmit: vi.fn(() => true),
    startAnalysis: vi.fn(),
    startSingleRefactor: vi.fn(),
    stopAnalysis: vi.fn(),
    appState: 'idle' as const,
  };

  it('renders a Run button', () => {
    render(<RefactorInput {...defaultProps} />);
    expect(screen.getByRole('button', { name: /run/i })).toBeInTheDocument();
  });

  it('renders a mode dropdown trigger', () => {
    render(<RefactorInput {...defaultProps} />);
    expect(screen.getByRole('button', { name: /select mode/i })).toBeInTheDocument();
  });

  it('disables Run when source code is empty', () => {
    render(<RefactorInput {...defaultProps} sourceCode="" />);
    expect(screen.getByRole('button', { name: /run/i })).toBeDisabled();
  });
});
