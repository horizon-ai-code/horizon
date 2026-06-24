import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useChatStore } from '@/store/useChatStore';

beforeEach(() => {
  act(() => {
    useChatStore.setState({
      sessions: {},
      orchestratorStatus: 'disconnected',
      hasInitialLoaded: false,
    });
  });
});

describe('session CRUD', () => {
  it('creates a session with defaults', () => {
    act(() => { useChatStore.getState().createSession('test-1'); });
    const session = useChatStore.getState().sessions['test-1'];
    expect(session).toBeDefined();
    expect(session.title).toBe('New Session');
    expect(session.terminalEntries).toEqual([]);
  });

  it('creates session with initial prompt', () => {
    const id = useChatStore.getState().createSessionWithInitialPrompt('Flatten conditional in calculate method');
    const session = useChatStore.getState().sessions[id];
    expect(session).toBeDefined();
    expect(session.title.length).toBeGreaterThan(0);
  });

  it('updates a session with partial data', () => {
    act(() => { useChatStore.getState().createSession('test-1'); });
    act(() => { useChatStore.getState().updateSession('test-1', { title: 'My Refactor' }); });
    expect(useChatStore.getState().sessions['test-1'].title).toBe('My Refactor');
  });

  it('updates session via updater function', () => {
    act(() => { useChatStore.getState().createSession('test-1'); });
    act(() => {
      useChatStore.getState().updateSession('test-1', (prev) => ({
        terminalEntries: [
          ...prev.terminalEntries,
          { id: '1', type: 'log', text: 'hello', timestamp: '12:00' },
        ],
      }));
    });
    act(() => {
      useChatStore.getState().updateSession('test-1', (prev) => ({
        terminalEntries: [
          ...prev.terminalEntries,
          { id: '2', type: 'log', text: 'world', timestamp: '12:01' },
        ],
      }));
    });
    expect(useChatStore.getState().sessions['test-1'].terminalEntries).toHaveLength(2);
  });

  it('deletes a session', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    act(() => { useChatStore.getState().createSession('test-1'); });
    await act(async () => { await useChatStore.getState().deleteSession('test-1'); });
    expect(useChatStore.getState().sessions['test-1']).toBeUndefined();
  });

  it('renames a session', async () => {
    act(() => { useChatStore.getState().createSession('test-1'); });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    await act(async () => { await useChatStore.getState().renameSession('test-1', 'New Name'); });
    expect(useChatStore.getState().sessions['test-1'].title).toBe('New Name');
  });

  it('rolls back rename on API failure', async () => {
    act(() => { useChatStore.getState().createSession('test-1'); });
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('fail'));
    await act(async () => {
      try { await useChatStore.getState().renameSession('test-1', 'New Name'); } catch {}
    });
    expect(useChatStore.getState().sessions['test-1'].title).toBe('New Session');
  });
});

describe('session migration', () => {
  it('migrates session ID preserving state', () => {
    act(() => { useChatStore.getState().createSession('old-id'); });
    act(() => { useChatStore.getState().updateSession('old-id', { title: 'Target' }); });
    act(() => { useChatStore.getState().migrateSessionId('old-id', 'new-id'); });
    const state = useChatStore.getState();
    expect(state.sessions['old-id']).toBeUndefined();
    expect(state.sessions['new-id']).toBeDefined();
    expect(state.sessions['new-id'].title).toBe('Target');
  });
});

describe('orchestrator status', () => {
  it('sets orchestrator status', () => {
    act(() => { useChatStore.getState().setOrchestratorStatus('connected'); });
    expect(useChatStore.getState().orchestratorStatus).toBe('connected');
  });

  it('tracks initial load state', () => {
    expect(useChatStore.getState().hasInitialLoaded).toBe(false);
    act(() => { useChatStore.getState().setHasInitialLoaded(true); });
    expect(useChatStore.getState().hasInitialLoaded).toBe(true);
  });
});

describe('fetch operations', () => {
  it('fetchHistory populates sessions', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 's1', title: 'Session 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' }]), { status: 200 })
    );
    await act(async () => { await useChatStore.getState().fetchHistory(); });
    expect(useChatStore.getState().sessions['s1']).toBeDefined();
  });

  it('fetchHistory sets error flag on failure', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));
    await act(async () => { await useChatStore.getState().fetchHistory(); });
    expect(useChatStore.getState().historyLoadError).toBe(true);
  });

  it('resetDraftSession clears draft', () => {
    act(() => { useChatStore.getState().updateDraftSession({ sourceCode: 'test' }); });
    expect(useChatStore.getState().draftSession.sourceCode).toBe('test');
    act(() => { useChatStore.getState().resetDraftSession(); });
    expect(useChatStore.getState().draftSession.sourceCode).toBe('');
  });
});
