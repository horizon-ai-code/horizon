"use client"

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import type { GlassboxState } from "@/types/glassbox";
import { PIPELINE_PHASES, getPhaseStatus } from "@/lib/pipelinePhases";
import PhaseDetailCard from "./PhaseDetailCard";

export default function OrchestrationFlowchart({
  glassboxState,
}: {
  glassboxState?: GlassboxState;
}) {
  const gs = glassboxState;
  const currentPhase = gs?.currentPhase ?? 0;
  const strategyIter = gs?.strategyIteration ?? 1;
  const hasRetry = strategyIter > 1;
  const activePhase = PIPELINE_PHASES.find((p) => p.num === currentPhase) ?? PIPELINE_PHASES[0];
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-col items-center w-full p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-center w-full max-w-2xl mb-6 relative">
        {hasRetry && (
          <svg className="absolute -top-4 left-[18%] w-[64%] h-6 z-20 pointer-events-none" viewBox="0 0 100 16" fill="none">
            <path d="M 8 12 Q 50 -4 92 12" stroke="#f4bf4f" strokeWidth="1.2" strokeDasharray="2.5 2" fill="none"
              markerEnd="url(#retryArrow)" />
            <defs>
              <marker id="retryArrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L0,5 L5,2.5 z" fill="#f4bf4f" />
              </marker>
            </defs>
            <text x="50" y="5" textAnchor="middle" className="text-[4px]" fill="#f4bf4f" fontSize="4" fontWeight="bold">
              Retry {strategyIter}/{gs?.maxStrategyIterations ?? 3}
            </text>
          </svg>
        )}
        <div className="flex items-center gap-0 w-full">
          {PIPELINE_PHASES.map((p, i) => {
            const status = getPhaseStatus(p.num, currentPhase);
            const isActive = status === "active";
            const isDone = status === "done";
            return (
              <React.Fragment key={p.num}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isActive ? "animate-pulse" : ""} ${isDone ? "ring-2 ring-offset-2 ring-offset-jb-panel" : ""}`}
                    style={{ backgroundColor: isDone ? "#27c93f" : (isActive ? p.color : (isDark ? "#555" : "#ccc")), boxShadow: isActive ? `0 0 10px ${p.color}` : "none" }} />
                  <span className={`text-[9px] font-bold ${isActive ? "" : (isDone ? "" : "opacity-40")}`}
                    style={{ color: isDone ? "#27c93f" : (isActive ? p.color : (isDark ? "#888" : "#999")) }}>{p.num}</span>
                  <span className={`text-[8px] font-medium ${isActive ? "" : "opacity-40"}`}
                    style={{ color: isActive ? p.color : (isDark ? "#888" : "#999") }}>{p.name}</span>
                </div>
                {i < PIPELINE_PHASES.length - 1 && (
                  <div className="flex-1 h-[2px] mx-[-2px] relative overflow-hidden self-start mt-[6px]"
                    style={{ backgroundColor: isDark ? "#333" : "#ddd" }}>
                    <div className="absolute h-full left-0 transition-all duration-700"
                      style={{ width: getPhaseStatus(p.num + 1, currentPhase) !== "waiting" ? "100%" : "0%", backgroundColor: getPhaseStatus(p.num + 1, currentPhase) === "active" ? "#548af7" : "#27c93f" }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div className="w-full max-w-2xl flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={activePhase.num} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }}>
            <PhaseDetailCard phase={activePhase} gs={gs ?? {
              currentPhase: 0, currentAgent: "System", strategyIteration: 1,
              maxStrategyIterations: 3, syntaxHealAttempt: 0, maxSyntaxHealAttempts: 3,
              sequentialMutationRetry: 0, maxSequentialMutationRetries: 3,
              validationFaultCount: null, judgeDecision: null, currentDetail: null,
              phaseSummaries: {}, phaseDurations: [], totalDurationMs: null,
            } as GlassboxState} isDark={isDark} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
