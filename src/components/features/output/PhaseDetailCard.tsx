"use client"

import React from "react";
import { AlertCircle } from "lucide-react";
import type { GlassboxState } from "@/types/glassbox";
import type { PipelinePhase } from "@/lib/pipelinePhases";

function TagInline({ label, value, color, isDark }: { label: string; value: string; color: string; isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border
      ${isDark ? "bg-[#2b2d30]" : "bg-white"}`}
      style={{ borderColor: `${color}44` }}>
      <span className="font-bold" style={{ color }}>{label}</span>
      <code className="text-[11px]" style={{ color: isDark ? "#56a8f5" : "#3574f0" }}>{value}</code>
    </span>
  );
}

export default function PhaseDetailCard({ phase, gs, isDark }: { phase: PipelinePhase; gs: GlassboxState; isDark: boolean }) {
  const cd = gs.currentDetail;
  const duration = gs.phaseDurations?.find((d) => d.phase === phase.num);
  const durationStr = duration ? `${(duration.durationMs / 1000).toFixed(1)}s` : null;
  const bg = isDark ? "bg-[#1e1f22]" : "bg-white";
  const border = isDark ? "border-[#393b40]" : "border-[#ddd]";
  const muted = isDark ? "text-[#8d95a5]" : "text-[#888]";

  return (
    <div className={`w-full rounded-xl border ${bg} ${border} p-5 text-center`}>
      <div className="flex flex-col items-center mb-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-2"
          style={{ backgroundColor: `${phase.color}18`, color: phase.color, boxShadow: `0 0 20px ${phase.color}15` }}>
          <phase.icon size={28} strokeWidth={1.5} />
        </div>
        <span className="text-[16px] font-bold tracking-wide" style={{ color: phase.color }}>
          {phase.agent}
        </span>
        <span className={`text-[11px] font-medium ${muted}`}>
          Phase {phase.num}: {phase.name}{durationStr ? ` · ${durationStr}` : ""}
        </span>
      </div>

      <div className="text-left">
        {phase.num === 2 && cd?.intent && (
          <div className="flex flex-wrap gap-2">
            {cd.intent.category && <TagInline label="Category" value={cd.intent.category} color="#5a8cf8" isDark={isDark} />}
            {cd.intent.intent && <TagInline label="Intent" value={cd.intent.intent} color="#3dd6c8" isDark={isDark} />}
            {cd.intent.targetClass && <TagInline label="Class" value={cd.intent.targetClass} color="#e09c3b" isDark={isDark} />}
            {cd.intent.targetMember && <TagInline label="Member" value={cd.intent.targetMember} color="#e09c3b" isDark={isDark} />}
          </div>
        )}

        {phase.num === 2 && cd?.architecture && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px]">
            {cd.architecture.primaryTargets.length > 0 && (
              <span className={muted}>Targets: {cd.architecture.primaryTargets.map(t => t.name).join(", ")}</span>
            )}
            {cd.architecture.newStructures.length > 0 && (
              <span className={muted}>New: {cd.architecture.newStructures.map(t => t.name).join(", ")}</span>
            )}
            {cd.architecture.mustPreserve.length > 0 && (
              <span className={muted}>Preserve: {cd.architecture.mustPreserve.map(t => t.name).join(", ")}</span>
            )}
          </div>
        )}

        {phase.num === 3 && cd?.mutations && cd.mutations.length > 0 && (
          <div>
            {cd.generatorProgress && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "#333" : "#e5e7eb" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((cd.generatorProgress.completed / cd.generatorProgress.total) * 100)}%`, backgroundColor: phase.color }} />
                </div>
                <span className={`text-[11px] font-bold ${muted}`}>
                  {cd.generatorProgress.completed}/{cd.generatorProgress.total}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {cd.mutations.map((m, i) => {
                const statusColor = m.status === "completed" ? "#27c93f"
                  : m.status === "in_progress" ? phase.color
                  : m.status === "retrying" ? "#f4bf4f"
                  : m.status === "failed" ? "#f93e3e"
                  : "#888";
                const icon = m.status === "completed" ? "✅"
                  : m.status === "in_progress" ? "◉"
                  : m.status === "retrying" ? "⟳"
                  : m.status === "failed" ? "✗"
                  : "○";
                return (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: statusColor }}>{icon}</span>
                    <span className="font-bold" style={{ color: "#3dd6c8" }}>{m.action}</span>
                    <span className={muted}>on</span>
                    <code className={`text-[11px] ${isDark ? "text-[#56a8f5]" : "text-[#3574f0]"}`}>{m.target}</code>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase.num === 4 && cd?.checks && cd.checks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={`text-[12px] font-bold ${muted}`}>
              {cd.checks.filter(c => c.passed).length}/{cd.checks.length} checks passed
              {cd.checks.some(c => !c.passed) && ` · ${cd.checks.filter(c => !c.passed).length} failed`}
            </span>
            {cd.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span style={{ color: c.passed ? "#27c93f" : "#f93e3e" }}>{c.passed ? "✅" : "✗"}</span>
                <span className={c.passed ? "" : "font-bold"} style={{ color: c.passed ? (isDark ? "#aaa" : "#666") : "#f93e3e" }}>
                  {c.name}
                </span>
                {!c.passed && c.details && <span className={muted}>— {c.details}</span>}
              </div>
            ))}
          </div>
        )}

        {phase.num === 5 && gs.judgeDecision && (
          <div className="flex items-center gap-2">
            <span className="text-[18px]">{gs.judgeDecision === "ACCEPT" ? "✅" : "❌"}</span>
            <span className={`text-[16px] font-bold ${gs.judgeDecision === "ACCEPT" ? "text-[#27c93f]" : "text-[#f93e3e]"}`}>
              {gs.judgeDecision}
            </span>
          </div>
        )}

        {phase.num === 5 && cd?.judgeIssues && cd.judgeIssues.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {cd.judgeIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <AlertCircle size={12} className="mt-0.5 shrink-0 text-orange-400" />
                <span className="font-bold text-orange-400">{issue.issueType}</span>
                <span className={muted}>— {issue.description}</span>
              </div>
            ))}
          </div>
        )}

        {phase.num === 1 && cd?.analysisSummary && (
          <span className={`text-[12px] ${muted}`}>{cd.analysisSummary}</span>
        )}

        {(() => {
          const isEmpty = !cd?.intent && !cd?.mutations && !cd?.checks && !gs.judgeDecision;
          if (isEmpty || phase.num === 6) {
            return <span className={`text-[12px] ${muted}`}>{cd?.phaseAction ?? "Processing..."}</span>;
          }
          return null;
        })()}
      </div>
    </div>
  );
}
