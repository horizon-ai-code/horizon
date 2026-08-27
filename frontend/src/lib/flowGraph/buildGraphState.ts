import type { Node, Edge } from "@xyflow/react";
import type { GlassboxState } from "@/types/glassbox";
import type { FlowNodeData, FlowEdgeData, NodeStatus, EdgeStatus } from "@/types/flowGraph";
import { PHASES } from "./phases";
import { ALL_EDGES } from "./edges";

export function buildGraphState(
  glassboxState: GlassboxState,
  appState: string,
  exitStatus?: string,
  selectedNodeId?: string | null
): { nodes: Node<FlowNodeData>[]; edges: Edge<FlowEdgeData>[] } {
  const {
    currentPhase,
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

  // L-Shaped Architecture Layout
  const nodePositions: Record<number, { x: number; y: number }> = {
    1: { x: 40, y: 100 },   // Top Arm: P1 Baseline
    2: { x: 220, y: 100 },  // Top Arm: P2 Strategy
    3: { x: 400, y: 100 },  // Top Arm: P3 Execution
    4: { x: 580, y: 100 },  // Corner Node: P4 Validation
    5: { x: 580, y: 260 }, // Vertical Right Arm: P5 Adjudication (straight down)
    6: { x: 580, y: 420 }, // Vertical Right Arm: P6 Finalization (straight down)
  };

  const nodes: Node<FlowNodeData>[] = PHASES.map((phase) => {
    let status: NodeStatus = "waiting";

    if (states) {
      if (!isDone && phase.num === currentPhase) {
        status = "active";
      } else {
        status = (states[String(phase.num)] as NodeStatus) ?? (phase.num < currentPhase ? "done_ok" : "waiting");
      }
    } else {
      if (isDone) {
        if (exitStatus === "SUCCESS") {
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
      } else {
        if (phase.num < currentPhase) status = "done_ok";
        else if (phase.num === currentPhase) status = "active";
        else status = "waiting";
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
      },
    };
  });

  // 2. Build Edges with precise rerouting origin discrimination
  const edges: Edge<FlowEdgeData>[] = ALL_EDGES.map((edgeDef) => {
    let status: EdgeStatus = "dimmed";
    let animatedParticle = false;

    const sourceNum = parseInt(edgeDef.source.replace("p", ""), 10);
    const failingPhase = glassboxState.failingPhase;
    const isValFailing = failingPhase === 4 || states?.["4"] === "flagged" || states?.["4"] === "done_fail";
    const isJudgeFailing = failingPhase === 5 || states?.["5"] === "flagged" || glassboxState.judgeDecision === "REVISE";

    if (!isDone) {
      // Live processing execution mode
      if (edgeDef.type === "forward") {
        if (sourceNum < currentPhase) {
          status = "done";
        }
        if (sourceNum === currentPhase - 1) {
          status = "active";
          animatedParticle = true;
        }
      } else if (edgeDef.id === "e4-3-heal" && syntaxHealAttempt > 0 && currentPhase === 3) {
        status = "active";
        animatedParticle = true;
      } else if (edgeDef.id === "e4-2-revise" && strategyIteration > 1 && currentPhase === 2 && isValFailing) {
        status = "active";
        animatedParticle = true;
      } else if (edgeDef.id === "e5-2-revise" && strategyIteration > 1 && currentPhase === 2 && isJudgeFailing) {
        status = "active";
        animatedParticle = true;
      } else if (edgeDef.id === "e2-6-abort" && strategyIteration > 3) {
        status = "active";
        animatedParticle = true;
      }
    } else {
      // Finished session recap mode
      if (edgeDef.type === "forward") {
        if (exitStatus === "SUCCESS" || sourceNum < (failingPhase ?? 6)) {
          status = "done";
        }
      } else if (edgeDef.id === "e4-3-heal" && syntaxHealAttempt > 0) {
        status = "done";
      } else if (edgeDef.id === "e4-2-revise" && strategyIteration > 1 && isValFailing) {
        status = "done";
      } else if (edgeDef.id === "e5-2-revise" && strategyIteration > 1 && isJudgeFailing) {
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
