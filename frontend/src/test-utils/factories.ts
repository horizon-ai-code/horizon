import type { SessionData, TerminalEntry, OrchestrationResult } from '@/types/session';
import type { GlassboxState } from '@/types/glassbox';

export function createMockSession(overrides?: Partial<SessionData>): SessionData {
  return {
    id: 'test-session',
    title: 'Test Session',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sourceCode: '',
    refactoredOutput: '',
    activeStep: 0,
    inputInstruction: '',
    terminalEntries: [],
    isTerminalCollapsed: false,
    appState: 'idle',
    showFlowchartModal: false,
    isMonolith: false,
    orchestrationResult: createMockOrchestrationResult(),
    ...overrides,
  };
}

export function createMockTerminalEntry(overrides?: Partial<TerminalEntry>): TerminalEntry {
  return {
    id: 'entry-1',
    type: 'log',
    text: 'Test entry',
    timestamp: '12:00:00',
    ...overrides,
  };
}

export function createMockOrchestrationResult(overrides?: Partial<OrchestrationResult>): OrchestrationResult {
  return {
    metrics: [],
    summary: '',
    diffHighlights: { added: [], removed: [] },
    ...overrides,
  };
}

export function createMockGlassboxState(overrides?: Partial<GlassboxState>): GlassboxState {
  return {
    currentPhase: 0,
    currentAgent: 'System',
    strategyIteration: 1,
    maxStrategyIterations: 3,
    syntaxHealAttempt: 0,
    maxSyntaxHealAttempts: 3,
    sequentialMutationRetry: 0,
    maxSequentialMutationRetries: 3,
    validationFaultCount: 0,
    judgeDecision: null,
    currentDetail: null,
    phaseSummaries: [],
    phaseDurations: [],
    totalDurationMs: 0,
    ...overrides,
  };
}
