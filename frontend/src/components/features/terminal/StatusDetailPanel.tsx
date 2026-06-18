"use client";

import { AlertCircle } from "lucide-react";
import type { CurrentStatusDetail } from "@/types/glassbox";

interface StatusDetailPanelProps {
  detail: CurrentStatusDetail;
  isDark: boolean;
}

const TIER_LABELS: Record<string, string> = {
  TIER_1_SYNTAX: "Syntax Error",
  TIER_2_A_COMPLEXITY: "Complexity",
  TIER_2_B_BOUNDARY: "Boundary",
  TIER_2_C_INTENT_MATH: "Intent Mismatch",
  TIER_3_JUDGE: "Judge Rejected",
};

const MUTATION_LABELS: Record<string, string> = {
  ADD_METHOD: "Add Method",
  MODIFY_METHOD: "Modify Method",
  DELETE_METHOD: "Delete Method",
  EXTRACT_METHOD: "Extract Method",
  INLINE_METHOD: "Inline Method",
};

export default function StatusDetailPanel({ detail, isDark }: StatusDetailPanelProps) {
  const { intent, mutations, findings, checks, judgeVerdict, judgeIssues, totalFaults, phaseAction, architecture, generatorProgress, generatorTemperature } = detail;
  const muted = isDark ? "text-[#8d95a5]" : "text-[#888]";
  const border = isDark ? "border-[#393b40]" : "border-[#ddd]";
  const bg = isDark ? "bg-[#1e1f22]" : "bg-[#f2f2f2]";

  return (
    <div className={`px-4 py-2 text-[11px] leading-relaxed ${bg} border-t ${border}`}>
      {/* Intent detail */}
      {intent && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
          {intent.category && <Tag label="Category" value={intent.category} color="#5a8cf8" isDark={isDark} />}
          {intent.intent && <Tag label="Intent" value={intent.intent} color="#3dd6c8" isDark={isDark} />}
          {intent.targetClass && <Tag label="Class" value={intent.targetClass} color="#e09c3b" isDark={isDark} />}
          {intent.targetMember && <Tag label="Member" value={intent.targetMember} color="#e09c3b" isDark={isDark} />}
          {intent.targetUnit && <Tag label="Unit" value={intent.targetUnit} color="#a78bfa" isDark={isDark} />}
        </div>
      )}

      {/* Architecture analysis */}
      {architecture && (
        <div className="mb-1">
          <span className={`text-[10px] font-bold tracking-wide ${muted}`}>Analysis:</span>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
            {architecture.primaryTargets.length > 0 && (
              <TargetGroup label="Targets" targets={architecture.primaryTargets} color="#5a8cf8" muted={muted} />
            )}
            {architecture.newStructures.length > 0 && (
              <TargetGroup label="New" targets={architecture.newStructures} color="#3dd6c8" muted={muted} />
            )}
            {architecture.mustPreserve.length > 0 && (
              <TargetGroup label="Preserve" targets={architecture.mustPreserve} color="#e09c3b" muted={muted} />
            )}
          </div>
        </div>
      )}

      {/* Mutation plan with live status */}
      {mutations && mutations.length > 0 && (
        <div className="mb-1">
          <span className={`text-[10px] font-bold tracking-wide ${muted}`}>Mutations:</span>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {mutations.map((m, i) => {
              const statusColor = m.status === "completed" ? "#27c93f"
                : m.status === "in_progress" ? "#56a8f5"
                : m.status === "retrying" ? "#f4bf4f"
                : m.status === "failed" ? "#f93e3e"
                : "#888";
              const statusIcon = m.status === "completed" ? "✅"
                : m.status === "in_progress" ? "◉"
                : m.status === "retrying" ? "⟳"
                : m.status === "failed" ? "✗"
                : "○";
              return (
                <span key={i}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
                  style={{
                    backgroundColor: isDark ? "#2b2d30" : "#fff",
                    borderColor: m.status === "in_progress" ? `${statusColor}66` : (isDark ? "#393b40" : "#ddd"),
                  }}
                >
                  <span style={{ color: statusColor }}>{statusIcon}</span>
                  <span className="font-bold" style={{ color: "#3dd6c8" }}>
                    {MUTATION_LABELS[m.action] ?? m.action}
                  </span>
                  <span className={muted}>on</span>
                  <code className={`text-[10px] ${isDark ? "text-[#56a8f5]" : "text-[#3574f0]"}`}>
                    {m.target}
                  </code>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Generator progress */}
      {generatorProgress && (
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "#333" : "#ddd" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((generatorProgress.completed / generatorProgress.total) * 100)}%`,
                backgroundColor: "#3dd6c8",
              }}
            />
          </div>
          <span className={`text-[10px] font-medium ${muted}`}>
            {generatorProgress.completed}/{generatorProgress.total}
          </span>
          {generatorTemperature !== undefined && (
            <span className={`text-[9px] font-medium ${muted}`}>
              temp {generatorTemperature}
            </span>
          )}
        </div>
      )}

      {/* Validation checks — structured pass/fail */}
      {checks && checks.length > 0 && (
        <div className="mb-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-[10px] font-bold tracking-wide ${muted}`}>
              Checks: {checks.filter((c) => c.passed).length}/{checks.length} passed
              {checks.some((c) => !c.passed) && ` · ${checks.filter((c) => !c.passed).length} failed`}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            {checks.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span style={{ color: c.passed ? "#27c93f" : "#f93e3e" }}>
                  {c.passed ? "✅" : "✗"}
                </span>
                <span className={`text-[10px] font-medium ${c.passed ? "" : "font-bold"}`}
                  style={{ color: c.passed ? (isDark ? "#aaa" : "#666") : "#f93e3e" }}>
                  {c.name}
                </span>
                {!c.passed && c.details && (
                  <span className={`text-[10px] ${muted}`}>— {c.details}</span>
                )}
                {!c.passed && c.before_value !== undefined && c.after_value !== undefined && (
                  <span className={`text-[10px] ${muted}`}>
                    ({c.before_value} → {c.after_value})
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Validation findings (legacy, from text parsing) */}
      {!checks && findings && findings.length > 0 && (
        <div className="mb-1">
          <span className={`text-[10px] font-bold tracking-wide ${muted}`}>
            {totalFaults ? `${totalFaults} Faults` : "Findings"}:
          </span>
          <div className="flex flex-col gap-0.5 mt-0.5">
            {findings.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={`shrink-0 px-1 rounded text-[9px] font-bold
                  ${f.tier.includes("SYNTAX") ? "bg-red-500/15 text-red-400"
                    : f.tier.includes("COMPLEXITY") ? "bg-orange-500/15 text-orange-400"
                    : f.tier.includes("BOUNDARY") ? "bg-yellow-500/15 text-yellow-400"
                    : f.tier.includes("JUDGE") ? "bg-purple-500/15 text-purple-400"
                    : "bg-gray-500/15 text-gray-400"}`}>
                  {TIER_LABELS[f.tier] ?? f.tier}
                </span>
                <span className={isDark ? "text-[#c1c8d6]" : "text-[#555]"}>
                  {f.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Judge verdict */}
      {judgeVerdict && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px]">{judgeVerdict === "ACCEPT" ? "✅" : "❌"}</span>
          <span className={`text-[12px] font-bold ${judgeVerdict === "ACCEPT" ? "text-[#27c93f]" : "text-[#f93e3e]"}`}>
            {judgeVerdict}
          </span>
        </div>
      )}

      {/* Judge issues */}
      {judgeIssues && judgeIssues.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {judgeIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertCircle size={10} className="mt-0.5 shrink-0 text-orange-400" />
              <span>
                <span className="font-bold text-orange-400">{issue.issueType}</span>
                <span className={muted}> — {issue.description}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fallback */}
      {!intent && !architecture && !mutations && !checks && (!findings || findings.length === 0) && !judgeVerdict && (
        <span className={muted}>{phaseAction ?? "Processing..."}</span>
      )}
    </div>
  );
}

function TargetGroup({ label, targets, color, muted }: { label: string; targets: { name: string; kind?: string; purpose?: string }[]; color: string; muted: string }) {
  return (
    <span className="inline-flex items-center gap-1" style={{ color }}>
      <span className={`text-[9px] font-bold tracking-wide`}>{label}:</span>
      {targets.map((t, i) => (
        <code key={i} className="text-[10px] px-1 rounded"
          style={{ backgroundColor: `${color}18`, color }}>
          {t.name}{t.kind && ` (${t.kind})`}
        </code>
      ))}
    </span>
  );
}

function Tag({ label, value, color, isDark }: { label: string; value: string; color: string; isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border
      ${isDark ? "bg-[#2b2d30]" : "bg-white"}`}
      style={{ borderColor: `${color}44`, color: isDark ? "#d9dee7" : "#333" }}
    >
      <span className="font-bold" style={{ color }}>{label}</span>
      <code className="text-[10px]" style={{ color: isDark ? "#56a8f5" : "#3574f0" }}>{value}</code>
    </span>
  );
}
