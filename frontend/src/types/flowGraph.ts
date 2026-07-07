import type { AgentRole } from "./glassbox";

export type NodeStatus = "waiting" | "active" | "done_ok" | "done_fail" | "skipped" | "flagged";
export type EdgeType = "forward" | "syntax_heal" | "structural_fix" | "strategy" | "abort";
export type EdgeStatus = "dimmed" | "active" | "done";

export interface PhaseMeta {
  num: number;
  name: string;
  agent: AgentRole;
  icon: string;
  color: string;
}

export interface PhaseEvent {
  phase: number;
  role: string;
  status: string;
  content?: string | null;
  outerLoop?: number;
  innerLoop?: number;
}

export interface PhaseAnalysis {
  phaseStates: Record<number, NodeStatus>;
  failingPhase: number | null;
  strategyIteration: number;
  syntaxHealAttempt: number;
  isSuccess: boolean;
}

export interface FlowNodeData extends Record<string, unknown> {
  phase: PhaseMeta;
  status: NodeStatus;
  iteration: number;
  durationMs: number | null;
  modelName?: string;
}

export interface FlowEdgeData extends Record<string, unknown> {
  type: EdgeType;
  status: EdgeStatus;
  label?: string;
}

export interface GraphNode extends FlowNodeData {
  id: string;
  x: number;
  y: number;
}

export interface GraphEdge extends FlowEdgeData {
  id: string;
  source: string;
  target: string;
}
