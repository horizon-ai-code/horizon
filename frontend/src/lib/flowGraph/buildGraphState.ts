import type { Node, Edge } from "@xyflow/react";
import type { GlassboxState } from "@/types/glassbox";
import type { FlowNodeData, FlowEdgeData, NodeStatus, EdgeStatus } from "@/types/flowGraph";
import { PHASES } from "./phases";
import { ALL_EDGES, TRANSITION_EDGE_MAP } from "./edges";

export function buildGraphState(
  glassboxState: GlassboxState,
  appState: string,
  exitStatus?: string,
  selectedNodeId?: string | null
): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } {
  const {
    currentPhase,
    previousPhase,
    strategyIteration,
    syntaxHealAttempt,
    phaseDurations,
    phaseStates: propStates,
    phaseSummaries,
    plannerModel,
    generatorModel,
    judgeModel,
  } = glassboxState;

  const isDone = appState === "done";
  const states = propStates ?? glassboxState.phaseStates;
  const failingPhase = glassboxState.failingPhase;

  // Lookup active transition edge ID directly from transition map
  const currentTransitionKey = previousPhase && currentPhase ? `${previousPhase}->${currentPhase}` : null;
  const activeEdgeId = currentTransitionKey ? TRANSITION_EDGE_MAP[currentTransitionKey] : null;

  // L-Shaped Architecture Layout (Spaced for larger node dimensions)
  const nodePositions: Record<number, { x: number; y: number }> = {
    1: { x: 40, y: 100 },   // Top Arm: P1 Baseline
    2: { x: 250, y: 100 },  // Top Arm: P2 Strategy
    3: { x: 460, y: 100 },  // Top Arm: P3 Execution
    4: { x: 670, y: 100 },  // Corner Node: P4 Validation
    5: { x: 670, y: 290 }, // Vertical Right Arm: P5 Adjudication (straight down)
    6: { x: 670, y: 480 }, // Vertical Right Arm: P6 Finalization (straight down)
  };

  const visitedSet = new Set(glassboxState.visitedPhases || []);
  const flaggedSet = new Set(glassboxState.flaggedPhases || []);

  // 1. Build Nodes: Only current active & previous source nodes light up in live mode!
  const nodes: Node<FlowNodeData>[] = PHASES.map((phase) => {
    let status: NodeStatus = "waiting";

    if (!isDone) {
      if (phase.num === currentPhase) {
        status = "active";
      } else if (
        flaggedSet.has(phase.num) ||
        states?.[String(phase.num)] === "flagged" ||
        (previousPhase === phase.num && previousPhase > currentPhase) ||
        (phase.num === 4 && (syntaxHealAttempt > 0 || failingPhase === 4))
      ) {
        // Flagged reroute origin nodes stay glowing amber
        status = "flagged";
      } else if (previousPhase && phase.num === previousPhase) {
        status = (states?.[String(phase.num)] as NodeStatus) ?? "done_ok";
      } else if (phase.num < currentPhase || visitedSet.has(phase.num)) {
        status = (states?.[String(phase.num)] as NodeStatus) === "flagged" ? "flagged" : "done_ok";
      } else {
        status = (states?.[String(phase.num)] as NodeStatus) ?? "waiting";
      }
    } else {
      // Finished session recap mode
      if (states) {
        status = (states[String(phase.num)] as NodeStatus) ?? (phase.num < currentPhase ? "done_ok" : "waiting");
      } else if (exitStatus === "SUCCESS") {
        status = "done_ok";
      } else if (phase.num === 6) {
        status = exitStatus ? "done_fail" : "done_ok";
      } else if (phase.num < currentPhase) {
        status = "done_ok";
      } else if (phase.num === currentPhase) {
        status = "done_fail";
      } else {
        status = "skipped";
      }
    }

    const duration = phaseDurations.find((d) => d.phase === phase.num);
    const summary = phaseSummaries ? phaseSummaries[phase.num] : undefined;

    const modelName =
      phase.num === 2
        ? plannerModel
        : phase.num === 3
        ? generatorModel
        : phase.num === 5
        ? judgeModel
        : undefined;

    const iteration =
      phase.num === 2
        ? strategyIteration
        : phase.num === 3
        ? Math.max(syntaxHealAttempt, 1)
        : 1;

    const pos = nodePositions[phase.num] || { x: phase.num * 180, y: 100 };

    return {
      id: `p${phase.num}`,
      type: "circularNode",
      position: pos,
      data: {
        phase,
        status,
        iteration,
        durationMs: duration?.durationMs ?? null,
        modelName,
        summary,
        isSelected: selectedNodeId === `p${phase.num}`,
        isPrevious: !isDone && previousPhase === phase.num,
        isCurrent: !isDone && currentPhase === phase.num,
        isDoneSession: isDone,
      },
    };
  });

  // 2. Build Edges: Active transition edge streams particles, completed forward edges stay green, reroute edges stay lit
  const edges: Edge<FlowEdgeData>[] = ALL_EDGES.map((edgeDef) => {
    let status: EdgeStatus = "dimmed";
    let animatedParticle = false;

    const sourceNum = parseInt(edgeDef.source.replace("p", ""), 10);
    const targetNum = parseInt(edgeDef.target.replace("p", ""), 10);

    if (!isDone) {
      if (edgeDef.id === activeEdgeId) {
        status = "active";
        animatedParticle = true;
      } else if (edgeDef.type === "forward" && (sourceNum < currentPhase || visitedSet.has(targetNum))) {
        status = "done";
      } else if (
        edgeDef.id === "e4-3-heal" &&
        currentPhase === 3 &&
        (syntaxHealAttempt > 0 || flaggedSet.has(4) || previousPhase === 4)
      ) {
        status = "done";
        animatedParticle = true;
      } else if (
        edgeDef.id === "e4-2-revise" &&
        currentPhase === 2 &&
        strategyIteration > 1 &&
        (flaggedSet.has(4) || previousPhase === 4 || states?.["4"] === "flagged")
      ) {
        status = "done";
        animatedParticle = true;
      } else if (
        edgeDef.id === "e5-2-revise" &&
        currentPhase === 2 &&
        strategyIteration > 1 &&
        (flaggedSet.has(5) || previousPhase === 5 || states?.["5"] === "flagged")
      ) {
        status = "done";
        animatedParticle = true;
      }
    }
 else {
      // Finished session recap mode: Light up all traversed paths for post-run review
      if (edgeDef.type === "forward") {
        if (exitStatus === "SUCCESS" || sourceNum < (failingPhase ?? 6)) {
          status = "done";
        }
      } else if (edgeDef.id === "e4-3-heal" && (syntaxHealAttempt > 0 || flaggedSet.has(4) || states?.["4"] === "flagged")) {
        status = "done";
      } else if (edgeDef.id === "e4-2-revise" && strategyIteration > 1 && (failingPhase === 4 || states?.["4"] === "flagged" || flaggedSet.has(4))) {
        status = "done";
      } else if (edgeDef.id === "e5-2-revise" && strategyIteration > 1 && (failingPhase === 5 || states?.["5"] === "flagged" || flaggedSet.has(5))) {
        status = "done";
      } else if (edgeDef.id === "e2-6-abort" && exitStatus && exitStatus !== "SUCCESS") {
        status = "done";
      }
    }

    return {
      id: edgeDef.id,
      source: edgeDef.source,
      target: edgeDef.target,
      sourceHandle: edgeDef.sourceHandle,
      targetHandle: edgeDef.targetHandle,
      type: "customCurvedEdge",
      data: {
        edgeType: edgeDef.type,
        status,
        label: edgeDef.label,
        animatedParticle,
      },
    };
  });

  return { nodes, edges };
}
