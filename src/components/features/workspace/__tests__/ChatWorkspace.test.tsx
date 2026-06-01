import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import ChatWorkspace from '@/components/features/workspace/ChatWorkspace';

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
}));

vi.mock('@/hooks/useOrchestrationSocket', () => ({
  useOrchestrationSocket: () => ({
    connectionStatus: 'disconnected' as const,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendRefactorRequest: vi.fn(),
    sendHaltRequest: vi.fn(),
    setTargetSessionId: vi.fn(),
  }),
  OrchestrationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/useChatStore', () => {
  const inner = {
    sessions: {} as Record<string, unknown>,
    draftSession: {
      sourceCode: '',
      refactoredOutput: '',
      activeStep: 0,
      inputInstruction: '',
      terminalEntries: [] as never[],
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
    updateSession: vi.fn(),
    updateDraftSession: vi.fn(),
    fetchSessionDetails: vi.fn().mockResolvedValue(true),
    renameSession: vi.fn(),
    deleteSession: vi.fn(),
    fetchHistory: vi.fn(),
    hasInitialLoaded: true,
    setHasInitialLoaded: vi.fn(),
  };

  const fn = (selector?: (s: typeof inner) => unknown) =>
    selector ? selector(inner) : inner;
  fn.getState = () => inner;

  return {
    useChatStore: fn,
    INITIAL_SOURCE: '',
    EMPTY_ORCHESTRATION_RESULT: inner.draftSession.orchestrationResult,
  };
});

describe('ChatWorkspace', () => {
  it('renders the resizable panel layout', async () => {
    render(<ChatWorkspace sessionId="test-session" />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });
    // The terminal panel should be in the DOM
    await waitFor(() => {
      expect(document.getElementById('terminal-panel')).toBeInTheDocument();
    });
  });

  it('renders with null sessionId', async () => {
    render(<ChatWorkspace sessionId={null} />);
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });
    await waitFor(() => {
      expect(document.getElementById('terminal-panel')).toBeInTheDocument();
    });
  });
});
