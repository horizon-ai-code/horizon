import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
});
