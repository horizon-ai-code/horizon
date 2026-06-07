export type AgentRole = "Planner" | "Generator" | "Validator" | "Judge" | "System";

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
}

export interface ValidationFinding {
  tier: string;
  description: string;
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
  judgeVerdict?: "ACCEPT" | "REVISE";
  judgeIssues?: JudgeIssue[];
  phaseName?: string;
  phaseAction?: string;
}

export interface PhaseSummary {
  summary: string;
  detail: CurrentStatusDetail | null;
  timestamp: number;
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
}
