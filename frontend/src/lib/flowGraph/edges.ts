import type { EdgeType } from "@/types/flowGraph";

export interface EdgeDef {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
}

export const ALL_EDGES: EdgeDef[] = [
  { id: "e1-2", source: "p1", target: "p2", type: "forward" },
  { id: "e2-3", source: "p2", target: "p3", type: "forward" },
  { id: "e3-4", source: "p3", target: "p4", type: "forward" },
  { id: "e4-5", source: "p4", target: "p5", type: "forward" },
  { id: "e5-6", source: "p5", target: "p6", type: "forward" },

  { id: "e3-3-heal", source: "p3", target: "p3", type: "syntax_heal", label: "Syntax Heal" },

  { id: "e4-3-fix", source: "p4", target: "p3", type: "structural_fix", label: "Structural Fix" },

  { id: "e2-2-revise", source: "p2", target: "p2", type: "strategy", label: "Retry" },
  { id: "e3-2-revise", source: "p3", target: "p2", type: "strategy", label: "Revise Strategy" },
  { id: "e4-2-revise", source: "p4", target: "p2", type: "strategy", label: "Revise Strategy" },
  { id: "e5-2-revise", source: "p5", target: "p2", type: "strategy", label: "Revise Strategy" },

  { id: "e3-6-abort", source: "p3", target: "p6", type: "abort", label: "Abort" },
  { id: "e5-6-abort", source: "p5", target: "p6", type: "abort", label: "Abort" },
];
