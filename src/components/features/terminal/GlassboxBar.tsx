"use client";

import { motion } from "framer-motion";
import type { GlassboxState } from "@/types/glassbox";

interface GlassboxBarProps {
  state: GlassboxState;
  isDark: boolean;
}

const PHASES = [
  { num: 1, label: "Baseline", agent: "Validator" },
  { num: 2, label: "Strategy", agent: "Planner" },
  { num: 3, label: "Execution", agent: "Generator" },
  { num: 4, label: "Validation", agent: "Validator" },
  { num: 5, label: "Adjudication", agent: "Judge" },
  { num: 6, label: "Finalization", agent: "System" },
];

const AGENT_COLORS: Record<string, string> = {
  Planner: "#5a8cf8",
  Generator: "#3dd6c8",
  Validator: "#e09c3b",
  Judge: "#4ec97e",
  System: "#a78bfa",
};

export default function GlassboxBar({ state, isDark }: GlassboxBarProps) {
  const { currentPhase, currentAgent, strategyIteration, syntaxHealAttempt, maxStrategyIterations, maxSyntaxHealAttempts, validationFaultCount, judgeDecision } = state;

  const hasRetries = syntaxHealAttempt > 0 || strategyIteration > 1;
  const agentColor = AGENT_COLORS[currentAgent] ?? "#888";

  return (
    <div className="flex items-center gap-3 h-full px-2 text-[11px] font-medium select-none">
      {/* Phase dots */}
      <div className="flex items-center gap-1">
        {PHASES.map((p) => (
          <div key={p.num} className="flex items-center gap-1">
            <motion.div
              animate={{
                scale: currentPhase === p.num ? 1.3 : 1,
                opacity: currentPhase >= p.num ? 1 : 0.35,
              }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: currentPhase >= p.num ? agentColor : (isDark ? "#555" : "#ccc"),
                boxShadow: currentPhase === p.num ? `0 0 6px ${agentColor}` : "none",
              }}
            />
            {currentPhase === p.num && (
              <span className={`text-[10px] ${isDark ? "text-[#8d95a5]" : "text-[#888]"}`}>
                {p.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Active agent badge */}
      <motion.span
        key={currentAgent}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide border whitespace-nowrap"
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
      </motion.span>

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
  );
}
