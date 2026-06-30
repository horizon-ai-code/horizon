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

export const ROLE_VISUALS: Record<string, { step: number; icon: string; colorClass: string; colorClassLight: string }> = {
  Planner:   { step: 1, icon: "Cpu",          colorClass: "text-[#56a8f5]", colorClassLight: "text-[#3574f0]" },
  Generator: { step: 2, icon: "Layers",       colorClass: "text-[#2aacb8]", colorClassLight: "text-[#146a6e]" },
  Validator: { step: 3, icon: "FileCode2",    colorClass: "text-[#00e5ff]", colorClassLight: "text-[#007080]" },
  Judge:     { step: 4, icon: "CheckCircle2", colorClass: "text-[#27c93f]", colorClassLight: "text-[#1a8a30]" },
  System:    { step: 1, icon: "Clock",        colorClass: "text-yellow-400", colorClassLight: "text-[#c4840a]" },
  Monolith:  { step: 1, icon: "Monolith",     colorClass: "text-[#548af7]", colorClassLight: "text-[#3574f0]" },
};

export const DEFAULT_ROLE_VISUALS = {
  step: 1,
  icon: "Cpu",
  colorClass: "text-jb-accent",
};

/** Reverse lookup: icon name → ROLE_VISUALS entry */
export const ROLE_BY_ICON: Record<string, { step: number; icon: string; colorClass: string; colorClassLight: string }> = {};
for (const v of Object.values(ROLE_VISUALS)) {
  ROLE_BY_ICON[v.icon] = v;
}
