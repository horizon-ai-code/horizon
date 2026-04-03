// ── WebSocket Contract Types (from horizon-api-docs.pdf pp. 7-8) ──────────

export interface RefactorRequest {
  code: string;
  user_instruction: string;
}

export interface StatusMessage {
  type: "status";
  role: "Planner" | "Generator" | "Judge" | "Validator";
  content: string;
}

export interface ConnectionIdMessage {
  type: "connection_id";
  id: string;
}

export interface ResultMessage {
  type: "result";
  id: string;
  code: string;
  complexity: number | null;
  insights: string;
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
