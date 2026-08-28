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
  const { phase, status, iteration, durationMs, modelName, isSelected, isPrevious, isCurrent, isDoneSession } = data;
  const Icon = ICON_MAP[phase.icon] || Layers;

  // Status visual configurations (double rings & glowing styles matching reference UI)
  const ringStyles: Record<
    NodeStatus,
    { outerRing: string; innerRing: string; text: string; shadow: string; glow: string }
  > = {
    waiting: {
      outerRing: "border-jb-border/80 bg-jb-panel/60 ring-1 ring-white/10",
      innerRing: "border-jb-border/50 bg-jb-bg/80",
      text: "text-jb-text-muted",
      shadow: "shadow-sm",
      glow: "",
    },
    active: {
      outerRing: "border-cyan-400/90 bg-cyan-950/50 ring-4 ring-cyan-500/30",
      innerRing: "border-cyan-300 bg-jb-bg/95",
      text: "text-cyan-300 font-extrabold",
      shadow: "shadow-[0_0_28px_rgba(34,211,238,0.55)]",
      glow: "bg-cyan-400/25 animate-ping",
    },
    done_ok: {
      outerRing: "border-emerald-500/90 bg-emerald-950/40 ring-2 ring-emerald-500/30",
      innerRing: "border-emerald-400 bg-jb-bg/95",
      text: "text-emerald-400 font-bold",
      shadow: "shadow-[0_0_20px_rgba(16,185,129,0.4)]",
      glow: "",
    },
    done_fail: {
      outerRing: "border-red-500/90 bg-red-950/50 ring-2 ring-red-500/40",
      innerRing: "border-red-400 bg-jb-bg/95",
      text: "text-red-400 font-bold",
      shadow: "shadow-[0_0_20px_rgba(239,68,68,0.45)]",
      glow: "",
    },
    skipped: {
      outerRing: "border-jb-border/40 bg-jb-panel/20",
      innerRing: "border-jb-border/30 bg-jb-bg/40",
      text: "text-jb-text-muted/50",
      shadow: "shadow-none",
      glow: "",
    },
    flagged: {
      outerRing: "border-amber-400/95 bg-amber-950/50 ring-4 ring-amber-500/40",
      innerRing: "border-amber-300 bg-jb-bg/95",
      text: "text-amber-300 font-extrabold",
      shadow: "shadow-[0_0_24px_rgba(245,158,11,0.55)]",
      glow: "",
    },
  };

  const style = ringStyles[status];

  // In live processing mode, active and previous nodes light up, and inactive waiting nodes are clearly visible!
  const nodeOpacityClass = isDoneSession
    ? "opacity-100"
    : isCurrent
    ? "opacity-100 z-20 scale-105"
    : isPrevious
    ? "opacity-95 z-10 scale-100"
    : status === "done_ok" || status === "flagged"
    ? "opacity-90 z-0 scale-100"
    : "opacity-80 hover:opacity-100 scale-95 transition-all duration-300";

  return (
    <div className={`relative flex flex-col items-center justify-center group cursor-pointer select-none transition-all duration-500 ${nodeOpacityClass}`}>
      {/* Duration Pill (Top Right) */}
      {durationMs !== null && (
        <div className="absolute -top-3 -right-3 z-20 px-2 py-0.5 rounded-md text-[10px] font-mono bg-jb-panel/95 text-jb-text border border-jb-border/60 shadow-md backdrop-blur-md">
          {(durationMs / 1000).toFixed(1)}s
        </div>
      )}

      {/* Outer Glowing Ring with dual source and target handles on all 4 sides */}
      <div
        className={`relative flex items-center justify-center w-24 h-24 rounded-full border-2 transition-all duration-500 ${style.outerRing} ${style.shadow} ${
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
        <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-full border ${style.innerRing} transition-colors duration-300 z-10`}>
          <span className="text-[13px] font-extrabold tracking-tight opacity-80">
            {phase.num}
          </span>
          <Icon size={24} style={{ color: status !== "waiting" && status !== "skipped" ? phase.color : undefined }} />
        </div>
      </div>

      {/* Node Sub-labels */}
      <div className="mt-2.5 flex flex-col items-center text-center max-w-[135px]">
        <span className={`text-[14px] font-bold tracking-tight leading-tight transition-colors duration-300 ${style.text}`}>
          {phase.name}
        </span>
        <span className="text-[12px] font-mono text-cyan-300/90 font-semibold mt-0.5">
          {phase.agent}
        </span>
        {modelName && (
          <span className="text-[10px] font-mono text-jb-text-muted font-medium truncate max-w-[125px] mt-0.5">
            {modelName}
          </span>
        )}
      </div>
    </div>
  );
}

export default memo(CircularNodeComponent);
