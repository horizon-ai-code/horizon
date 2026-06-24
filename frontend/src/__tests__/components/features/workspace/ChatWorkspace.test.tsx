import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ChatWorkspace from '@/components/features/workspace/ChatWorkspace';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'dark', setTheme: vi.fn() }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useOrchestrationSocket', () => ({
  useOrchestrationSocket: () => ({
    connectionStatus: 'connected', connect: vi.fn(), disconnect: vi.fn(),
    sendRefactorRequest: vi.fn(), sendHaltRequest: vi.fn(),
    setTargetSessionId: vi.fn(), glassboxState: null, waitForOpen: vi.fn(),
  }),
  OrchestrationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@/store/useChatStore', () => {
  const state = {
    sessions: {},
    draftSession: {
      sourceCode: '', refactoredOutput: '', activeStep: 0, inputInstruction: '',
      terminalEntries: [], isTerminalCollapsed: false, appState: 'idle',
      showFlowchartModal: false, isMonolith: false, title: '', createdAt: 0, updatedAt: 0,
      orchestrationResult: { metrics: [], summary: '', diffHighlights: { added: [], removed: [] } },
    },
    updateSession: vi.fn(), updateDraftSession: vi.fn(),
    fetchSessionDetails: vi.fn().mockResolvedValue(true),
    renameSession: vi.fn(), deleteSession: vi.fn(), fetchHistory: vi.fn(),
    historyLoadError: false,
    hasInitialLoaded: true, setHasInitialLoaded: vi.fn(),
  };
  const fn = (selector?: (s: typeof state) => unknown) => selector ? selector(state) : state;
  fn.getState = () => state;
  return { useChatStore: fn, INITIAL_SOURCE: '', EMPTY_ORCHESTRATION_RESULT: { metrics: [], summary: '', diffHighlights: { added: [], removed: [] } } };
});

describe('ChatWorkspace', () => {
  it('renders without crashing', () => {  // TC-FI-004
    render(<ChatWorkspace sessionId="test-session" />);
    expect(document.body).toBeTruthy();
  });

  it('renders with null sessionId', () => {  // TC-FI-004
    render(<ChatWorkspace sessionId={null} />);
    expect(document.body).toBeTruthy();
  });
});
