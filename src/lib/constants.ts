import type { OrchestrationResult } from "@/types/session";

export const INITIAL_SOURCE = ``;

export const INITIAL_REFACTORED = ``;

export const EMPTY_ORCHESTRATION_RESULT: OrchestrationResult = {
  replaySteps: [],
  metrics: [],
  summary: "",
  diffHighlights: {
    added: [],
    removed: [],
  },
  planner_model: "",
  generator_model: "",
  judge_model: "",
};
