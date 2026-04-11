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
  fetchSessionDetails: (id: string) => Promise<boolean>;
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
      
      if (id === "draft" || !id) {
        const data = typeof arg === "function" ? arg({ ...state.draftSession, id: "draft" } as SessionData) : arg;
        return {
          ...state,
          draftSession: { ...state.draftSession, ...data, updatedAt: now },
        };
      }

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
          [id]: { ...DEFAULT_SESSION, ...initialData, id, createdAt: now, updatedAt: now, isLoaded: true },
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
      
      const items: Array<{ id?: string; user_instruction?: string }> = await res.json();
      
      set((state) => {
        const newSessions = { ...state.sessions };
        
        items.forEach((item) => {
            const id = item?.id;
            if (!id) return;
            
            const instruction = item.user_instruction || "";
            
            if (!newSessions[id]) {
                const title = instruction.trim().length > 0 
                  ? (instruction.trim().length > 48 ? `${instruction.trim().slice(0, 48)}...` : instruction.trim())
                  : "New Session";

                newSessions[id] = {
                    ...DEFAULT_SESSION,
                    id,
                    title,
                    updatedAt: Date.now(), // Ensure it has a timestamp for sorting
                };
            }
        });

        return {
          ...state,
          sessions: newSessions,
          hasInitialLoaded: true,
        };
      });
    } catch (e) {
      console.error("[ChatStore] Error fetching history:", e);
    }
  },

  fetchSessionDetails: async (id) => {
    try {
      const res = await fetch(`http://localhost:8000/api/history/${id}`);
      if (!res.ok) {
        set((state) => ({
           ...state,
           sessions: {
             ...state.sessions,
             [id]: {
               ...(state.sessions[id] || { ...DEFAULT_SESSION, id }),
               error: 'not_found',
               isLoaded: true
             }
           }
        }));
        return false;
      }
      
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
        
        const terminalEntries: TerminalEntry[] = (detail.logs || []).map((log: Record<string, unknown>, index: number) => {
            const role = log.role as string;
            const visuals = ROLE_VISUALS[role] || DEFAULT_VISUALS;
            return {
                id: log.id ? `p-${log.id}` : `p-log-${index}`,
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
           oResult.performance = {
                avg_gpu_utilization: detail.avg_gpu_utilization || 0,
                avg_gpu_memory: detail.avg_gpu_memory || 0,
                avg_gpu_memory_used: detail.avg_gpu_memory_used || 0,
                inference_time: detail.inference_time || 0
           };

           oResult.metrics = [];
           if (typeof detail.complexity === "number") {
                oResult.metrics.push({
                    title: "Cyclomatic Complexity",
                    before: "—",
                    after: `${detail.complexity}`,
                    direction: detail.complexity <= 5 ? "down" as const : "up" as const,
                    iconKey: "CheckCircle",
                });
           }

           if (detail.avg_gpu_utilization !== undefined) {
                const memUsed = detail.avg_gpu_memory_used ?? 0;
                const memPercent = detail.avg_gpu_memory ?? 0;
                const gpuUtil = detail.avg_gpu_utilization ?? 0;
                const infTime = detail.inference_time ?? 0;

                oResult.metrics.push({
                    title: "Inference Time",
                    before: "—",
                    after: `${infTime}s`,
                    direction: "neutral" as const,
                    iconKey: "Clock",
                });
                oResult.metrics.push({
                    title: "Avg GPU Utilization",
                    before: "—",
                    after: `${gpuUtil}%`,
                    direction: "neutral" as const,
                    iconKey: "Cpu",
                });
                oResult.metrics.push({
                    title: "Avg GPU Memory",
                    before: "—",
                    after: `${(memUsed / (1024 * 1024 * 1024)).toFixed(2)} GB (${memPercent}%)`,
                    direction: "neutral" as const,
                    iconKey: "Layers",
                });
           }
        }
 else if (detail.logs && detail.logs.length > 0) {
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
              orchestrationResult: oResult,
              isLoaded: true
            }
          }
        };
      });
      return true;
    } catch(e) {
      console.error("[ChatStore] Error fetching session details:", e);
      return false;
    }
  },
}));
