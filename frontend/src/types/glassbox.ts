export type AgentRole = "Planner" | "Generator" | "Validator" | "Judge" | "System" | "Monolith";

export interface RetryInfo {
  current: number;
  max: number;
  type: "strategy" | "syntax_heal" | "sequential_mutation";
}

export interface IntentDetail {
  category?: string;
  intent?: string;
  targetUnit?: string;
  targetClass?: string;
  targetMember?: string;
}

export interface MutationItem {
  action: string;
  target: string;
  description?: string;
  status?: "pending" | "in_progress" | "completed" | "failed" | "retrying";
}

export interface ValidationFinding {
  tier: string;
  description: string;
}

export interface ValidationCheck {
  tier: string;
  name: string;
  passed: boolean;
  details?: string | null;
  before_value?: number;
  after_value?: number;
}

export interface ArchitectureTarget {
  name: string;
  kind: string;
  purpose?: string;
}

export interface ArchitectureData {
  primaryTargets: ArchitectureTarget[];
  secondaryTargets: ArchitectureTarget[];
  newStructures: ArchitectureTarget[];
  mustPreserve: ArchitectureTarget[];
}

export interface JudgeIssue {
  issueType: string;
  description: string;
}

export interface CurrentStatusDetail {
  intent?: IntentDetail;
  mutations?: MutationItem[];
  analysisSummary?: string;
  totalFaults?: number;
  findings?: ValidationFinding[];
  checks?: ValidationCheck[];
  judgeVerdict?: "ACCEPT" | "REVISE";
  judgeIssues?: JudgeIssue[];
  phaseName?: string;
  phaseAction?: string;
  architecture?: ArchitectureData;
  generatorProgress?: { completed: number; total: number };
  generatorTemperature?: number;
}

export interface PhaseSummary {
  summary: string;
  detail: CurrentStatusDetail | null;
  timestamp: number;
}

export interface PhaseDuration {
  phase: number;
  durationMs: number;
}

export interface GlassboxState {
  currentPhase: number;
  currentAgent: AgentRole;
  strategyIteration: number;
  maxStrategyIterations: number;
  syntaxHealAttempt: number;
  maxSyntaxHealAttempts: number;
  sequentialMutationRetry: number;
  maxSequentialMutationRetries: number;
  validationFaultCount: number | null;
  judgeDecision: "ACCEPT" | "REVISE" | null;
  currentDetail: CurrentStatusDetail | null;
  phaseSummaries: Record<number, PhaseSummary>;
  phaseDurations: PhaseDuration[];
  totalDurationMs: number | null;
  plannerModel?: string;
  generatorModel?: string;
  judgeModel?: string;
  /** Rolling phase analysis computed from live status events */
  phaseAnalysis?: {
    phaseStates: Record<number, string>;
    failingPhase: number | null;
    strategyIteration: number;
    syntaxHealAttempt: number;
    isSuccess: boolean;
  };
}
