"use client";

import React, { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap } from "lucide-react";
import type { FlowNodeData, NodeStatus } from "@/types/flowGraph";

const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>
> = {
  Cpu,
  Layers,
  FileCode2,
  CheckCircle2,
  Clock,
  Zap,
};

function CircularNodeComponent({ data }: NodeProps<Node<FlowNodeData>>) {
  const { phase, status, iteration, durationMs, modelName, isSelected } = data;
  const Icon = ICON_MAP[phase.icon] || Layers;

  // Status visual configurations (double rings & glowing styles matching reference UI)
  const ringStyles: Record<
    NodeStatus,
    { outerRing: string; innerRing: string; text: string; shadow: string; glow: string }
  > = {
    waiting: {
      outerRing: "border-jb-border/40 bg-jb-panel/30",
      innerRing: "border-jb-border/30 bg-jb-bg/40",
      text: "text-jb-text-muted/60",
      shadow: "shadow-none",
      glow: "",
    },
    active: {
      outerRing: "border-cyan-400/80 bg-cyan-950/40 ring-4 ring-cyan-500/20",
      innerRing: "border-cyan-300 bg-jb-bg/90",
      text: "text-cyan-400 font-bold",
      shadow: "shadow-[0_0_24px_rgba(34,211,238,0.45)]",
      glow: "bg-cyan-400/20 animate-ping",
    },
    done_ok: {
      outerRing: "border-emerald-500/80 bg-emerald-950/30 ring-2 ring-emerald-500/20",
      innerRing: "border-emerald-400 bg-jb-bg/90",
      text: "text-emerald-400",
      shadow: "shadow-[0_0_18px_rgba(16,185,129,0.3)]",
      glow: "",
    },
    done_fail: {
      outerRing: "border-red-500/80 bg-red-950/40 ring-2 ring-red-500/30",
      innerRing: "border-red-400 bg-jb-bg/90",
      text: "text-red-400",
      shadow: "shadow-[0_0_18px_rgba(239,68,68,0.35)]",
      glow: "",
    },
    skipped: {
      outerRing: "border-jb-border/20 bg-jb-panel/10",
      innerRing: "border-jb-border/10 bg-jb-bg/20",
      text: "text-jb-text-muted/30",
      shadow: "shadow-none",
      glow: "",
    },
    flagged: {
      outerRing: "border-amber-500/80 bg-amber-950/30 ring-2 ring-amber-500/30",
      innerRing: "border-amber-400 bg-jb-bg/90",
      text: "text-amber-400",
      shadow: "shadow-[0_0_15px_rgba(245,158,11,0.35)]",
      glow: "",
    },
  };

  const style = ringStyles[status];

  return (
    <div className="relative flex flex-col items-center justify-center group cursor-pointer select-none">
      {/* Iteration Badge (Top Left) */}
      {iteration > 1 && status !== "waiting" && (
        <div className="absolute -top-2.5 -left-2.5 z-20 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm backdrop-blur-md">
          {iteration}x
        </div>
      )}

      {/* Duration Pill (Top Right) */}
      {durationMs !== null && (
        <div className="absolute -top-2.5 -right-2.5 z-20 px-2 py-0.5 rounded-md text-[10px] font-mono bg-jb-panel/90 text-jb-text-muted border border-jb-border/50 shadow-sm backdrop-blur-md">
          {(durationMs / 1000).toFixed(1)}s
        </div>
      )}

      {/* Outer Glowing Ring with dual source and target handles on all 4 sides */}
      <div
        className={`relative flex items-center justify-center w-20 h-20 rounded-full border-2 transition-all duration-500 ${style.outerRing} ${style.shadow} ${
          isSelected ? "ring-4 ring-cyan-400 scale-105" : "hover:scale-105"
        }`}
      >
        {/* Left Handles */}
        <Handle type="target" position={Position.Left} id="left-target" className="!bg-transparent !border-none !w-1 !h-1" />
        <Handle type="source" position={Position.Left} id="left-source" className="!bg-transparent !border-none !w-1 !h-1" />

        {/* Right Handles */}
        <Handle type="target" position={Position.Right} id="right-target" className="!bg-transparent !border-none !w-1 !h-1" />
        <Handle type="source" position={Position.Right} id="right-source" className="!bg-transparent !border-none !w-1 !h-1" />

        {/* Top Handles */}
        <Handle type="target" position={Position.Top} id="top-target" className="!bg-transparent !border-none !w-1 !h-1" />
        <Handle type="source" position={Position.Top} id="top-source" className="!bg-transparent !border-none !w-1 !h-1" />

        {/* Bottom Handles */}
        <Handle type="target" position={Position.Bottom} id="bottom-target" className="!bg-transparent !border-none !w-1 !h-1" />
        <Handle type="source" position={Position.Bottom} id="bottom-source" className="!bg-transparent !border-none !w-1 !h-1" />

        {/* Pulsing Active Glow */}
        {status === "active" && (
          <div className={`absolute inset-0 rounded-full ${style.glow}`} />
        )}

        {/* Inner Circle Node */}
        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-full border ${style.innerRing} transition-colors duration-300 z-10`}>
          <span className="text-[12px] font-extrabold tracking-tight opacity-70">
            {phase.num}
          </span>
          <Icon size={20} style={{ color: status !== "waiting" && status !== "skipped" ? phase.color : undefined }} />
        </div>
      </div>

      {/* Node Sub-labels */}
      <div className="mt-2.5 flex flex-col items-center text-center max-w-[125px]">
        <span className={`text-[13px] font-bold tracking-tight leading-tight transition-colors duration-300 ${style.text}`}>
          {phase.name}
        </span>
        <span className="text-[11px] font-mono text-jb-text-muted/70 mt-0.5">
          {phase.agent}
        </span>
        {modelName && (
          <span className="text-[9px] font-mono text-jb-text-muted/40 truncate max-w-[105px] mt-0.5">
            {modelName}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(CircularNodeComponent);
