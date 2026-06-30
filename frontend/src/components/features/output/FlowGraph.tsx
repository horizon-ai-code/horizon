"use client";

import React, { useMemo } from "react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap } from "lucide-react";
import type { GraphNode, GraphEdge, NodeStatus } from "@/types/flowGraph";
import type { GlassboxState } from "@/types/glassbox";
import { buildGraphState } from "@/lib/flowGraph/buildGraphState";
import { edgePath, edgeStyle } from "@/lib/flowGraph/edgePaths";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap,
};

const NODE_SIZE = 260;

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
}

export default function FlowGraph({ appState, exitStatus, glassboxState }: Props) {
  const isDone = appState === "done";

  const { nodes, edges } = useMemo(
    () => buildGraphState(glassboxState, appState, exitStatus),
    [glassboxState, appState, exitStatus],
  );

  const maxX = 840 + NODE_SIZE;
  const maxY = 480 + NODE_SIZE;
  const extra = 160;
  const svgW = maxX + extra;
  const svgH = maxY + extra;

  return (
    <div className="relative w-full h-full overflow-auto">
      <style>{`.flow-edge-active { animation: flow-pulse 1s ease-in-out infinite; } @keyframes flow-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="absolute top-0 left-0 pointer-events-none"
      >
        {edges.map((edge) => (
          <EdgePath key={edge.id} edge={edge} />
        ))}
      </svg>

      {nodes.map((node) => (
        <NodeBox key={node.id} node={node} />
      ))}

      {isDone && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 rounded-lg bg-jb-panel/90 border border-jb-border/50 text-[11px] font-medium z-10">
          <span>
            Total:{" "}
            {glassboxState.totalDurationMs != null
              ? `${(glassboxState.totalDurationMs / 1000).toFixed(1)}s`
              : "—"}
          </span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span>Strategy: {glassboxState.strategyIteration}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span>Syntax Heals: {glassboxState.syntaxHealAttempt}</span>
          <span className="w-px h-4 bg-jb-border/50" />
          <span className={exitStatus === "SUCCESS" ? "text-green-500" : "text-red-500"}>
            {exitStatus || "—"}
          </span>
        </div>
      )}
    </div>
  );
}

// ── SVG Edge ──

function EdgePath({ edge }: { edge: GraphEdge }) {
  const d = edgePath(edge.id);
  const style = edgeStyle(edge.type, edge.status);
  return (
    <path
      d={d}
      fill="none"
      stroke={style.stroke as string}
      strokeWidth={style.strokeWidth as number}
      strokeDasharray={style.strokeDasharray as string | undefined}
      opacity={style.opacity as number}
      className={edge.status === "active" ? "flow-edge-active" : undefined}
    />
  );
}

// ── Node Box ──

function NodeBox({ node }: { node: GraphNode }) {
  const { phase, status, iteration, durationMs, modelName, x, y } = node;
  const Icon = ICONS[phase.icon];

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
    <div
      className={`absolute flex flex-col items-center justify-center p-3 rounded-[24px] ring-1 transition-all duration-500 ${c.bg} ${c.ring} ${c.text}`}
      style={{ left: x, top: y, width: NODE_SIZE, height: NODE_SIZE }}
    >
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold opacity-60">P{phase.num}</span>
      </div>

      {status === "active" && (
        <div className="absolute inset-0 rounded-[24px] animate-ping opacity-10" style={{ backgroundColor: phase.color }} />
      )}

      {Icon && (
        <span className="mb-2" style={{ color: iconColor }}>
          <Icon size={34} />
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
    </div>
  );
}
