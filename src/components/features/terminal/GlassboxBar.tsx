"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GlassboxState } from "@/types/glassbox";
import StatusDetailPanel from "@/components/features/terminal/StatusDetailPanel";

interface GlassboxBarProps {
  state: GlassboxState;
  isDark: boolean;
}

const PHASES = [
  { num: 1, label: "Baseline", agent: "Validator" as const },
  { num: 2, label: "Strategy", agent: "Planner" as const },
  { num: 3, label: "Execution", agent: "Generator" as const },
  { num: 4, label: "Validation", agent: "Validator" as const },
  { num: 5, label: "Adjudication", agent: "Judge" as const },
  { num: 6, label: "Finalization", agent: "System" as const },
];

const AGENT_COLORS: Record<string, string> = {
  Planner: "#5a8cf8",
  Generator: "#3dd6c8",
  Validator: "#e09c3b",
  Judge: "#4ec97e",
  System: "#a78bfa",
};

export default function GlassboxBar({ state, isDark }: GlassboxBarProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { currentPhase, currentAgent, strategyIteration, syntaxHealAttempt, maxStrategyIterations, maxSyntaxHealAttempts, validationFaultCount, judgeDecision, phaseSummaries, currentDetail } = state;

  const hasRetries = syntaxHealAttempt > 0 || strategyIteration > 1;
  const agentColor = AGENT_COLORS[currentAgent] ?? "#888";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 h-full px-2 text-[11px] font-medium select-none">
        {/* Phase dots with tooltips */}
        <div className="flex items-center gap-1">
          {PHASES.map((p) => {
            const summary = phaseSummaries[p.num];
            return (
              <div key={p.num} className="flex items-center gap-1 group relative">
                <div
                  className="w-2 h-2 rounded-full cursor-help"
                  style={{
                    backgroundColor: currentPhase >= p.num ? (currentPhase === p.num ? agentColor : (isDark ? "#777" : "#aaa")) : (isDark ? "#555" : "#ccc"),
                    boxShadow: currentPhase === p.num ? `0 0 6px ${agentColor}` : "none",
                  }}
                />
                {currentPhase === p.num && (
                  <span className={`text-[10px] ${isDark ? "text-[#8d95a5]" : "text-[#888]"}`}>
                    {p.label}
                  </span>
                )}
                {summary && (
                  <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity
                    ${isDark ? "bg-[#1e1f22] text-[#d9dee7] border border-[#393b40]" : "bg-white text-[#333] border border-[#ddd]"}`}>
                    {summary.summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Clickable agent badge */}
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide border cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: `${agentColor}18`,
            color: agentColor,
            borderColor: `${agentColor}33`,
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: agentColor }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: agentColor }} />
          </span>
          {currentAgent}
        </button>

        {/* Retry counter */}
        {hasRetries && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
            ${isDark ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-50 text-yellow-600"}`}>
            Retry {strategyIteration}/{maxStrategyIterations}
            {syntaxHealAttempt > 0 && ` · Heal ${syntaxHealAttempt}/${maxSyntaxHealAttempts}`}
          </span>
        )}

        {/* Validation faults */}
        {validationFaultCount !== null && validationFaultCount > 0 && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
            ${isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"}`}>
            {validationFaultCount} fault{validationFaultCount !== 1 ? "s" : ""}
          </span>
        )}

        {/* Judge decision */}
        {judgeDecision && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
              ${judgeDecision === "ACCEPT"
                ? (isDark ? "bg-green-500/15 text-green-400" : "bg-green-50 text-green-600")
                : (isDark ? "bg-orange-500/15 text-orange-400" : "bg-orange-50 text-orange-600")
              }`}
          >
            {judgeDecision === "ACCEPT" ? "✅" : "❌"} {judgeDecision}
          </span>
        )}
      </div>

      {/* Expandable detail panel */}
      <AnimatePresence>
        {showDetail && currentDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <StatusDetailPanel detail={currentDetail} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
