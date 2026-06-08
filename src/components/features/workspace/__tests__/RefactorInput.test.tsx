import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders a button labelled Single (7B)', () => {
    render(<RefactorInput {...defaultProps} />);
    const button = screen.getByRole('button', { name: /single/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent(/7B/i);
  });

  it('calls startSingleRefactor when Single (7B) button is clicked', () => {
    render(<RefactorInput {...defaultProps} />);
    const button = screen.getByRole('button', { name: /single/i });
    fireEvent.click(button);
    expect(defaultProps.startSingleRefactor).toHaveBeenCalledTimes(1);
  });
});
