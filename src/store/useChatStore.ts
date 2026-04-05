import { create } from 'zustand';

// ── Import types from dedicated modules ───────────────────────────────────────
import type { AppState, SessionData, TerminalEntry, OrchestrationResult } from '@/types/session';
import type { ReplayStep, InsightMetric } from '@/types/insights';
import type {
  ConnectionIdMessage,
  StatusMessage,
  ResultMessage,
  PydanticError,
  ValidationErrorMessage,
  MalformedJsonErrorMessage,
  ErrorMessage,
  ServerMessage,
} from '@/types/websocket';

// ── Import constants ──────────────────────────────────────────────────────────
import { INITIAL_SOURCE, INITIAL_REFACTORED, EMPTY_ORCHESTRATION_RESULT } from '@/lib/constants';

// ── Re-export everything for backward compatibility ───────────────────────────
// Consumers that already import from '@/store/useChatStore' will continue to work.
export type {
  AppState,
  SessionData,
  TerminalEntry,
  OrchestrationResult,
  ReplayStep,
  InsightMetric,
  ConnectionIdMessage,
  StatusMessage,
  ResultMessage,
  PydanticError,
  ValidationErrorMessage,
  MalformedJsonErrorMessage,
  ErrorMessage,
  ServerMessage,
};

export { INITIAL_SOURCE, INITIAL_REFACTORED, EMPTY_ORCHESTRATION_RESULT };

// ── Internal Helpers ──────────────────────────────────────────────────────────

const DEFAULT_SESSION: Omit<SessionData, "id"> = {
  title: "New Session",
  createdAt: 0,
  updatedAt: 0,
  sourceCode: INITIAL_SOURCE,
  refactoredOutput: "",
  activeStep: 0,
  inputInstruction: "",
  terminalEntries: [],
  isTerminalCollapsed: false,
  appState: "idle",
  showFlowchartModal: false,
  orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
};

const generateSessionId = () => Math.random().toString(36).slice(2, 10);

const getSessionTitleFromPrompt = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) return "New Session";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
};

// ── Store Interface ───────────────────────────────────────────────────────────

interface ChatStore {
  hasInitialLoaded: boolean;
  setHasInitialLoaded: (loaded: boolean) => void;
  sessions: Record<string, SessionData>;
  draftSession: Omit<SessionData, "id">;
  updateDraftSession: (
    data:
      | Partial<Omit<SessionData, "id">>
      | ((prev: Omit<SessionData, "id">) => Partial<Omit<SessionData, "id">>)
  ) => void;
  resetDraftSession: () => void;
  updateSession: (id: string, data: Partial<SessionData> | ((prev: SessionData) => Partial<SessionData>)) => void;
  createSession: (id: string, initialData?: Partial<SessionData>) => void;
  createSessionWithInitialPrompt: (prompt: string, initialData?: Partial<SessionData>) => string;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => Promise<void>;
  migrateSessionId: (oldId: string, newId: string) => void;
  fetchHistory: () => Promise<void>;
  fetchSessionDetails: (id: string) => Promise<void>;
}

// ── Zustand Store ─────────────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set) => ({
  hasInitialLoaded: false,
  setHasInitialLoaded: (loaded) => set({ hasInitialLoaded: loaded }),
  sessions: {},
  draftSession: DEFAULT_SESSION,

  updateDraftSession: (arg) =>
    set((state) => {
      const data = typeof arg === "function" ? arg(state.draftSession) : arg;
      return {
        ...state,
        draftSession: { ...state.draftSession, ...data },
      };
    }),

  resetDraftSession: () => set((state) => ({ ...state, draftSession: DEFAULT_SESSION })),

  updateSession: (id, arg) =>
    set((state) => {
      const now = Date.now();
      const existing = state.sessions[id] || { ...DEFAULT_SESSION, id, createdAt: now, updatedAt: now };
      const data = typeof arg === "function" ? arg(existing) : arg;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [id]: {
            ...existing,
            ...data,
            updatedAt: now,
          },
        },
      };
    }),

  createSession: (id, initialData) =>
    set((state) => {
      if (state.sessions[id]) return state;

      const now = Date.now();
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [id]: { ...DEFAULT_SESSION, id, createdAt: now, updatedAt: now, ...initialData },
        },
      };
    }),

  createSessionWithInitialPrompt: (prompt, initialData) => {
    const id = generateSessionId();
    const now = Date.now();
    const title = getSessionTitleFromPrompt(prompt);

    set((state) => ({
      ...state,
      sessions: {
        ...state.sessions,
        [id]: {
          ...DEFAULT_SESSION,
          id,
          title,
          createdAt: now,
          updatedAt: now,
          ...initialData,
        },
      },
    }));

    return id;
  },

  renameSession: (id, title) =>
    set((state) => {
      const session = state.sessions[id];
      if (!session) return state;

      const trimmed = title.trim();
      if (!trimmed) return state;

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [id]: {
            ...session,
            title: trimmed,
            updatedAt: Date.now(),
          },
        },
      };
    }),

  deleteSession: async (id) => {
    try {
      await fetch(`http://localhost:8000/api/history/${id}`, {
        method: "DELETE",
      });
    } catch(e) {
      console.error("[ChatStore] Error deleting session from backend:", e);
    }
    set((state) => {
      if (!state.sessions[id]) return state;

      const remaining = { ...state.sessions };
      delete remaining[id];
      return { ...state, sessions: remaining };
    });
  },

  migrateSessionId: (oldId, newId) =>
    set((state) => {
      if (oldId === newId) return state;
      const oldSession = state.sessions[oldId];
      if (!oldSession) return state;

      const remaining = { ...state.sessions };
      delete remaining[oldId];
      return {
        ...state,
        sessions: {
          ...remaining,
          [newId]: {
            ...oldSession,
            id: newId,
          },
        },
      };
    }),

  fetchHistory: async () => {
    try {
      const res = await fetch("http://localhost:8000/api/history");
      if (!res.ok) return;
      
      const ids: string[] = await res.json();
      
      await Promise.all(
        ids.map(async (idItem) => {
           const id = String(typeof idItem === 'object' && idItem !== null ? (idItem as Record<string, unknown>).id || (idItem as Record<string, unknown>).item || idItem : idItem);
           try {
             await useChatStore.getState().fetchSessionDetails(id);
           } catch(_) {}
        })
      );
    } catch (e) {
      console.error("[ChatStore] Error fetching history:", e);
    }
  },

  fetchSessionDetails: async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/history/${id}`);
      if (!res.ok) return;
      
      const detail = await res.json();
      
      set((state) => {
        const existing = state.sessions[id] || { ...DEFAULT_SESSION, id };
        
        const ROLE_VISUALS: Record<string, { step: number; icon: string; colorClass: string }> = {
            Planner:   { step: 1, icon: "Cpu",          colorClass: "text-[#56a8f5]" },
            Generator: { step: 2, icon: "Layers",       colorClass: "text-[#2aacb8]" },
            Validator: { step: 3, icon: "FileCode2",    colorClass: "text-[#00e5ff]" },
            Judge:     { step: 4, icon: "CheckCircle2", colorClass: "text-[#27c93f]" },
        };
        const DEFAULT_VISUALS = { step: 1, icon: "Cpu", colorClass: "text-jb-accent" };
        
        const terminalEntries: TerminalEntry[] = (detail.logs || []).map((log: Record<string, unknown>) => {
            const role = log.role as string;
            const visuals = ROLE_VISUALS[role] || DEFAULT_VISUALS;
            return {
                id: `p-${log.id}`,
                type: "log",
                text: `[${role}]: ${log.status}`,
                icon: visuals.icon,
                colorClass: visuals.colorClass
            };
        });

        let activeStep = 0;
        let appState: AppState = "idle";
        const oResult = { ...EMPTY_ORCHESTRATION_RESULT };
        
        if (detail.refactored_code) {
           activeStep = 5;
           appState = "done";
           oResult.summary = detail.insights || "";
           oResult.insights = detail.insights || "";
           if (typeof detail.complexity === "number") {
                oResult.metrics = [{
                    title: "Cyclomatic Complexity",
                    before: "—",
                    after: `${detail.complexity}`,
                    direction: detail.complexity <= 5 ? "down" as const : "up" as const,
                    iconKey: "CheckCircle",
                }];
           } else if (typeof detail.complexity === "object" && detail.complexity !== null) {
                oResult.metrics = [];
           }
        } else if (detail.logs && detail.logs.length > 0) {
           appState = "analyzing";
           const lastLog = detail.logs[detail.logs.length - 1];
           const visuals = ROLE_VISUALS[lastLog.role] || DEFAULT_VISUALS;
           activeStep = visuals.step;
        }
        
        const safeTitle = (detail.user_instruction || "").trim() || "Previous Session";

        return {
          ...state,
          sessions: {
            ...state.sessions,
            [id]: {
              ...existing,
              title: safeTitle.length > 48 ? `${safeTitle.slice(0, 48)}...` : safeTitle,
              createdAt: detail.created_at ? new Date(detail.created_at).getTime() : existing.createdAt,
              sourceCode: detail.original_code || existing.sourceCode,
              refactoredOutput: detail.refactored_code || existing.refactoredOutput,
              inputInstruction: detail.user_instruction || existing.inputInstruction,
              appState,
              activeStep,
              terminalEntries,
              orchestrationResult: oResult
            }
          }
        };
      });
    } catch(e) {
      console.error("[ChatStore] Error fetching session details:", e);
    }
  },
}));
