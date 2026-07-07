"use client";

import React from "react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap } from "lucide-react";

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap,
};

export interface PhaseCardData {
  num: number;
  name: string;
  agent: string;
  icon: string;
  color: string;
}

export type NodeStatus = "waiting" | "active" | "done_ok" | "done_fail" | "skipped" | "flagged";

interface Props {
  phase: PhaseCardData;
  status: NodeStatus;
  iteration: number;
  durationMs: number | null;
  modelName?: string;
  left: number;
  top: number;
}

const STATUS_STYLES: Record<NodeStatus, { bg: string; ring: string; text: string }> = {
  waiting:  { bg: "bg-jb-panel/35", ring: "ring-jb-border/30", text: "text-jb-text-muted/50" },
  active:   { bg: "bg-jb-bg",       ring: "ring-jb-accent/50", text: "text-jb-accent" },
  done_ok:  { bg: "bg-green-500/5", ring: "ring-green-500/40", text: "text-green-500" },
  done_fail:{ bg: "bg-red-500/5",   ring: "ring-red-500/40",   text: "text-red-500" },
  skipped:  { bg: "bg-jb-panel/20", ring: "ring-jb-border/20", text: "text-jb-text-muted/30" },
  flagged:  { bg: "bg-red-500/5",   ring: "ring-red-500/20",   text: "text-red-400/60" },
};

export default function PhaseCard({ phase, status, iteration, durationMs, modelName, left, top }: Props) {
  const Icon = ICON_MAP[phase.icon] ?? Layers;
  const s = STATUS_STYLES[status];

  return (
    <div
      className={`absolute flex flex-col items-center justify-center p-3 w-[160px] h-[160px] rounded-[18px] ring-1 transition-all duration-500 ${s.bg} ${s.ring} ${s.text}`}
      style={{ left, top }}
    >
      <div
        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-12 rounded-r-full transition-opacity duration-500"
        style={{
          backgroundColor: phase.color,
          opacity: status !== "waiting" && status !== "skipped" ? 0.8 : 0.15,
        }}
      />

      <div className="flex items-center gap-1 mb-1">
        <span className="text-[11px] font-bold opacity-60">P{phase.num}</span>
      </div>

      {status === "active" && (
        <div className="absolute inset-0 rounded-[18px] animate-ping opacity-10" style={{ backgroundColor: phase.color }} />
      )}

      <span className="mb-1.5" style={{ color: status !== "waiting" && status !== "skipped" ? phase.color : undefined }}>
        <Icon size={32} />
      </span>

      <h4 className="text-[14px] font-bold text-center leading-tight">{phase.name}</h4>
      <span className="text-[11px] font-mono opacity-60 leading-tight">{phase.agent}</span>

      {modelName && (
        <span className="text-[9px] font-mono opacity-40 text-center leading-tight mt-0.5 truncate max-w-[130px]">{modelName}</span>
      )}

      {iteration > 1 && status !== "waiting" && status !== "skipped" && (
        <span className="absolute -top-1.5 -right-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 leading-none">
          {iteration}
        </span>
      )}

      {durationMs !== null && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded bg-jb-border/30 text-jb-text-muted leading-none">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
