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
  it('creates a session with defaults', () => {  // TC-ST-001
    act(() => { useChatStore.getState().createSession('test-1'); });
    const session = useChatStore.getState().sessions['test-1'];
    expect(session).toBeDefined();
    expect(session.title).toBe('New Session');
    expect(session.terminalEntries).toEqual([]);
  });

  it('creates session with initial prompt', () => {  // TC-ST-002
    const id = useChatStore.getState().createSessionWithInitialPrompt('Flatten conditional in calculate method');
    expect(id).toBeDefined();
    expect(useChatStore.getState().sessions[id]).toBeDefined();
  });

  it('updates a session with partial data', () => {  // TC-ST-003
    act(() => { useChatStore.getState().createSession('test-1'); });
    act(() => { useChatStore.getState().updateSession('test-1', { title: 'My Refactor' }); });
    expect(useChatStore.getState().sessions['test-1'].title).toBe('My Refactor');
  });

  it('updates session via updater function', () => {  // TC-ST-004
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

  it('deletes a session', async () => {  // TC-ST-005
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    act(() => { useChatStore.getState().createSession('test-1'); });
    await act(async () => { await useChatStore.getState().deleteSession('test-1'); });
    expect(useChatStore.getState().sessions['test-1']).toBeUndefined();
  });

  it('rolls back delete on API failure', async () => {  // TC-ST-006
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('fail'));
    act(() => { useChatStore.getState().createSession('test-1'); });
    await act(async () => {
      try { await useChatStore.getState().deleteSession('test-1'); } catch {}
    });
    expect(useChatStore.getState().sessions['test-1']).toBeDefined();
  });

  it('renames a session', async () => {  // TC-ST-007
    act(() => { useChatStore.getState().createSession('test-1'); });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(null, { status: 200 }));
    await act(async () => { await useChatStore.getState().renameSession('test-1', 'New Name'); });
    expect(useChatStore.getState().sessions['test-1'].title).toBe('New Name');
  });

  it('rolls back rename on API failure', async () => {  // TC-ST-008
    act(() => { useChatStore.getState().createSession('test-1'); });
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('fail'));
    await act(async () => {
      try { await useChatStore.getState().renameSession('test-1', 'New Name'); } catch {}
    });
    expect(useChatStore.getState().sessions['test-1'].title).toBe('New Session');
  });
});

describe('session migration', () => {
  it('migrates session ID preserving state', () => {  // TC-ST-009
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
  it('sets orchestrator status', () => {  // TC-ST-014
    act(() => { useChatStore.getState().setOrchestratorStatus('connected'); });
    expect(useChatStore.getState().orchestratorStatus).toBe('connected');
  });

  it('tracks initial load state', () => {  // TC-ST-014b
    expect(useChatStore.getState().hasInitialLoaded).toBe(false);
    act(() => { useChatStore.getState().setHasInitialLoaded(true); });
    expect(useChatStore.getState().hasInitialLoaded).toBe(true);
  });
});

describe('fetch operations', () => {
  it('fetchHistory populates sessions', async () => {  // TC-ST-010
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify([{ id: 's1', title: 'Session 1', createdAt: '2024-01-01', updatedAt: '2024-01-01' }]), { status: 200 })
    );
    await act(async () => { await useChatStore.getState().fetchHistory(); });
    expect(useChatStore.getState().sessions['s1']).toBeDefined();
  });

  it('fetchHistory sets error flag on failure', async () => {  // TC-ST-011
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));
    await act(async () => { await useChatStore.getState().fetchHistory(); });
    expect(useChatStore.getState().historyLoadError).toBe(true);
  });

  it('fetchSessionDetails maps logs', async () => {  // TC-ST-012
    const sid = 'test-session';
    act(() => { useChatStore.getState().createSession(sid); });
    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({
        id: sid,
        logs: [{ role: 'Planner', content: 'analyzing', status: 'done' }],
        original_code: '', refactored_code: '',
        original_complexity: null, refactored_complexity: null,
      }), { status: 200 })
    );
    await act(async () => { await useChatStore.getState().fetchSessionDetails(sid); });
    expect(useChatStore.getState().sessions[sid]).toBeDefined();
  });

  it('resetDraftSession clears draft', () => {  // TC-ST-013
    act(() => { useChatStore.getState().updateDraftSession({ sourceCode: 'test' }); });
    expect(useChatStore.getState().draftSession.sourceCode).toBe('test');
    act(() => { useChatStore.getState().resetDraftSession(); });
    expect(useChatStore.getState().draftSession.sourceCode).toBe('');
  });
});
