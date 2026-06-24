import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { useOrchestrationSocket, OrchestrationProvider } from '@/hooks/useOrchestrationSocket';
import React from 'react';
import { MockWebSocket } from '@/test-utils/mocks/websocket';
import { useChatStore } from '@/store/useChatStore';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  usePathname: () => '/',
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(OrchestrationProvider, null, children);
}

function setup() {
  const ws = new MockWebSocket('ws://localhost:8000/ws');
  vi.stubGlobal('WebSocket', class extends MockWebSocket {
    constructor(url: string) {
      super(url);
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        this.onopen?.();
      }, 0);
    }
  });
  useChatStore.setState({
    sessions: {},
    draftSession: {
    sourceCode: '', refactoredOutput: '', activeStep: 0, inputInstruction: '',
    terminalEntries: [], isTerminalCollapsed: false, appState: 'idle',
    showFlowchartModal: false, isMonolith: false, title: '', createdAt: 0, updatedAt: 0,
    orchestrationResult: { metrics: [], summary: '', diffHighlights: { added: [], removed: [] } },
    },
    orchestratorStatus: 'disconnected', hasInitialLoaded: false,
  });
  return ws;
}

describe('useOrchestrationSocket', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    useChatStore.setState({ sessions: {}, orchestratorStatus: 'disconnected' });
  });

  it('returns connection status', () => {
    const { result } = renderHook(() => useOrchestrationSocket(), { wrapper: Wrapper });
    expect(result.current.connectionStatus).toBeDefined();
  });

  it('has required methods', () => {
    const { result } = renderHook(() => useOrchestrationSocket(), { wrapper: Wrapper });
    expect(typeof result.current.connect).toBe('function');
    expect(typeof result.current.disconnect).toBe('function');
    expect(typeof result.current.sendRefactorRequest).toBe('function');
    expect(typeof result.current.sendHaltRequest).toBe('function');
  });

  it('disconnect closes socket', () => {
    const { result } = renderHook(() => useOrchestrationSocket(), { wrapper: Wrapper });
    act(() => { result.current.connect('session-1'); });
    act(() => { result.current.disconnect(); });
    expect(result.current.connectionStatus).toBe('disconnected');
  });
});
