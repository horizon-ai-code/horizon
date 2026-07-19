import type { PhaseMeta } from "@/types/flowGraph";

export const PHASES: PhaseMeta[] = [
  { num: 1, name: "Baseline",     agent: "Validator", icon: "Layers",       color: "#5a8cf8" },
  { num: 2, name: "Strategy",     agent: "Planner",   icon: "Cpu",          color: "#56a8f5" },
  { num: 3, name: "Execution",    agent: "Generator", icon: "Zap",          color: "#3dd6c8" },
  { num: 4, name: "Validation",   agent: "Validator", icon: "FileCode2",    color: "#e09c3b" },
  { num: 5, name: "Adjudication", agent: "Judge",     icon: "CheckCircle2", color: "#4ec97e" },
  { num: 6, name: "Finalization", agent: "System",    icon: "Clock",        color: "#a78bfa" },
];

export const PHASE_BY_NUM = new Map(PHASES.map((p) => [p.num, p]));
export const PHASE_BY_AGENT = new Map(PHASES.map((p) => [p.agent, p]));
