import type { AgentRole } from "./glassbox";

export type NodeStatus = "waiting" | "active" | "done_ok" | "done_fail" | "skipped";
export type EdgeType = "forward" | "syntax_heal" | "structural_fix" | "strategy" | "abort";
export type EdgeStatus = "dimmed" | "active" | "done";

export interface PhaseMeta {
  num: number;
  name: string;
  agent: AgentRole;
  icon: string;
  color: string;
}

export interface FlowNodeData {
  phase: PhaseMeta;
  status: NodeStatus;
  iteration: number;
  durationMs: number | null;
  modelName?: string;
}

export interface FlowEdgeData {
  type: EdgeType;
  status: EdgeStatus;
  label?: string;
}

export interface FlowGraphState {
  nodes: import("@xyflow/react").Node<FlowNodeData>[];
  edges: import("@xyflow/react").Edge<FlowEdgeData>[];
}
