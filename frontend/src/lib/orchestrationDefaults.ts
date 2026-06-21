import type { GlassboxState } from "@/types/glassbox";

export const DEFAULT_GLASSBOX_STATE: GlassboxState = {
  currentPhase: 0,
  currentAgent: "System",
  strategyIteration: 1,
  maxStrategyIterations: 3,
  syntaxHealAttempt: 0,
  maxSyntaxHealAttempts: 3,
  sequentialMutationRetry: 0,
  maxSequentialMutationRetries: 3,
  validationFaultCount: null,
  judgeDecision: null,
  currentDetail: null,
  phaseSummaries: {},
  phaseDurations: [],
  totalDurationMs: null,
};
