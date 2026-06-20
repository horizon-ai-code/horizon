import { create } from 'zustand';
import { API_URL } from '@/lib/env';

// ── Import types from dedicated modules ───────────────────────────────────────
import type { AppState, SessionData, TerminalEntry, OrchestrationResult } from '@/types/session';
import type { InsightMetric } from '@/types/insights';
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

// ── Typed API response interfaces ──────────────────────────────────────────────

interface HistoryItemResponse {
  id?: string;
  title?: string;
  created_at?: string;
}

interface SessionDetailResponse {
  id?: string;
  user_instruction?: string;
  title?: string;
  original_code?: string;
  refactored_code?: string;
  status?: string;
  exit_status?: string;
  logs?: Array<{
    id?: string;
    role?: string;
    status?: string;
    content?: string | null;
    created_at?: string;
  }>;
  insights?: string;
  original_complexity?: number;
  refactored_complexity?: number;
  planner_model?: string;
  generator_model?: string;
  judge_model?: string;
  avg_gpu_utilization?: number;
  avg_gpu_memory?: number;
  avg_gpu_memory_used?: number;
  peak_gpu_utilization?: number;
  peak_gpu_memory_used?: number;
  inference_time?: number;
  created_at?: string;
}

// ── Import constants ──────────────────────────────────────────────────────────
import { INITIAL_SOURCE, EMPTY_ORCHESTRATION_RESULT, ROLE_VISUALS, DEFAULT_ROLE_VISUALS } from '@/lib/constants';
import { buildMetrics } from '@/lib/utils/buildMetrics';

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
  isMonolith: false,
  orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
};

const generateSessionId = () => Math.random().toString(36).slice(2, 10);

const getSessionTitleFromPrompt = (prompt: string) => {
  const trimmed = prompt.trim();
  if (!trimmed) return "New Session";
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}...` : trimmed;
};

// ── Store Interface ───────────────────────────────────────────────────────────

type OrchestratorStatus = "connected" | "connecting" | "disconnected" | "error";

interface ChatStore {
  orchestratorStatus: OrchestratorStatus;
  setOrchestratorStatus: (status: OrchestratorStatus) => void;
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

export const useChatStore = create<ChatStore>((set, get) => ({
  orchestratorStatus: "connected",
  setOrchestratorStatus: (status) => set({ orchestratorStatus: status }),
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
      const instruction = initialData?.inputInstruction || "";
      const derivedTitle = instruction ? getSessionTitleFromPrompt(instruction) : "New Session";

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [id]: { 
            ...DEFAULT_SESSION, 
            id, 
            createdAt: now, 
            updatedAt: now, 
            ...initialData, 
            title: derivedTitle,
            isLoaded: true 
          },
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

  renameSession: async (id, title) => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const previousTitle = get().sessions[id]?.title;

    set((state) => {
      const session = state.sessions[id];
      if (!session) return state;
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
    });

    try {
      const res = await fetch(`${API_URL}/api/history/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      console.error("[ChatStore] Rename failed:", err);
      set((state) => {
        const session = state.sessions[id];
        if (!session) return state;
        return {
          ...state,
          sessions: {
            ...state.sessions,
            [id]: { ...session, title: previousTitle ?? session.title },
          },
        };
      });
    }
  },

  deleteSession: async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/history/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        console.error(`[ChatStore] Backend returned ${res.status} on delete`);
        return;
      }
    } catch(e) {
      console.error("[ChatStore] Error deleting session from backend:", e);
      return;
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
      const res = await fetch(`${API_URL}/api/history`);
      if (!res.ok) return;
      
      const items: HistoryItemResponse[] = await res.json();
      
      set((state) => {
        const newSessions = { ...state.sessions };
        
        items.forEach((item) => {
            const id = item?.id;
            if (!id) return;

            const title = (item.title || "").trim() || "New Session";

            const createdAt = item.created_at
              ? new Date(item.created_at).getTime()
              : (newSessions[id]?.createdAt || Date.now());

            newSessions[id] = {
                ...(newSessions[id] || DEFAULT_SESSION),
                id,
                title,
                createdAt,
                updatedAt: createdAt,
                isLoaded: false,
            };
        });

        return {
          ...state,
          sessions: newSessions,
          hasInitialLoaded: true,
        };
      });
    } catch (e) {
      console.error("[ChatStore] Error fetching history:", e);
    } finally {
      set((state) => ({ ...state, hasInitialLoaded: true }));
    }
  },

  fetchSessionDetails: async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/history/${id}`);
      if (!res.ok) {
        const errorType = res.status === 404 ? "not_found" : res.status === 409 ? "system_busy" : "unknown";
        set((state) => ({
           ...state,
           sessions: {
             ...state.sessions,
             [id]: {
               ...(state.sessions[id] || { ...DEFAULT_SESSION, id }),
               error: errorType,
               isLoaded: true
             }
           }
        }));
        return false;
      }
      
      const detail: SessionDetailResponse = await res.json();
      
      set((state) => {
        const existing = state.sessions[id] || { ...DEFAULT_SESSION, id };
        

        
        const terminalEntries: TerminalEntry[] = (detail.logs || []).map((log: Record<string, unknown>, index: number) => {
            const role = log.role as string;
            const visuals = ROLE_VISUALS[role] || DEFAULT_ROLE_VISUALS;
            const timestamp = log.created_at
              ? new Date(log.created_at as string).toLocaleTimeString("en-US", { hour12: false })
              : undefined;
            return {
                id: log.id ? `p-${log.id}` : `p-log-${index}`,
                type: "log",
                text: (log.content as string) || `[${role}]: ${log.status}`,
                icon: visuals.icon,
                colorClass: visuals.colorClass,
                timestamp,
            };
        });

        let activeStep = 0;
        let appState: AppState = "idle";
        const oResult = { ...EMPTY_ORCHESTRATION_RESULT };

        const isHalted = detail.status === "Halted" || detail.exit_status === "ABORTED";
        const isProcessing = detail.status === "Processing" && !detail.refactored_code && !isHalted;

        if (detail.refactored_code) {
           activeStep = 5;
           appState = "done";
           // Parse insights JSON string
           let parsedInsights = detail.insights || "";
           if (typeof parsedInsights === "string" && parsedInsights.startsWith("[")) {
             try {
               const parsed = JSON.parse(parsedInsights);
               if (Array.isArray(parsed)) {
                 parsedInsights = parsed.map((i: { title?: string; details?: string }) =>
                   `${i.title || ""}: ${i.details || ""}`
                 ).join("\n");
               }
             } catch {
               // Not valid JSON, use as-is
             }
           }
           oResult.summary = parsedInsights;
           oResult.insights = parsedInsights;
           oResult.original_complexity = detail.original_complexity;
           oResult.refactored_complexity = detail.refactored_complexity;
           oResult.planner_model = detail.planner_model;
           oResult.generator_model = detail.generator_model;
           oResult.judge_model = detail.judge_model;
           oResult.performance = {
                avg_gpu_utilization: detail.avg_gpu_utilization || 0,
                avg_gpu_memory: detail.avg_gpu_memory || 0,
                avg_gpu_memory_used: detail.avg_gpu_memory_used || 0,
                peak_gpu_utilization: detail.peak_gpu_utilization ?? undefined,
                peak_gpu_memory_used: detail.peak_gpu_memory_used ?? undefined,
                inference_time: detail.inference_time || 0
           };

           oResult.metrics = buildMetrics(
              detail.original_complexity ?? null,
              detail.refactored_complexity ?? null,
              {
                avg_gpu_utilization: detail.avg_gpu_utilization ?? 0,
                avg_gpu_memory: detail.avg_gpu_memory ?? 0,
                avg_gpu_memory_used: detail.avg_gpu_memory_used ?? 0,
                peak_gpu_utilization: detail.peak_gpu_utilization ?? undefined,
                peak_gpu_memory_used: detail.peak_gpu_memory_used ?? undefined,
                inference_time: detail.inference_time ?? 0,
              }
           );
        } else if (isHalted) {
           activeStep = 0;
           appState = "done";
           oResult.summary = "This refactoring was interrupted. You can start a new one.";
           terminalEntries.push({
             id: `p-interrupted`,
             type: "log",
             text: "[System]: Session was interrupted — refactoring did not complete.",
             icon: "Monolith",
             colorClass: "text-[#f4bf4f]",
           });
        } else if (isProcessing) {
           activeStep = 0;
           appState = "done";
           oResult.summary = "This refactoring was interrupted. You can start a new one.";
           terminalEntries.push({
             id: `p-interrupted`,
             type: "log",
             text: "[System]: Session was interrupted — refactoring did not complete.",
             icon: "Monolith",
             colorClass: "text-[#f4bf4f]",
           });
        } else if (detail.logs && detail.logs.length > 0) {
           appState = "analyzing";
           const lastLog = detail.logs[detail.logs.length - 1];
           const visuals = ROLE_VISUALS[lastLog.role ?? ''] || DEFAULT_ROLE_VISUALS;
           activeStep = visuals.step;
        }
        
        const storedTitle = (detail.title || "").trim();
        const safeTitle = storedTitle
          || (detail.user_instruction || "").trim()
          || "Previous Session";

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
