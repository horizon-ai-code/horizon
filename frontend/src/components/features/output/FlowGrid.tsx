"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
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
  /** Phase states from backend (live via WS, history via API) */
  phaseStates?: Record<string, string>;
}

export default function FlowGrid({ appState, exitStatus, glassboxState, phaseStates: propStates }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  const isDark = mounted ? resolvedTheme === "dark" : true;

  const {
    currentPhase, strategyIteration, syntaxHealAttempt, phaseDurations,
    plannerModel, generatorModel, judgeModel,
  } = glassboxState;

  const isDone = appState === "done";

  // Merge states from prop (history) or glassbox (live)
  const states = propStates ?? glassboxState.phaseStates;

  function nodeStatus(num: number): NodeStatus {
    if (states) {
      if (!isDone && num === currentPhase) return "active";
      return (states[String(num)] as NodeStatus) ?? "skipped";
    }
    if (num < currentPhase) return "done_ok";
    if (num === currentPhase) return "active";
    return "waiting";
  }

  // Highest completed phase for connector lighting
  const highestDone = states
    ? Object.entries(states)
        .filter(([, s]) => s === "done_ok" || s === "done_fail" || s === "flagged")
        .map(([k]) => Number(k))
        .reduce((a, b) => Math.max(a, b), 0)
    : currentPhase;

  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full w-full p-6">
      {strategyIteration > 1 && (
        <div className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${isDark ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}>
          Strategy Iteration {strategyIteration}/{glassboxState.maxStrategyIterations ?? 3}
        </div>
      )}

      {/* Row 1: P1 P2 P3 */}
      <div className="flex items-center gap-4">
        <NodeCard phase={PHASES[0]} status={nodeStatus(1)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 1)?.durationMs ?? null} isDark={isDark} />
        <Connector active={highestDone > 1} isDark={isDark} />
        <NodeCard phase={PHASES[1]} status={nodeStatus(2)} modelName={plannerModel} iteration={strategyIteration} durationMs={phaseDurations.find(d => d.phase === 2)?.durationMs ?? null} isDark={isDark} />
        <Connector active={highestDone > 2} isDark={isDark} />
        <NodeCard phase={PHASES[2]} status={nodeStatus(3)} modelName={generatorModel} iteration={Math.max(syntaxHealAttempt, 1)} durationMs={phaseDurations.find(d => d.phase === 3)?.durationMs ?? null} isDark={isDark} />
      </div>

      {/* P3 → P4 zigzag arrow (P3 column position) */}
      <div className="flex items-center gap-4">
        <div className="w-[176px]" />
        <div style={{ width: "24px" }} />
        <div className="w-[176px]" />
        <div style={{ width: "24px" }} />
        <div className="w-[176px] flex justify-center">
          <span className="text-lg leading-none" style={{ color: highestDone > 2 ? "#4ec97e" : (isDark ? "#393b40" : "#d1d1d1") }}>▼</span>
        </div>
      </div>

      {/* Row 2: P6 P5 P4 */}
      <div className="flex items-center gap-4">
        <NodeCard phase={PHASES[5]} status={nodeStatus(6)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 6)?.durationMs ?? null} isDark={isDark} />
        <Connector active={highestDone > 5} isDark={isDark} reverse />
        <NodeCard phase={PHASES[4]} status={nodeStatus(5)} modelName={judgeModel} iteration={1} durationMs={phaseDurations.find(d => d.phase === 5)?.durationMs ?? null} isDark={isDark} />
        <Connector active={highestDone > 4} isDark={isDark} reverse />
        <NodeCard phase={PHASES[3]} status={nodeStatus(4)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 4)?.durationMs ?? null} isDark={isDark} />
      </div>

      {isDone && (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-jb-panel/90 border border-jb-border/50 text-[11px] font-medium">
          {exitStatus && <span className={exitStatus === "SUCCESS" ? "text-green-500" : "text-red-500"}>{exitStatus}</span>}
        </div>
      )}
    </div>
  );
}

// ── Connector with arrow ──

function Connector({ active, isDark, reverse }: { active: boolean; isDark: boolean; reverse?: boolean }) {
  const c = active ? "#4ec97e" : (isDark ? "#393b40" : "#d1d1d1");
  return (
    <span className="text-lg leading-none shrink-0" style={{ color: c }}>
      {reverse ? "◀" : "▶"}
    </span>
  );
}

// ── NodeCard ──

function NodeCard({
  phase, status, modelName, iteration, durationMs, isDark,
}: {
  phase: { num: number; name: string; agent: string; icon: string; color: string };
  status: NodeStatus;
  modelName?: string;
  iteration: number;
  durationMs: number | null;
  isDark: boolean;
}) {
  const Icon = ICONS[phase.icon];

  const styles: Record<NodeStatus, { bg: string; ring: string; text: string }> = {
    waiting:  { bg: "bg-jb-panel/30", ring: "ring-jb-border/30", text: "text-jb-text-muted/50" },
    active:   { bg: "bg-jb-bg",       ring: "ring-jb-accent/50", text: "text-jb-accent" },
    done_ok:  { bg: "bg-green-500/5", ring: "ring-green-500/40", text: "text-green-500" },
    done_fail:{ bg: "bg-red-500/5",   ring: "ring-red-500/40",   text: "text-red-500" },
    skipped:  { bg: "bg-jb-panel/20", ring: "ring-jb-border/20", text: "text-jb-text-muted/30" },
    flagged:  { bg: "bg-red-500/5",   ring: "ring-red-500/20",   text: "text-red-400/60" },
  };

  const s = styles[status];

  return (
    <div className={`relative flex flex-col items-center justify-center p-3 w-44 h-44 rounded-[20px] ring-1 transition-all duration-500 ${s.bg} ${s.ring} ${s.text}`}>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[12px] font-bold opacity-60">P{phase.num}</span>
      </div>

      {status === "active" && (
        <div className="absolute inset-0 rounded-[20px] animate-ping opacity-10" style={{ backgroundColor: phase.color }} />
      )}

      {Icon && (
        <span className="mb-2" style={{ color: status !== "waiting" && status !== "skipped" ? phase.color : undefined }}>
          <Icon size={34} />
        </span>
      )}

      <h4 className="text-[16px] font-bold text-center leading-tight">{phase.name}</h4>
      <span className="text-[11px] font-mono opacity-60">{phase.agent}</span>

      {modelName && (
        <span className="text-[10px] font-mono opacity-40 text-center leading-tight mt-0.5">{modelName}</span>
      )}

      {iteration > 1 && status !== "waiting" && status !== "skipped" && (
        <span className={`absolute -top-1.5 -right-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${isDark ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}>
          {iteration}
        </span>
      )}

      {durationMs !== null && (
        <span className="absolute -bottom-1 -right-1 text-[10px] font-mono px-2 py-0.5 rounded bg-jb-border/30 text-jb-text-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      )}
    </div>
  );
}
