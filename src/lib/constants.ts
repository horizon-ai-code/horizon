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

export const ROLE_VISUALS: Record<string, { step: number; icon: string; colorClass: string }> = {
  Planner:   { step: 1, icon: "Cpu",          colorClass: "text-[#56a8f5]" },
  Generator: { step: 2, icon: "Layers",       colorClass: "text-[#2aacb8]" },
  Validator: { step: 3, icon: "FileCode2",    colorClass: "text-[#00e5ff]" },
  Judge:     { step: 4, icon: "CheckCircle2", colorClass: "text-[#27c93f]" },
  System:    { step: 1, icon: "Clock",        colorClass: "text-yellow-400" },
};

export const DEFAULT_ROLE_VISUALS = {
  step: 1,
  icon: "Cpu",
  colorClass: "text-jb-accent",
};
