
import type { InsightMetric } from "./insights";
import type { PerformanceMetrics, ExitStatus } from "./websocket";

export type AppState = "idle" | "analyzing" | "waiting" | "done";

export interface TerminalEntry {
  id: string;
  type: 'command' | 'log' | 'system' | 'error' | 'divider';
  text: string;
  colorClass?: string;
  icon?: string;
  timestamp?: string;
}

export interface OrchestrationResult {
  metrics: InsightMetric[];
  summary: string;
  diffHighlights: {
    added: number[];
    removed: number[];
  };
  exit_status?: ExitStatus;
  phaseStates?: Record<string, string>;
  original_complexity?: number | null;
  refactored_complexity?: number | null;
  insights?: string;
  performance?: PerformanceMetrics;
  planner_model?: string;
  generator_model?: string;
  judge_model?: string;
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
  isMonolith: boolean;
  orchestrationResult: OrchestrationResult;
  isLoaded?: boolean;
  error?: string;
  errorCode?: string;
}
