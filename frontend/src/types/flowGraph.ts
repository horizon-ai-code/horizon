import type { AgentRole, PhaseSummary } from "./glassbox";

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

export interface FlowNodeData extends Record<string, unknown> {
  phase: PhaseMeta;
  status: NodeStatus;
  iteration: number;
  durationMs: number | null;
  modelName?: string;
  summary?: PhaseSummary;
  isSelected?: boolean;
}

export interface FlowEdgeData extends Record<string, unknown> {
  edgeType: EdgeType;
  status: EdgeStatus;
  label?: string;
  animatedParticle?: boolean;
}

export interface PhaseEvent {
  phase: number;
  role: string;
  status: string;
  content?: string | null;
  outerLoop?: number;
  innerLoop?: number;
}
