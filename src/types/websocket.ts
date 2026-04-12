// ── WebSocket Contract Types (from horizon-api-docs.pdf pp. 7-8) ──────────

export interface RefactorRequest {
  code: string;
  user_instruction: string;
}

export interface StatusMessage {
  type: "status";
  role: "Planner" | "Generator" | "Judge" | "Validator" | "System";
  content: string;
}

export interface ConnectionIdMessage {
  type: "connection_id";
  id: string;
}

export interface PerformanceMetrics {
  avg_gpu_utilization: number;
  avg_gpu_memory: number;
  avg_gpu_memory_used: number;
  inference_time: number;
}

export interface ResultMessage {
  type: "result";
  id: string;
  code: string;
  original_complexity: number | null;
  refactored_complexity: number | null;
  insights: string;
  performance?: PerformanceMetrics;
  planner_model?: string;
  generator_model?: string;
  judge_model?: string;
}

export interface HaltRequest {
  type: "halt";
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
export type ServerMessage = ConnectionIdMessage | StatusMessage | ResultMessage | ErrorMessage;
