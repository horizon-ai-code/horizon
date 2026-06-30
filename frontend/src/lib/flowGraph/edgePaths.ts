import type { EdgeType } from "@/types/flowGraph";
import { GRID_POSITIONS } from "./buildGraphState";

const NODE_SIZE = 260;

type HandleSide = "top" | "bottom" | "left" | "right";

function handlePos(nodeId: string, side: HandleSide): { x: number; y: number } {
  const n = GRID_POSITIONS[nodeId];
  if (!n) return { x: 0, y: 0 };
  switch (side) {
    case "top":    return { x: n.x + NODE_SIZE / 2, y: n.y };
    case "bottom": return { x: n.x + NODE_SIZE / 2, y: n.y + NODE_SIZE };
    case "left":   return { x: n.x, y: n.y + NODE_SIZE / 2 };
    case "right":  return { x: n.x + NODE_SIZE, y: n.y + NODE_SIZE / 2 };
  }
}

const HANDLE_MAP: Record<string, [HandleSide, HandleSide]> = {
  "e1-2":           ["right", "left"],
  "e2-3":           ["right", "left"],
  "e3-4":           ["bottom", "top"],
  "e4-5":           ["right", "left"],
  "e5-6":           ["right", "left"],
  "e3-3-heal":      ["right", "top"],
  "e3-3-fallback":  ["bottom", "top"],
  "e4-3-fix":       ["top", "bottom"],
  "e2-2-revise":    ["left", "top"],
  "e3-2-revise":    ["top", "left"],
  "e4-2-revise":    ["left", "top"],
  "e5-2-revise":    ["left", "top"],
  "e3-6-abort":     ["bottom", "top"],
  "e5-6-abort":     ["right", "top"],
};

interface BezierArgs {
  ax: number; ay: number;
  bx: number; by: number;
  cx: number; cy: number;
  dx: number; dy: number;
}

function cubicBezier(p: BezierArgs): string {
  return `M ${p.ax} ${p.ay} C ${p.bx} ${p.by}, ${p.cx} ${p.cy}, ${p.dx} ${p.dy}`;
}

export function edgePath(edgeId: string): string {
  const sides = HANDLE_MAP[edgeId];
  if (!sides) return "";

  // Extract source/target node IDs from the edge ID pattern (e.g. "e3-3-heal" → source="p3", target="p3")
  const parts = edgeId.split("-");
  const source = `p${parts[1]}`;
  const target = `p${parts[2]}`;

  const from = handlePos(source, sides[0]);
  const to = handlePos(target, sides[1]);

  // Self-loop (same node)
  if (source === target) {
    const n = GRID_POSITIONS[source];
    if (!n) return "";
    const loopTop = n.y - 80;
    const mid = n.x + NODE_SIZE / 2;
    return cubicBezier({
      ax: from.x, ay: from.y,
      bx: from.x + 50, by: loopTop,
      cx: to.x - 50, cy: loopTop,
      dx: to.x, dy: to.y,
    });
  }

  // Forward zigzag: P3 bottom → P4 top
  if (edgeId === "e3-4") {
    const midY = (from.y + to.y) / 2;
    return cubicBezier({
      ax: from.x, ay: from.y,
      bx: from.x, by: midY,
      cx: to.x, cy: midY,
      dx: to.x, dy: to.y,
    });
  }

  // Strategy revise: long arcs to P2 (top-left)
  if (edgeId.endsWith("-revise") && edgeId !== "e2-2-revise") {
    const midX = (from.x + to.x) / 2 - 60;
    const midY = (from.y + to.y) / 2;
    return cubicBezier({
      ax: from.x, ay: from.y,
      bx: midX, by: from.y,
      cx: midX, cy: to.y,
      dx: to.x, dy: to.y,
    });
  }

  // Abort to P6
  if (edgeId.endsWith("-abort")) {
    const midX = Math.max(from.x, to.x) + 60;
    const midY = (from.y + to.y) / 2;
    return cubicBezier({
      ax: from.x, ay: from.y,
      bx: midX, by: from.y,
      cx: midX, cy: to.y,
      dx: to.x, dy: to.y,
    });
  }

  // Structural fix (P4 top → P3 bottom)
  if (edgeId === "e4-3-fix") {
    const midX = (from.x + to.x) / 2;
    return cubicBezier({
      ax: from.x, ay: from.y,
      bx: midX, by: from.y,
      cx: midX, cy: to.y,
      dx: to.x, dy: to.y,
    });
  }

  // Default horizontal curve
  const dx = to.x - from.x;
  const cp = Math.abs(dx) * 0.4;
  return cubicBezier({
    ax: from.x, ay: from.y,
    bx: from.x + cp, by: from.y,
    cx: to.x - cp, cy: to.y,
    dx: to.x, dy: to.y,
  });
}

export function edgeColor(type: EdgeType, status: "dimmed" | "active" | "done"): string {
  if (status === "dimmed") return "#555";
  switch (type) {
    case "forward": return "#4ec97e";
    case "syntax_heal":
    case "structural_fix": return "#e09c3b";
    case "strategy": return "#56a8f5";
    case "abort": return "#f93e3e";
  }
}

export function edgeStyle(type: EdgeType, status: "dimmed" | "active" | "done"): React.CSSProperties {
  const dim = { stroke: "#555", strokeWidth: 1.5, opacity: 0.15 };
  if (status === "dimmed") {
    switch (type) {
      case "syntax_heal":
      case "structural_fix":
        return { ...dim, strokeDasharray: "6 3" };
      case "strategy":
        return { ...dim, strokeDasharray: "4 4" };
      default:
        return dim;
    }
  }
  switch (type) {
    case "forward":
      return { stroke: "#4ec97e", strokeWidth: 2.5, opacity: status === "active" ? 1 : 0.5 };
    case "syntax_heal":
      return { stroke: "#e09c3b", strokeWidth: 2, opacity: 1, strokeDasharray: "6 3" };
    case "structural_fix":
      return { stroke: "#e09c3b", strokeWidth: 2, opacity: 1, strokeDasharray: "6 3" };
    case "strategy":
      return { stroke: "#56a8f5", strokeWidth: 2, opacity: 1, strokeDasharray: "4 4" };
    case "abort":
      return { stroke: "#f93e3e", strokeWidth: 2.5, opacity: 1 };
    default:
      return { stroke: "#4ec97e", strokeWidth: 2, opacity: 0.5 };
  }
}
