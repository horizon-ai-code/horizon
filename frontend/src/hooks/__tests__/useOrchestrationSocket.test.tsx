import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { OrchestrationProvider, useOrchestrationSocket } from '@/hooks/useOrchestrationSocket';
import type { ReactNode } from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const mockStore = {
  sessions: {},
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

      metrics: [],
      summary: '',
      diffHighlights: { added: [], removed: [] },
    },
  },
  updateSession: vi.fn(),
  migrateSessionId: vi.fn(),
  setOrchestratorStatus: vi.fn(),
  resetDraftSession: vi.fn(),
  getState: function () { return this; },
};

vi.mock('@/store/useChatStore', () => {
  const fn = (selector?: (s: typeof mockStore) => unknown) =>
    selector ? selector(mockStore) : mockStore;
  fn.getState = () => mockStore;
  return { useChatStore: fn };
});

function wrapper({ children }: { children: ReactNode }) {
  return <OrchestrationProvider>{children}</OrchestrationProvider>;
}

describe('useOrchestrationSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes sendSingleRefactor in the context', () => {
    const { result } = renderHook(() => useOrchestrationSocket(), { wrapper });
    expect(result.current.sendSingleRefactor).toBeDefined();
    expect(typeof result.current.sendSingleRefactor).toBe('function');
  });

  it('sendSingleRefactor returns false when WebSocket is not open', () => {
    const { result } = renderHook(() => useOrchestrationSocket(), { wrapper });
    const sent = result.current.sendSingleRefactor('code', 'instruction');
    expect(sent).toBe(false);
  });
});
