// ── WebSocket Contract Types (from horizon-api-docs) ──────────────────────

export interface RefactorRequest {
  type: "multi";
  code: string;
  user_instruction: string;
}

export interface StatusMessage {
  type: "status";
  role: "Planner" | "Generator" | "Judge" | "Validator" | "System" | "Monolith";
  content: string;
  phase?: number;
}

export interface ConnectionIdMessage {
  type: "connection_id";
  id: string;
  created_at?: string;
}

export interface PerformanceMetrics {
  avg_gpu_utilization: number;
  avg_gpu_memory: number;
  avg_gpu_memory_used: number;
  peak_gpu_utilization?: number;
  peak_gpu_memory_used?: number;
  inference_time: number;
}

export type ExitStatus =
  | "SUCCESS"
  | "ABORT_STRATEGY"
  | "ABORT_SYNTAX"
  | "ABORT_SEMANTIC"
  | "PROCESSING";

export interface PingMessage {
  type: "ping";
  id: string;
  ts: string;
}

export interface HaltAcknowledgedMessage {
  type: "halt_acknowledged";
  id: string;
}

export interface InsightItem {
  title: string;
  details: string;
}

export interface InsightsMessage {
  type: "insights";
  id: string;
  insights: InsightItem[] | string;
}

export interface ResultMessage {
  type: "result";
  id: string;
  code: string;
  exit_status: ExitStatus;
  original_complexity: number | null;
  refactored_complexity: number | null;
  performance: PerformanceMetrics;
  planner_model: string | null;
  generator_model: string | null;
  judge_model: string | null;
}

export interface SingleRequest {
  type: "single";
  code: string;
  user_instruction: string;
}

export interface HaltRequest {
  type: "halt";
}

export interface PongRequest {
  type: "pong";
}

export interface ReconnectRequest {
  type: "reconnect";
  session_id: string;
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

// ── Structured Glassbox Messages ───────────────────────────────────────────

export interface PhaseStartedMessage {
  type: "phase_started";
  phase: number;
  name: string;
  agent: string;
  strategy_iteration: number;
  max_strategy_iterations: number;
  timestamp: string;
}

export interface PhaseCompletedMessage {
  type: "phase_completed";
  phase: number;
  name: string;
  duration_ms: number;
  status: "success" | "retrying" | "failed";
  timestamp: string;
}

export interface MutationItemPayload {
  action: string;
  target: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "failed";
}

export interface MutationPlanMessage {
  type: "mutation_plan";
  target_class?: string;
  mutations: MutationItemPayload[];
}

export interface MutationStatusMessage {
  type: "mutation_status";
  action: string;
  target: string;
  attempt: number;
  max_attempts: number;
  status: "in_progress" | "completed" | "retrying" | "failed";
  error?: string;
}

export interface ValidationCheckPayload {
  tier: string;
  name: string;
  passed: boolean;
  details?: string | null;
  before_value?: number;
  after_value?: number;
}

export interface ValidationResultMessage {
  type: "validation_result";
  strategy_iteration: number;
  checks: ValidationCheckPayload[];
  total_passed: number;
  total_failed: number;
}

export interface IntentClassifiedMessage {
  type: "intent_classified";
  category: string;
  intent: string;
  target_unit?: string;
  target_class?: string;
  target_member?: string;
  confidence?: number;
}

export interface ArchitectureTargetPayload {
  name: string;
  kind: string;
  purpose?: string;
}

export interface ArchitectureAnalysisMessage {
  type: "architecture_analysis";
  primary_targets: ArchitectureTargetPayload[];
  secondary_targets: ArchitectureTargetPayload[];
  new_structures: ArchitectureTargetPayload[];
  must_preserve: ArchitectureTargetPayload[];
}

export interface JudgeIssuePayload {
  issue_type: string;
  description: string;
  severity?: "low" | "medium" | "high";
}

export interface AuditResultMessage {
  type: "audit_result";
  verdict: "ACCEPT" | "REVISE";
  issues?: JudgeIssuePayload[];
  attempt: number;
  max_attempts: number;
}

export interface GeneratorProgressMessage {
  type: "generator_progress";
  mutations_completed: number;
  mutations_total: number;
  temperature?: number;
  sample_index?: number;
  total_samples?: number;
}

export interface PhaseTimingPayload {
  phase: number;
  duration_ms: number;
}

export interface PhaseTimingSummaryMessage {
  type: "phase_timing_summary";
  total_duration_ms: number;
  phases: PhaseTimingPayload[];
}

export type StructuredMessage =
  | PhaseStartedMessage
  | PhaseCompletedMessage
  | MutationPlanMessage
  | MutationStatusMessage
  | ValidationResultMessage
  | IntentClassifiedMessage
  | ArchitectureAnalysisMessage
  | AuditResultMessage
  | GeneratorProgressMessage
  | PhaseTimingSummaryMessage;

export type ServerMessage =
  | ConnectionIdMessage
  | PingMessage
  | StatusMessage
  | ResultMessage
  | InsightsMessage
  | HaltAcknowledgedMessage
  | ErrorMessage
  | StructuredMessage;
