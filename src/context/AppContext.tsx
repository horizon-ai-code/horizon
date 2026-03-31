"use client"

import { createContext, useContext, useState, ReactNode, useCallback } from "react";

export type AppState = "idle" | "analyzing" | "done";

export const INITIAL_SOURCE = `public boolean containsDuplicate(int[] nums) {
    for (int i = 0; i < nums.length; i++) {
        for (int j = i + 1; j < nums.length; j++) {
            if (nums[i] == nums[j]) {
                return true;
            }
        }
    }
    return false;
}`;

export const INITIAL_REFACTORED = `public boolean containsDuplicate(int[] nums) {
    Set<Integer> seen = new HashSet<>();
    for (int num : nums) {
        if (!seen.add(num)) {
            return true;
        }
    }
    return false;
}`;

export interface TerminalEntry {
  id: string;
  type: 'command' | 'log' | 'system';
  text: string;
  colorClass?: string;
  icon?: any;
}

export interface SessionData {
  id: string;
  sourceCode: string;
  refactoredOutput: string;
  activeStep: number;
  inputInstruction: string;
  terminalEntries: TerminalEntry[];
  isTerminalCollapsed: boolean;
  appState: AppState;
  showFlowchartModal: boolean;
}

const DEFAULT_SESSION: Omit<SessionData, "id"> = {
  sourceCode: INITIAL_SOURCE,
  refactoredOutput: "",
  activeStep: 0,
  inputInstruction: "",
  terminalEntries: [],
  isTerminalCollapsed: false,
  appState: "idle",
  showFlowchartModal: false,
};

interface AppContextType {
  hasInitialLoaded: boolean;
  setHasInitialLoaded: (loaded: boolean) => void;
  sessions: Record<string, SessionData>;
  updateSession: (id: string, data: Partial<SessionData> | ((prev: SessionData) => Partial<SessionData>)) => void;
  createSession: (id: string) => void;
  
  // Legacy support for when components need simple access (mostly for the active one)
  // We recommend using these only when a single active session context is assumed.
  appState?: AppState; 
  setAppState?: (state: AppState) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
  const [sessions, setSessions] = useState<Record<string, SessionData>>({});

  const updateSession = useCallback((id: string, arg: Partial<SessionData> | ((prev: SessionData) => Partial<SessionData>)) => {
    setSessions(prev => {
      const existing = prev[id] || { ...DEFAULT_SESSION, id };
      const data = typeof arg === "function" ? arg(existing) : arg;
      return {
        ...prev,
        [id]: {
          ...existing,
          ...data
        }
      };
    });
  }, []);

  const createSession = useCallback((id: string) => {
    setSessions(prev => {
      if (prev[id]) return prev;
      return {
        ...prev,
        [id]: { ...DEFAULT_SESSION, id }
      }
    });
  }, []);

  return (
    <AppContext.Provider value={{
      hasInitialLoaded, setHasInitialLoaded,
      sessions, updateSession, createSession
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
}
