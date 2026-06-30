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
}

export default function FlowGrid({ appState, exitStatus, glassboxState }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setMounted(true)); }, []);
  const isDark = mounted ? resolvedTheme === "dark" : true;

  const {
    currentPhase, strategyIteration, syntaxHealAttempt, phaseDurations,
    plannerModel, generatorModel, judgeModel,
  } = glassboxState;

  const isDone = appState === "done";
  const isSuccess = exitStatus === "SUCCESS";
  const isAbort = isDone && !isSuccess && !!exitStatus && exitStatus !== "PROCESSING";

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
        <Connector active={currentPhase > 1} isDark={isDark} />
        <NodeCard phase={PHASES[1]} status={nodeStatus(2)} modelName={plannerModel} iteration={strategyIteration} durationMs={phaseDurations.find(d => d.phase === 2)?.durationMs ?? null} isDark={isDark} />
        <Connector active={currentPhase > 2} isDark={isDark} />
        <NodeCard phase={PHASES[2]} status={nodeStatus(3)} modelName={generatorModel} iteration={Math.max(syntaxHealAttempt, 1)} durationMs={phaseDurations.find(d => d.phase === 3)?.durationMs ?? null} showBottomArrow={currentPhase > 2} isDark={isDark} />
      </div>

      {/* Row 2: P6 P5 P4 */}
      <div className="flex items-center gap-4">
        <NodeCard phase={PHASES[5]} status={nodeStatus(6)} modelName={undefined} iteration={1} durationMs={phaseDurations.find(d => d.phase === 6)?.durationMs ?? null} isDark={isDark} />
        <Connector active={currentPhase > 5} isDark={isDark} reverse />
        <NodeCard phase={PHASES[4]} status={nodeStatus(5)} modelName={judgeModel} iteration={1} durationMs={phaseDurations.find(d => d.phase === 5)?.durationMs ?? null} isDark={isDark} />
        <Connector active={currentPhase > 4} isDark={isDark} reverse />
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
    <div className="flex-1 shrink-0 min-w-[24px] h-6 flex items-center overflow-visible">
      <div className="flex-1 h-[3px] transition-colors duration-500" style={{ backgroundColor: c }} />
      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 -ml-[1px]">
        {reverse
          ? <path d="M13 1 L3 8 L13 15 Z" fill={c} className="transition-colors duration-500" />
          : <path d="M3 1 L13 8 L3 15 Z" fill={c} className="transition-colors duration-500" />
        }
      </svg>
    </div>
  );
}

// ── NodeCard ──

function NodeCard({
  phase, status, modelName, iteration, durationMs, showBottomArrow, isDark,
}: {
  phase: { num: number; name: string; agent: string; icon: string; color: string };
  status: NodeStatus;
  modelName?: string;
  iteration: number;
  durationMs: number | null;
  showBottomArrow?: boolean;
  isDark: boolean;
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
    <div className={`relative flex flex-col items-center justify-center p-3 w-44 h-44 rounded-[20px] ring-1 transition-all duration-500 ${s.bg} ${s.ring} ${s.text}`}>
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
        <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${isDark ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}>
          {iteration}
        </span>
      )}

      {durationMs !== null && (
        <span className="absolute -bottom-1 -right-1 text-[8px] font-mono px-1.5 py-0.5 rounded bg-jb-border/30 text-jb-text-muted">
          {(durationMs / 1000).toFixed(1)}s
        </span>
      )}

      {showBottomArrow && (
        <svg width="16" height="24" viewBox="0 0 16 24" className="absolute -bottom-5 left-1/2 -translate-x-1/2">
          <line x1="8" y1="0" x2="8" y2="16" strokeWidth="3" strokeLinecap="round"
            stroke={status === "active" ? "#3574f0" : "#4ec97e"}
            className="transition-colors duration-500" />
          <path d="M3 14 L8 23 L13 14 Z" fill={status === "active" ? "#3574f0" : "#4ec97e"}
            className="transition-colors duration-500" />
        </svg>
      )}


    </div>
  );
}
