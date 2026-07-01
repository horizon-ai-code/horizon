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

export interface GraphNode {
  id: string;
  phase: PhaseMeta;
  status: NodeStatus;
  iteration: number;
  durationMs: number | null;
  modelName?: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  status: EdgeStatus;
  label?: string;
}
