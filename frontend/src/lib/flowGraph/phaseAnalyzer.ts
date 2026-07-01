import type { PhaseEvent, PhaseAnalysis, NodeStatus } from "@/types/flowGraph";

export function accumulateEvents(
  events: PhaseEvent[],
  exitStatus: string | undefined,
  totalStrategyIters?: number,
): PhaseAnalysis {
  const isSuccess = exitStatus === "SUCCESS";
  const errorFlags: Record<number, boolean> = {};
  let highestPhase = 0;
  let strategy = 1;

  for (const e of events) {
    const p = e.phase;
    // Phase 6 (Finalization) always runs on abort — don't include in highestPhase
    if (p > highestPhase && p !== 6) highestPhase = p;
    // outerLoop in DB is 0-based strategy iteration counter
    if (e.outerLoop !== undefined && e.outerLoop + 1 > strategy) strategy = e.outerLoop + 1;
    if (e.innerLoop && e.innerLoop > 0) { /* track syntax — for future use */ }

    const st = e.status || "";
    const ct = e.content || "";

    // Phase 2 — synthesize retry
    if (p === 2 && (st.includes("Retrying") || ct.includes("retrying"))) {
      errorFlags[2] = true;
    }

    // Phase 3 — syntax / no-code fail
    if (p === 3) {
      if (
        st.includes("No") || st.includes("fail") || st.includes("Retrying") ||
        ct.includes("fail") || ct.includes("retrying")
      ) {
        errorFlags[3] = true;
      }
    }

    // Phase 4 — validation failures
    if (p === 4) {
      if (
        st.includes("Fail") || st.includes("failed") ||
        st.includes("Unrecoverable") || st.includes("unchanged") ||
        ct.includes("failed")
      ) {
        errorFlags[4] = true;
      }
    }

    // Phase 5 — judge REVISE
    if (p === 5) {
      if (
        st.includes("REVISE") || st.includes("retrying") ||
        ct.includes("REVISE")
      ) {
        errorFlags[5] = true;
      }
    }
  }

  // Use totalStrategyIters as fallback when outer_loop is 0 in logs
  if (totalStrategyIters && totalStrategyIters > strategy) {
    strategy = totalStrategyIters;
  }

  // Determine which phase caused the final abort
  let failingPhase: number | null = null;
  if (isSuccess) {
    failingPhase = null;
  } else if (errorFlags[5]) {
    failingPhase = 5;
  } else if (errorFlags[4]) {
    failingPhase = 4;
  } else if (errorFlags[3]) {
    failingPhase = 3;
  } else if (strategy > 3) {
    failingPhase = 2;
  } else if (highestPhase > 0) {
    failingPhase = highestPhase;
  }

  // Build per-phase status
  const phaseStates: Record<number, NodeStatus> = {};

  for (let num = 1; num <= 6; num++) {
    if (num === 6) {
      phaseStates[6] = isSuccess ? "done_ok" : "done_fail";
    } else if (num === failingPhase) {
      phaseStates[num] = "done_fail";
    } else if (errorFlags[num]) {
      phaseStates[num] = "flagged";
    } else if (num <= highestPhase) {
      phaseStates[num] = "done_ok";
    } else {
      phaseStates[num] = "skipped";
    }
  }

  return {
    phaseStates,
    failingPhase,
    strategyIteration: strategy,
    syntaxHealAttempt: 0,
    isSuccess,
  };
}
