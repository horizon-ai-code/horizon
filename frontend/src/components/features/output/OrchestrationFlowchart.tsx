"use client"

import React from "react";
import { Cpu, Layers, FileCode2, CheckCircle2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { GlassboxState } from "@/types/glassbox";

type NodeStatus = "active" | "done" | "waiting";

interface FlowNodeProps {
  icon: LucideIcon;
  title: string;
  desc: string;
  status: NodeStatus;
  colorCode: string;
  modelName?: string;
}

const FlowNode = ({ icon: Icon, title, desc, status, colorCode, modelName }: FlowNodeProps) => {
  const getColors = () => {
    if (status === "active") return "bg-jb-bg ring-1 ring-jb-accent/50 shadow-[0_0_20px_rgba(53,116,240,0.15)] text-jb-accent";
    return "bg-jb-panel/50 ring-1 ring-jb-border text-jb-text-muted";
  };
  return (
    <div className={`relative flex flex-col items-center justify-center p-3 w-32 h-32 rounded-[20px] transition-transform duration-700 ${getColors()} ${status === "active" ? "scale-105 z-10" : "scale-95 z-0 opacity-60"}`}>
      {status === "active" && <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: colorCode }} />}
      <Icon size={26} className={`mb-3 ${status === "active" ? "animate-bounce" : ""}`} style={{ color: status !== "waiting" ? colorCode : "" }} />
      <h4 className="text-[11px] font-bold text-center mb-1 leading-tight tracking-wide">{title}</h4>
      {modelName && (
        <span className="text-[8px] font-mono text-jb-text-muted text-center leading-tight mb-1">{modelName}</span>
      )}
      <p className="text-[9px] text-center leading-tight px-1 opacity-70 font-medium">{desc}</p>
    </div>
  );
};

const FlowConnector = ({ isActive }: { isActive: boolean }) => (
  <div className="flex-1 min-h-[3px] h-[3px] shrink-0 w-4 md:w-8 relative overflow-hidden rounded-full mx-2 flex items-center">
    <div className="absolute inset-0 bg-jb-border/50" />
    <div className={`absolute h-full left-0 ${isActive ? "w-full bg-jb-accent shadow-[0_0_10px_rgba(53,116,240,0.8)]" : "w-0 bg-jb-accent"}`} />
  </div>
);

function getNodeForAgent(agent?: string): number {
  switch (agent) {
    case "Planner": return 2;
    case "Generator": return 3;
    case "Validator": return 1;
    case "Judge": return 4;
    case "Monolith": return 1;
    case "System": return 6;
    default: return 1;
  }
}

export default function OrchestrationFlowchart({
  activeStep,
  glassboxState,
}: {
  activeStep: number;
  glassboxState?: GlassboxState;
}) {
  const currentAgent = glassboxState?.currentAgent;
  const liveNode = currentAgent ? getNodeForAgent(currentAgent) : activeStep;
  const strategyIter = glassboxState?.strategyIteration ?? 1;
  const hasRetry = strategyIter > 1;
  const { plannerModel, generatorModel, judgeModel } = glassboxState ?? {};

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-row items-center justify-center w-full max-w-4xl relative">
        {hasRetry && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              Strategy Iteration {strategyIter}/{glassboxState?.maxStrategyIterations ?? 3}
            </span>
          </div>
        )}
        <FlowNode
          icon={Cpu}
          title="Planner"
          desc="Analyzing architecture"
          modelName={plannerModel}
          status={liveNode === 2 ? "active" : activeStep > 2 ? "done" : "waiting"}
          colorCode="#56a8f5"
        />
        <FlowConnector isActive={activeStep > 2} />
        <FlowNode
          icon={Layers}
          title="Generator"
          desc="Drafting optimizations"
          modelName={generatorModel}
          status={liveNode === 3 ? "active" : activeStep > 3 ? "done" : "waiting"}
          colorCode="#2aacb8"
        />
        <FlowConnector isActive={activeStep > 3} />
        <FlowNode
          icon={FileCode2}
          title="AST Parser"
          desc="Structuring output"
          status={liveNode === 4 ? "active" : activeStep > 4 ? "done" : "waiting"}
          colorCode="#00e5ff"
        />
        <FlowConnector isActive={activeStep > 4} />
        <FlowNode
          icon={CheckCircle2}
          title="Judge"
          desc="Final validation"
          modelName={judgeModel}
          status={liveNode === 5 ? "active" : activeStep > 5 ? "done" : "waiting"}
          colorCode="#27c93f"
        />
      </div>
    </div>
  );
}
