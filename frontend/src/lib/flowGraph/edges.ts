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

/**
 * Deterministic Transition Lookup Map: Maps (sourcePhase -> targetPhase) directly to unique Edge ID.
 */
export const TRANSITION_EDGE_MAP: Record<string, string> = {
  "1->2": "e1-2",          // Baseline -> Strategy
  "2->3": "e2-3",          // Strategy -> Execution
  "3->4": "e3-4",          // Execution -> Validation
  "4->5": "e4-5",          // Validation -> Adjudication
  "5->6": "e5-6",          // Adjudication -> Finalization
  "4->3": "e4-3-heal",     // Inner Loop Heal (Validator -> Generator)
  "4->2": "e4-2-revise",   // Validator Strategy Revision
  "5->2": "e5-2-revise",   // Judge Strategy Revision
  "2->6": "e2-6-abort",    // Circuit Abort
};

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
