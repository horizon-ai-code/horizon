import React from "react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, AlertCircle } from "lucide-react";

export interface PipelinePhase {
  num: number;
  name: string;
  agent: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  color: string;
}

export const PIPELINE_PHASES: PipelinePhase[] = [
  { num: 1, name: "Baseline", agent: "Validator", icon: Cpu, color: "#56a8f5" },
  { num: 2, name: "Strategy", agent: "Planner", icon: Cpu, color: "#5a8cf8" },
  { num: 3, name: "Execution", agent: "Generator", icon: Layers, color: "#3dd6c8" },
  { num: 4, name: "Validation", agent: "Validator", icon: FileCode2, color: "#e09c3b" },
  { num: 5, name: "Audit", agent: "Judge", icon: CheckCircle2, color: "#4ec97e" },
  { num: 6, name: "Finalize", agent: "System", icon: Clock, color: "#a78bfa" },
];

export function getPhaseStatus(phaseNum: number, currentPhase: number): "done" | "active" | "waiting" {
  if (phaseNum < currentPhase) return "done";
  if (phaseNum === currentPhase) return "active";
  return "waiting";
}
