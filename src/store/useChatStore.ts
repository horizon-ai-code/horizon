import { create } from 'zustand';

// ── WebSocket Contract Types (from horizon-api-docs.pdf pp. 7-8) ──────────

export interface RefactorRequest {
  code: string;
  user_instruction: string;
}

export interface StatusMessage {
  type: "status";
  role: "Planner" | "Generator" | "Judge" | "Validator";
  content: string;
}

export interface ComplexityResult {
  complexity_score: number | null;
  structure_tier: string;
  is_fallback: boolean | null;
}

export interface ResultMessage {
  type: "result";
  code: string;
  complexity: ComplexityResult;
  insights: string;
}

export interface PydanticError {
  type: string;
  loc: string[];
  msg: string;
  input: unknown;
}

export interface ValidationErrorMessage {
  type: "error";
  message: "Invalid data format";
  details: PydanticError[];
}

export interface MalformedJsonErrorMessage {
  type: "error";
  message: "Malformed JSON payload";
  details: string;
}

export type ErrorMessage = ValidationErrorMessage | MalformedJsonErrorMessage;
export type ServerMessage = StatusMessage | ResultMessage | ErrorMessage;

export type AppState = "idle" | "analyzing" | "done";

export interface ReplayStep {
  title: string;
  description: string;
  codeSnapshot: string;
  issueLines: number[];
  addedLines: number[];
  removedLines: number[];
}

export interface InsightMetric {
  title: string;
  before: string;
  after: string;
  direction: 'up' | 'down' | 'neutral';
  iconKey?: string;
}

export interface OrchestrationResult {
  replaySteps: ReplayStep[];
  metrics: InsightMetric[];
  summary: string;
  diffHighlights: {
    added: number[];
    removed: number[];
  };
  complexity?: ComplexityResult;
  insights?: string;
}

export const EMPTY_ORCHESTRATION_RESULT: OrchestrationResult = {
  replaySteps: [],
  metrics: [],
  summary: "",
  diffHighlights: {
    added: [],
    removed: [],
  },
};

export const INITIAL_SOURCE = ``;

export const INITIAL_REFACTORED = ``;

export interface TerminalEntry {
  id: string;
  type: 'command' | 'log' | 'system' | 'error';
  text: string;
  colorClass?: string;
  icon?: string;
}

export interface SessionData {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  sourceCode: string;
  refactoredOutput: string;
  activeStep: number;
  inputInstruction: string;
  terminalEntries: TerminalEntry[];
  isTerminalCollapsed: boolean;
  appState: AppState;
  showFlowchartModal: boolean;
  orchestrationResult: OrchestrationResult;
  error?: string;
}

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
  deleteSession: (id: string) => void;
}

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

  deleteSession: (id) =>
    set((state) => {
      if (!state.sessions[id]) return state;

      const { [id]: _deleted, ...remaining } = state.sessions;
      return {
        ...state,
        sessions: remaining,
      };
    }),
}));
