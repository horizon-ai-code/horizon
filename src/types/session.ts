
import type { ReplayStep, InsightMetric } from "./insights";

export type AppState = "idle" | "analyzing" | "done";

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
  complexity?: number | null;
  insights?: string;
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
