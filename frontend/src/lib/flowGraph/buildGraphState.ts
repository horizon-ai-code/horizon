import type { Node, Edge } from "@xyflow/react";
import type { CSSProperties } from "react";
import type { GlassboxState } from "@/types/glassbox";
import type { FlowNodeData, FlowEdgeData, NodeStatus, EdgeStatus } from "@/types/flowGraph";
import { PHASES } from "./phases";
import { ALL_EDGES, type EdgeDef } from "./edges";

export function buildGraphState(
  glassboxState: GlassboxState,
  appState: string,
  exitStatus?: string,
): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } {
  const {
    currentPhase, currentAgent, strategyIteration, syntaxHealAttempt,
    validationFaultCount, judgeDecision, phaseDurations, totalDurationMs,
  } = glassboxState;

  const isDone = appState === "done";
  const isSuccess = exitStatus === "SUCCESS";
  const isAbort = !isDone ? false : (!isSuccess && !!exitStatus && exitStatus !== "PROCESSING");

  // ── Build nodes ──

  const nodes: Node<FlowNodeData>[] = PHASES.map((phase) => {
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

    return {
      id: `p${phase.num}`,
      type: "phaseNode",
      position: { x: 0, y: 0 },
      data: {
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
      },
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

    // Live
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
    const srcNum = parseInt(def.source.replace("p", ""));
    return srcNum < currentPhase;
  }

  function targetNum(def: EdgeDef): number {
    return parseInt(def.target.replace("p", ""));
  }

  const edges: Edge<FlowEdgeData>[] = ALL_EDGES.map((def) => {
    const status = edgeStatus(def);
    return {
      id: def.id,
      source: def.source,
      target: def.target,
      type: "smoothstep",
      data: { type: def.type, status, label: def.label },
      style: edgeStyle(def.type, status),
      animated: status === "active",
    };
  });

  return { nodes, edges };
}

function edgeStyle(type: string, status: EdgeStatus): CSSProperties {
  const dim: CSSProperties = { stroke: "#555", strokeWidth: 1.5, opacity: 0.15 };

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
