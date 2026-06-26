import type { OrchestrationResult } from "@/types/session";

export const INITIAL_SOURCE = ``;

export const EMPTY_ORCHESTRATION_RESULT: OrchestrationResult = {
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

export { ROLE_VISUALS, DEFAULT_ROLE_VISUALS } from "./agent-registry";
