"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap } from "lucide-react";
import type { NodeStatus } from "@/types/flowGraph";
import type { GlassboxState } from "@/types/glassbox";
import { PHASES } from "@/lib/flowGraph/phases";

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Cpu, Layers, FileCode2, CheckCircle2, Clock, Zap,
};

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
}

// ── Extra edge definitions ──

interface ExtraEdge {
  id: string;
  source: number;
  target: number;
  type: "syntax_heal" | "structural_fix" | "strategy" | "abort";
}

const EXTRA_EDGES: ExtraEdge[] = [
  { id: "e3-3-heal",     source: 3, target: 3, type: "syntax_heal" },
  { id: "e3-3-fallback", source: 3, target: 3, type: "syntax_heal" },
  { id: "e4-3-fix",      source: 4, target: 3, type: "structural_fix" },
  { id: "e3-2-revise",   source: 3, target: 2, type: "strategy" },
  { id: "e4-2-revise",   source: 4, target: 2, type: "strategy" },
  { id: "e5-2-revise",   source: 5, target: 2, type: "strategy" },
  { id: "e3-6-abort",    source: 3, target: 6, type: "abort" },
  { id: "e5-6-abort",    source: 5, target: 6, type: "abort" },
];

export default function FlowGrid({ appState, exitStatus, glassboxState }: Props) {
  const {
    currentPhase, strategyIteration, syntaxHealAttempt, phaseDurations,
    validationFaultCount, plannerModel, generatorModel, judgeModel,
  } = glassboxState;

  const isDone = appState === "done";
  const isSuccess = exitStatus === "SUCCESS";
  const isAbort = isDone && !isSuccess && !!exitStatus && exitStatus !== "PROCESSING";

  const containerRef = useRef<HTMLDivElement>(null);
  const [nodeCenters, setNodeCenters] = useState<Record<number, { x: number; y: number }>>({});

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const centers: Record<number, { x: number; y: number }> = {};
    for (let i = 1; i <= 6; i++) {
      const node = el.querySelector(`[data-node-id="p${i}"]`);
      if (node) {
        const r = node.getBoundingClientRect();
        centers[i] = { x: r.left + r.width / 2 - rect.left, y: r.top + r.height / 2 - rect.top };
      }
    }
    setNodeCenters(centers);
  }, []);

  useEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    const el = containerRef.current;
    if (el) ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // remeasure when state changes that could shift layout (badge appearing, etc.)
  useEffect(() => { requestAnimationFrame(measure); }, [strategyIteration, syntaxHealAttempt]);

  function nodeStatus(num: number): NodeStatus {
    if (isDone) {
      if (num === 6) return isAbort ? "done_fail" : "done_ok";
      if (num < currentPhase || (num === currentPhase && isSuccess)) return "done_ok";
      if (num === currentPhase) return "done_fail";
      return "skipped";
    }
    if (num < currentPhase) return "done_ok";
    if (num === currentPhase) return "active";
    return "waiting";
  }

  function edgeStatus(edge: ExtraEdge): "dimmed" | "active" | "done" {
    if (edge.type === "abort") return isAbort ? "active" : "dimmed";
    if (isDone) return sourceDone(edge.source) ? "done" : "dimmed";
    switch (edge.type) {
      case "syntax_heal":
        return (syntaxHealAttempt > 0 && currentPhase === 3) ? "active" : "dimmed";
      case "structural_fix":
        return (validationFaultCount !== null && validationFaultCount > 0 && currentPhase === 3) ? "active" : "dimmed";
      case "strategy":
        return (strategyIteration > 1 && currentPhase === 2) ? "active" : "dimmed";
    }
  }

  function sourceDone(num: number): boolean {
    return num < currentPhase;
  }

  return (
    <div ref={containerRef} className="relative flex flex-col items-center justify-center gap-5 h-full w-full p-6 overflow-hidden">
      <style>{`.flow-edge-pulse { animation: flow-pulse 1s ease-in-out infinite; } @keyframes flow-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
      {/* SVG overlay for extra edges */}
      <svg
        className="absolute inset-0 pointer-events-none z-0"
        width="100%"
        height="100%"
        viewBox={`0 0 ${containerRef.current?.offsetWidth || 100} ${containerRef.current?.offsetHeight || 100}`}
        preserveAspectRatio="none"
      >
        {EXTRA_EDGES.map((edge) => {
          const from = nodeCenters[edge.source];
          const to = nodeCenters[edge.target];
          if (!from || !to) return null;
          const st = edgeStatus(edge);
          return (
            <ExtraEdgePath
              key={edge.id}
              edge={edge}
              from={from}
              to={to}
              status={st}
            />
          );
        })}
      </svg>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-5 w-full">
        {strategyIteration > 1 && (
          <div className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
            Strategy Iteration {strategyIteration}/{glassboxState.maxStrategyIterations ?? 3}
          </div>
        )}

        {/* Row 1: P1 P2 P3 */}
        <div className="flex items-center gap-4">
          <NodeCard num={1} phase={PHASES[0]} status={nodeStatus(1)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 1)?.durationMs ?? null} />
          <Connector active={currentPhase > 1} />
          <NodeCard num={2} phase={PHASES[1]} status={nodeStatus(2)} modelName={plannerModel} iteration={strategyIteration} durationMs={phaseDurations.find(d => d.phase === 2)?.durationMs ?? null} />
          <Connector active={currentPhase > 2} />
          <NodeCard num={3} phase={PHASES[2]} status={nodeStatus(3)} modelName={generatorModel} iteration={Math.max(syntaxHealAttempt, 1)} durationMs={phaseDurations.find(d => d.phase === 3)?.durationMs ?? null} />
        </div>

        {/* Zigzag connector P3 → P4 */}
        <div className="flex justify-center">
          <div className="relative w-[3px] h-8 overflow-hidden rounded-full">
            <div className="absolute inset-0 bg-jb-border/30" />
            <div className={`absolute bottom-0 left-0 w-full transition-all duration-500 ${currentPhase > 3 ? "h-full bg-jb-accent" : "h-0 bg-jb-accent"}`} />
          </div>
        </div>

        {/* Row 2: P4 P5 P6 */}
        <div className="flex items-center gap-4">
          <NodeCard num={4} phase={PHASES[3]} status={nodeStatus(4)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 4)?.durationMs ?? null} />
          <Connector active={currentPhase > 4} />
          <NodeCard num={5} phase={PHASES[4]} status={nodeStatus(5)} modelName={judgeModel} iteration={1} durationMs={phaseDurations.find(d => d.phase === 5)?.durationMs ?? null} />
          <Connector active={currentPhase > 5} />
          <NodeCard num={6} phase={PHASES[5]} status={nodeStatus(6)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 6)?.durationMs ?? null} />
        </div>

        {isDone && (
          <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-jb-panel/90 border border-jb-border/50 text-[11px] font-medium">
            {exitStatus && <span className={exitStatus === "SUCCESS" ? "text-green-500" : "text-red-500"}>{exitStatus}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Extra Edge Path ──

function ExtraEdgePath({
  edge, from, to, status,
}: {
  edge: ExtraEdge;
  from: { x: number; y: number };
  to: { x: number; y: number };
  status: "dimmed" | "active" | "done";
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  let d = "";

  if (edge.source === edge.target) {
    // Self-loop: arc above or to side
    const arcY = from.y - 60;
    const midX = from.x;
    d = `M ${from.x} ${from.y} C ${from.x + 60} ${arcY}, ${to.x - 60} ${arcY}, ${to.x} ${to.y}`;
  } else if (edge.type === "strategy") {
    // Arc to P2 (left side)
    const midX = Math.min(from.x, to.x) - 50;
    d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  } else if (edge.type === "abort") {
    // Arc to P6 (right side)
    const midX = Math.max(from.x, to.x) + 50;
    d = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;
  } else {
    // Vertical curve (P4→P3, structural fix)
    const midY = (from.y + to.y) / 2;
    d = `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }

  const style: Record<string, string> = {
    stroke: status === "dimmed" ? "#555" :
            edge.type === "strategy" ? "#56a8f5" :
            edge.type === "abort" ? "#f93e3e" : "#e09c3b",
    strokeWidth: status === "dimmed" ? "1.5" : "2",
    opacity: status === "dimmed" ? "0.15" : status === "active" ? "1" : "0.5",
  };

  if (status !== "dimmed" && edge.type !== "abort") {
    style.strokeDasharray = "6 3";
  }

  return (
    <path
      d={d}
      fill="none"
      stroke={style.stroke}
      strokeWidth={style.strokeWidth}
      strokeDasharray={style.strokeDasharray}
      opacity={style.opacity}
      className={status === "active" ? "flow-edge-pulse" : undefined}
    />
  );
}

// ── Connector ──

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex-1 min-h-[3px] h-[3px] shrink-0 w-8 relative overflow-hidden rounded-full">
      <div className="absolute inset-0 bg-jb-border/30" />
      <div className={`absolute h-full left-0 transition-all duration-500 ${active ? "w-full bg-jb-accent" : "w-0 bg-jb-accent"}`} />
    </div>
  );
}

// ── NodeCard ──

function NodeCard({
  num, phase, status, modelName, iteration, durationMs,
}: {
  num: number;
  phase: { num: number; name: string; agent: string; icon: string; color: string };
  status: NodeStatus;
  modelName?: string;
  iteration: number;
  durationMs: number | null;
}) {
  const Icon = ICONS[phase.icon];

  const styles: Record<NodeStatus, { bg: string; ring: string; text: string }> = {
    waiting:  { bg: "bg-jb-panel/30", ring: "ring-jb-border/30", text: "text-jb-text-muted/50" },
    active:   { bg: "bg-jb-bg",       ring: "ring-jb-accent/50", text: "text-jb-accent" },
    done_ok:  { bg: "bg-green-500/5", ring: "ring-green-500/40", text: "text-green-500" },
    done_fail:{ bg: "bg-red-500/5",   ring: "ring-red-500/40",   text: "text-red-500" },
    skipped:  { bg: "bg-jb-panel/20", ring: "ring-jb-border/20", text: "text-jb-text-muted/30" },
  };

  const s = styles[status];

  return (
    <div data-node-id={`p${num}`} className={`relative flex flex-col items-center justify-center p-3 w-44 h-44 rounded-[20px] ring-1 transition-all duration-500 ${s.bg} ${s.ring} ${s.text}`}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-bold opacity-60">P{phase.num}</span>
      </div>

      {status === "active" && (
        <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: phase.color }} />
      )}

      {Icon && (
        <span className="mb-2" style={{ color: status !== "waiting" && status !== "skipped" ? phase.color : undefined }}>
          <Icon size={28} />
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
