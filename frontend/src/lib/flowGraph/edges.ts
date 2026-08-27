import type { EdgeType } from "@/types/flowGraph";

export interface EdgeDef {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type: EdgeType;
  label?: string;
  curvature?: number;
}

export const ALL_EDGES: EdgeDef[] = [
  // Forward main pipeline (L-Shaped Layout)
  { id: "e1-2", source: "p1", target: "p2", sourceHandle: "right-source", targetHandle: "left-target", type: "forward" },
  { id: "e2-3", source: "p2", target: "p3", sourceHandle: "right-source", targetHandle: "left-target", type: "forward" },
  { id: "e3-4", source: "p3", target: "p4", sourceHandle: "right-source", targetHandle: "left-target", type: "forward" },
  { id: "e4-5", source: "p4", target: "p5", sourceHandle: "bottom-source", targetHandle: "top-target", type: "forward" },
  { id: "e5-6", source: "p5", target: "p6", sourceHandle: "bottom-source", targetHandle: "top-target", type: "forward" },

  // Inner Loop Heal (P4 Validator → P3 Generator)
  { id: "e4-3-heal", source: "p4", target: "p3", sourceHandle: "bottom-source", targetHandle: "bottom-target", type: "syntax_heal", label: "Inner Loop Heal" },

  // Outer Strategy Revision A (P4 Validator → P2 Planner)
  { id: "e4-2-revise", source: "p4", target: "p2", sourceHandle: "bottom-source", targetHandle: "bottom-target", type: "strategy", label: "Validator Strategy Revision" },

  // Outer Strategy Revision B (P5 Judge → P2 Planner)
  { id: "e5-2-revise", source: "p5", target: "p2", sourceHandle: "left-source", targetHandle: "bottom-target", type: "strategy", label: "Judge Strategy Revision" },

  // Abort Circuit (P2 Planner → P6 System Finalization)
  { id: "e2-6-abort", source: "p2", target: "p6", sourceHandle: "bottom-source", targetHandle: "left-target", type: "abort", label: "Circuit Abort" },
];
