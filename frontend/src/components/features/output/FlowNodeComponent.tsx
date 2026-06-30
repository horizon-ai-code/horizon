"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap } from "lucide-react";
import type { FlowNodeData, NodeStatus } from "@/types/flowGraph";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap,
};

function FlowNodeComponent({ data }: NodeProps) {
  const typed = data as unknown as FlowNodeData;
  const { phase, status, iteration, durationMs, modelName } = typed;
  const Icon = ICON_MAP[phase.icon];

  const statusColors: Record<NodeStatus, { bg: string; ring: string; text: string }> = {
    waiting:  { bg: "bg-jb-panel/30", ring: "ring-jb-border/30", text: "text-jb-text-muted/50" },
    active:   { bg: "bg-jb-bg",       ring: "ring-jb-accent/50", text: "text-jb-accent" },
    done_ok:  { bg: "bg-green-500/5", ring: "ring-green-500/40", text: "text-green-500" },
    done_fail:{ bg: "bg-red-500/5",   ring: "ring-red-500/40",   text: "text-red-500" },
    skipped:  { bg: "bg-jb-panel/20", ring: "ring-jb-border/20", text: "text-jb-text-muted/30" },
  };

  const c = statusColors[status];
  const iconColor = status !== "waiting" && status !== "skipped" ? phase.color : undefined;

  return (
    <div className={`relative flex flex-col items-center justify-center p-3 w-40 h-40 rounded-[20px] ring-1 transition-all duration-500 ${c.bg} ${c.ring} ${c.text}`}>
      <Handle type="target" position={Position.Top} className="!bg-jb-border !w-2 !h-2" />

      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold opacity-60">P{phase.num}</span>
      </div>

      {status === "active" && (
        <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: phase.color }} />
      )}

      {Icon && (
        <span className="mb-2" style={{ color: iconColor }}>
          <Icon size={26} />
        </span>
      )}

      <h4 className="text-[12px] font-bold text-center leading-tight">{phase.name}</h4>
      <span className="text-[9px] font-mono opacity-60">{phase.agent}</span>

      {modelName && (
        <span className="text-[8px] font-mono opacity-40 text-center leading-tight mt-0.5">{modelName}</span>
      )}

      {iteration > 1 && status !== "waiting" && status !== "skipped" && (
        <span className="absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
          {iteration}
        </span>
      )}

      {durationMs !== null && (
        <span className="absolute -bottom-1 -right-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-jb-border/30 text-jb-text-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-jb-border !w-2 !h-2" />
    </div>
  );
}

export default memo(FlowNodeComponent);
