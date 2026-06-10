"use client"

import React from "react";
import { useTheme } from "next-themes";
import type { GlassboxState } from "@/types/glassbox";
import { Cpu } from "lucide-react";

const MONOLITH_PHASES = [
  { num: 1, name: "Code Gen", color: "#548af7" },
  { num: 2, name: "Insights", color: "#a855f7" },
];

export default function MonolithFlowchart({
  glassboxState,
}: {
  glassboxState?: GlassboxState;
}) {
  const currentPhase = glassboxState?.currentPhase ?? 0;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-col items-center w-full p-6 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-4"
        style={{ backgroundColor: "#548af718", color: "#548af7", boxShadow: "0 0 20px #548af715" }}>
        <Cpu size={28} strokeWidth={1.5} />
      </div>
      <span className="text-[16px] font-bold tracking-wide mb-4" style={{ color: "#548af7" }}>
        Monolith
      </span>
      <p className="text-[13px] text-jb-text-muted mb-6">Single-pass refactor using 7B model</p>
      <div className="flex items-center justify-center w-full max-w-sm">
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
                  <span className={`text-[9px] font-bold`}
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
    </div>
  );
}
