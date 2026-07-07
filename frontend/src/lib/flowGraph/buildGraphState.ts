import type { GlassboxState } from "@/types/glassbox";
import type { NodeStatus } from "@/types/flowGraph";

type EdgeStatus = "dimmed" | "active" | "done";

export function buildGraphState(
  glassboxState: GlassboxState,
  appState: string,
  exitStatus?: string,
): {
  nodeStates: Record<number, NodeStatus>;
  edgeStates: Record<string, EdgeStatus>;
} {
  const {
    currentPhase, strategyIteration, syntaxHealAttempt,
    phaseStates,
  } = glassboxState;

  const isDone = appState === "done";

  // ── Node status ──
  const nodeStates: Record<number, NodeStatus> = {};

  for (let n = 1; n <= 6; n++) {
    if (isDone) {
      if (phaseStates) {
        nodeStates[n] = (phaseStates[String(n)] as NodeStatus) ?? "skipped";
      } else {
        nodeStates[n] = n <= currentPhase ? "done_ok" : "skipped";
      }
    } else {
      if (n < currentPhase) nodeStates[n] = "done_ok";
      else if (n === currentPhase) nodeStates[n] = "active";
      else nodeStates[n] = "waiting";
    }
  }

  // ── Edge status ──
  const edgeStates: Record<string, EdgeStatus> = {};

  function mark(id: string, status: EdgeStatus) {
    edgeStates[id] = status;
  }

  // Forward edges
  mark("e1-2", isDone ? "done" : currentPhase >= 2 ? (currentPhase === 2 ? "active" : "done") : "dimmed");
  mark("e2-3", isDone ? "done" : currentPhase >= 3 ? (currentPhase === 3 ? "active" : "done") : "dimmed");
  mark("e3-4", isDone ? "done" : currentPhase >= 4 ? (currentPhase === 4 ? "active" : "done") : "dimmed");
  mark("e4-5", isDone ? "done" : currentPhase >= 5 ? (currentPhase === 5 ? "active" : "done") : "dimmed");
  mark("e5-6", isDone ? "done" : currentPhase >= 6 ? "active" : "dimmed");

  // Self-loops
  if (isDone) {
    mark("e2-2-retry", strategyIteration > 1 ? "done" : "dimmed");
    mark("e3-3-heal", syntaxHealAttempt > 1 ? "done" : "dimmed");
  } else {
    mark("e2-2-retry", currentPhase === 2 && strategyIteration > 1 ? "active" : "dimmed");
    mark("e3-3-heal", currentPhase === 3 && syntaxHealAttempt > 1 ? "active" : "dimmed");
  }

  // Left bus — revise (P3→P2, P4→P2)
  if (isDone) {
    mark("e3-2-revise", strategyIteration > 1 ? "done" : "dimmed");
    mark("e4-2-revise", strategyIteration > 1 ? "done" : "dimmed");
  } else {
    const reviseActive = strategyIteration > 1 && currentPhase >= 2;
    mark("e3-2-revise", reviseActive && currentPhase <= 3 ? "done" : reviseActive ? "active" : "dimmed");
    mark("e4-2-revise", reviseActive && currentPhase <= 4 ? "done" : reviseActive ? "active" : "dimmed");
  }

  // Left bus — abort (P3→P6)
  if (isDone) {
    mark("e3-6-abort", exitStatus?.startsWith("ABORT") ? "done" : "dimmed");
  } else {
    mark("e3-6-abort", currentPhase === 6 && exitStatus?.startsWith("ABORT") ? "done" : "dimmed");
  }

  // Right bus — revise (P5→P2)
  if (isDone) {
    mark("e5-2-revise", strategyIteration > 1 ? "done" : "dimmed");
  } else {
    mark("e5-2-revise", strategyIteration > 1 && currentPhase <= 5 ? "active" : "dimmed");
  }

  // Right bus — fix (P4→P3)
  if (isDone) {
    mark("e4-3-fix", strategyIteration > 1 ? "done" : "dimmed");
  } else {
    mark("e4-3-fix", currentPhase >= 4 && syntaxHealAttempt > 1 ? "active" : "dimmed");
  }

  return { nodeStates, edgeStates };
}
