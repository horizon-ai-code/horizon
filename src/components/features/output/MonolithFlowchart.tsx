"use client"

import React from "react";
import { useTheme } from "next-themes";
import type { GlassboxState } from "@/types/glassbox";

const MONOLITH_PHASES = [
  { num: 1, name: "Code Gen", color: "#548af7" },
  { num: 2, name: "Insights", color: "#a855f7" },
];

export default function MonolithFlowchart({
  glassboxState,
  originalComplexity,
  refactoredComplexity,
  inferenceTime,
}: {
  glassboxState?: GlassboxState;
  originalComplexity?: number | null;
  refactoredComplexity?: number | null;
  inferenceTime?: number | null;
}) {
  const currentPhase = glassboxState?.currentPhase ?? 0;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const hasCcData = originalComplexity != null && refactoredComplexity != null;
  const ccImprovement = hasCcData && refacCC(originalComplexity, refactoredComplexity);
  const elapsed = inferenceTime ? `${inferenceTime.toFixed(1)}s` : null;
  const ccLabel = hasCcData ? `${originalComplexity} → ${refactoredComplexity}` : null;

  return (
    <div className="flex flex-col items-center w-full p-6 animate-in fade-in zoom-in-95 duration-500">
      <span className="text-[15px] font-bold tracking-wide mb-6" style={{ color: "#548af7" }}>
        Monolith — Single-Pass Refactor
      </span>
      <div className="flex items-center justify-center w-full max-w-md mb-2">
        <div className="flex items-center gap-0 w-full">
          {MONOLITH_PHASES.map((p, i) => {
            const isActive = p.num === currentPhase;
            const isDone = p.num < currentPhase;
            return (
              <React.Fragment key={p.num}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div className={`w-3 h-3 rounded-full transition-all duration-500 ${isActive ? "animate-pulse" : ""}`}
                    style={{
                      backgroundColor: isDone ? "#27c93f" : (isActive ? p.color : (isDark ? "#555" : "#ccc")),
                      boxShadow: isActive ? `0 0 10px ${p.color}` : "none",
                    }} />
                  <span className="text-[11px] font-bold"
                    style={{ color: isActive ? p.color : (isDark ? "#888" : "#999") }}>{p.name}</span>
                </div>
                {i < MONOLITH_PHASES.length - 1 && (
                  <div className="flex-1 h-[2px] mx-[-2px] self-start mt-[6px]"
                    style={{ backgroundColor: isDark ? "#333" : "#ddd" }} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-center w-full max-w-md mt-4">
        <div className="flex items-center gap-0 w-full text-center">
          <div className="flex-1 flex flex-col items-center gap-1">
            {elapsed && <span className="text-[11px] text-jb-text-muted">⏱ {elapsed}</span>}
            {ccLabel && (
              <span className="text-[11px] font-medium" style={{ color: ccImprovement ? "#27c93f" : (isDark ? "#bbb" : "#666") }}>
                CC {ccLabel}
              </span>
            )}
          </div>
          <div className="flex-1" />
        </div>
      </div>
      {currentPhase > 2 && (
        <div className="flex items-center gap-2 mt-6 px-4 py-2 rounded-full text-[12px] font-medium bg-emerald-500/10 text-emerald-500">
          <span>✓ Single-pass refactoring complete</span>
        </div>
      )}
    </div>
  );
}

function refacCC(orig: number, refac: number): boolean {
  return refac < orig;
}
