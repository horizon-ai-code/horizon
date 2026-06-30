import type { GlassboxState } from "@/types/glassbox";
import type { GraphNode, GraphEdge, NodeStatus, EdgeStatus } from "@/types/flowGraph";
import { PHASES } from "./phases";
import { ALL_EDGES, type EdgeDef } from "./edges";

// 3×2 zigzag grid positions (top-left corner of each 260×260 node)
const GAP_X = 420;
const GAP_Y = 480;

export const GRID_POSITIONS: Record<string, { x: number; y: number }> = {
  p1: { x: 0, y: 0 },
  p2: { x: GAP_X, y: 0 },
  p3: { x: GAP_X * 2, y: 0 },
  p4: { x: 0, y: GAP_Y },
  p5: { x: GAP_X, y: GAP_Y },
  p6: { x: GAP_X * 2, y: GAP_Y },
};

export function buildGraphState(
  glassboxState: GlassboxState,
  appState: string,
  exitStatus?: string,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const {
    currentPhase, strategyIteration, syntaxHealAttempt,
    validationFaultCount, phaseDurations,
  } = glassboxState;

  const isDone = appState === "done";
  const isSuccess = exitStatus === "SUCCESS";
  const isAbort = !isDone ? false : (!isSuccess && !!exitStatus && exitStatus !== "PROCESSING");

  // ── Build nodes ──

  const nodes: GraphNode[] = PHASES.map((phase) => {
    let status: NodeStatus;

    if (isDone) {
      if (phase.num === 6) {
        status = isAbort ? "done_fail" : "done_ok";
      } else if (phase.num < currentPhase || (phase.num === currentPhase && isSuccess)) {
        status = "done_ok";
      } else if (phase.num === currentPhase) {
        status = "done_fail";
      } else {
        status = "skipped";
      }
    } else {
      if (phase.num < currentPhase) {
        status = "done_ok";
      } else if (phase.num === currentPhase) {
        status = "active";
      } else {
        status = "waiting";
      }
    }

    const duration = phaseDurations.find((d) => d.phase === phase.num);
    const pos = GRID_POSITIONS[`p${phase.num}`];

    return {
      id: `p${phase.num}`,
      phase,
      status,
      iteration: phase.num === 2
        ? strategyIteration
        : phase.num === 3
          ? Math.max(syntaxHealAttempt, 1)
          : 1,
      durationMs: duration?.durationMs ?? null,
      modelName: phase.agent === "Planner"
        ? glassboxState.plannerModel
        : phase.agent === "Generator"
          ? glassboxState.generatorModel
          : phase.agent === "Judge"
            ? glassboxState.judgeModel
            : undefined,
      x: pos!.x,
      y: pos!.y,
    };
  });

  // ── Build edges ──

  function edgeStatus(def: EdgeDef): EdgeStatus {
    if (isDone) {
      switch (def.type) {
        case "forward":
          return sourceDone(def) ? "done" : "dimmed";
        case "syntax_heal":
        case "structural_fix":
          return "dimmed";
        case "strategy":
          return strategyIteration > 1 ? "done" : "dimmed";
        case "abort":
          return isAbort ? "done" : "dimmed";
      }
    }

    switch (def.type) {
      case "forward":
        if (sourceDone(def)) return "done";
        if (currentPhase >= targetNum(def)) return "active";
        return "dimmed";
      case "syntax_heal":
        return (syntaxHealAttempt > 0 && currentPhase === 3) ? "active" : "dimmed";
      case "structural_fix":
        return (validationFaultCount !== null && validationFaultCount > 0 && currentPhase === 3) ? "active" : "dimmed";
      case "strategy":
        return (strategyIteration > 1 && currentPhase === 2) ? "active" : "dimmed";
      case "abort":
        return "dimmed";
    }
  }

  function sourceDone(def: EdgeDef): boolean {
    return parseInt(def.source.replace("p", "")) < currentPhase;
  }

  function targetNum(def: EdgeDef): number {
    return parseInt(def.target.replace("p", ""));
  }

  const edges: GraphEdge[] = ALL_EDGES.map((def) => ({
    id: def.id,
    source: def.source,
    target: def.target,
    type: def.type,
    status: edgeStatus(def),
    label: def.label,
  }));

  return { nodes, edges };
}
