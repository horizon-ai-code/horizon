
import type { ReplayStep, InsightMetric } from "./insights";
import type { PerformanceMetrics } from "./websocket";

export type AppState = "idle" | "analyzing" | "waiting" | "done";

export interface TerminalEntry {
  id: string;
  type: 'command' | 'log' | 'system' | 'error';
  text: string;
  colorClass?: string;
  icon?: string;
}

export interface OrchestrationResult {
  replaySteps: ReplayStep[];
  metrics: InsightMetric[];
  summary: string;
  diffHighlights: {
    added: number[];
    removed: number[];
  };
  original_complexity?: number | null;
  refactored_complexity?: number | null;
  insights?: string;
  performance?: PerformanceMetrics;
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
  isLoaded?: boolean;
  error?: string;
}
