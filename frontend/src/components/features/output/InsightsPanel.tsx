"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Sparkles,
  Layers,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { InsightMetric } from "@/types/insights";

interface InsightsPanelProps {
  metrics: InsightMetric[];
  summary: string;
  planner_model?: string;
  generator_model?: string;
  judge_model?: string;
}

const metricIconMap: Record<string, LucideIcon> = {
  Sparkles,
  Layers,
  CheckCircle,
  Clock,
  Cpu,
};

export default function InsightsPanel({
  metrics,
  summary,
  planner_model,
  generator_model,
  judge_model,
}: InsightsPanelProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  if (!mounted) return null;

  if (metrics.length === 0 && !summary.trim()) {
    return (
      <div className="h-full p-6 animate-in fade-in duration-500 overflow-y-auto flex items-center justify-center">
        <p
          className={`text-[13px] font-medium ${isDark ? "text-jb-text-muted" : "text-slate-500"}`}
        >
          No insights available for this run.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full p-6 animate-in fade-in duration-500 overflow-y-auto">
      {(planner_model || generator_model || judge_model) && (
        <div
          className={`mb-8 p-5 rounded-[20px] border relative overflow-hidden group shadow-sm transition-all duration-300
          ${isDark ? "bg-jb-panel border-jb-border" : "bg-[#f7f8fa] border-[#ebecf0]"}`}
        >
          <h3
            className={`text-[11px] font-bold mb-5 uppercase tracking-[0.1em] flex items-center gap-2 ${isDark ? "text-gray-400" : "text-slate-500"}`}
          >
            <Cpu size={14} className="text-jb-accent" /> Agents
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
            {planner_model && (
              <div className="flex flex-col gap-2 group/node">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#56a8f5] shadow-[0_0_8px_#56a8f5]" />
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-widest opacity-60 ${isDark ? "text-gray-400" : "text-slate-500"}`}
                  >
                    Planner
                  </span>
                </div>
                <span
                  className={`text-[13px] font-semibold truncate leading-tight transition-colors duration-300 ${isDark ? "text-gray-100" : "text-slate-800"}`}
                  title={planner_model}
                >
                  {planner_model}
                </span>
              </div>
            )}
            {generator_model && (
              <div className="flex flex-col gap-2 group/node">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#2aacb8] shadow-[0_0_8px_#2aacb8]" />
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-widest opacity-60 ${isDark ? "text-gray-400" : "text-slate-500"}`}
                  >
                    Generator
                  </span>
                </div>
                <span
                  className={`text-[13px] font-semibold truncate leading-tight transition-colors duration-300 ${isDark ? "text-gray-100" : "text-slate-800"}`}
                  title={generator_model}
                >
                  {generator_model}
                </span>
              </div>
            )}
            {judge_model && (
              <div className="flex flex-col gap-2 group/node">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#27c93f] shadow-[0_0_8px_#27c93f]" />
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-widest opacity-60 ${isDark ? "text-gray-400" : "text-slate-500"}`}
                  >
                    Judge
                  </span>
                </div>
                <span
                  className={`text-[13px] font-semibold truncate leading-tight transition-colors duration-300 ${isDark ? "text-gray-100" : "text-slate-800"}`}
                  title={judge_model}
                >
                  {judge_model}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <h3
        className={`text-sm font-semibold mb-6 flex items-center gap-2 ${isDark ? "text-gray-200" : "text-slate-800"}`}
      >
        <Sparkles
          size={16}
          className={isDark ? "text-cyan-400" : "text-cyan-600"}
        />{" "}
        Target Segment Insights
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m, i) =>
          (() => {
            const displayTitle = m.title;
            const MetricIcon =
              (m.iconKey && metricIconMap[m.iconKey]) || Sparkles;
            const isIncrease = m.direction === "up";
            const isDecrease = m.direction === "down";

            const isComplexity = displayTitle === "Cyclomatic Complexity";
            const isGpuMetric = displayTitle === "GPU Utilization" || displayTitle === "GPU Memory";

            // Custom colors for each card
            const getCardTheme = () => {
              if (displayTitle === "Cyclomatic Complexity")
                return {
                  base: "blue",
                  color: isDark ? "text-blue-400" : "text-blue-600",
                  bg: isDark ? "bg-blue-500/10" : "bg-blue-500/5",
                  border: isDark ? "border-blue-500/20" : "border-blue-500/10",
                };
              if (displayTitle === "Inference Time")
                return {
                  base: "amber",
                  color: isDark ? "text-amber-400" : "text-amber-600",
                  bg: isDark ? "bg-amber-500/10" : "bg-amber-500/5",
                  border: isDark
                    ? "border-amber-500/20"
                    : "border-amber-500/10",
                };
              if (displayTitle === "GPU Utilization")
                return {
                  base: "purple",
                  color: isDark ? "text-purple-400" : "text-purple-600",
                  bg: isDark ? "bg-purple-500/10" : "bg-purple-500/5",
                  border: isDark
                    ? "border-purple-500/20"
                    : "border-purple-500/10",
                };
              if (displayTitle === "GPU Memory")
                return {
                  base: "cyan",
                  color: isDark ? "text-cyan-400" : "text-cyan-600",
                  bg: isDark ? "bg-cyan-500/10" : "bg-cyan-500/5",
                  border: isDark ? "border-cyan-500/20" : "border-cyan-500/10",
                };

              // Fallback dynamic colors
              return {
                base: "emerald",
                color: isIncrease
                  ? isDark
                    ? "text-green-400"
                    : "text-green-600"
                  : isDecrease
                    ? isDark
                      ? "text-red-400"
                      : "text-red-600"
                    : isDark
                      ? "text-blue-400"
                      : "text-blue-600",
                bg: isIncrease
                  ? isDark
                    ? "bg-green-500/10"
                    : "bg-green-500/5"
                  : isDecrease
                    ? isDark
                      ? "bg-red-500/10"
                      : "bg-red-500/5"
                    : isDark
                      ? "bg-blue-500/10"
                      : "bg-blue-500/5",
                border: isIncrease
                  ? isDark
                    ? "border-green-500/20"
                    : "border-green-500/10"
                  : isDecrease
                    ? isDark
                      ? "border-red-500/20"
                      : "border-red-500/10"
                    : isDark
                      ? "border-blue-500/20"
                      : "border-blue-500/10",
              };
            };

                        const theme = getCardTheme();

            return (
              <div
                key={`${m.title}-${i}`}
                className={`p-4 rounded-[16px] border ${theme.border} ${theme.bg} flex flex-col gap-3 group hover:scale-[1.02] transition-transform duration-300`}
              >
                <div
                  className={`p-2.5 w-max mr-auto rounded-[12px] border ${theme.border} ${theme.color} bg-background shadow-sm group-hover:scale-110 transition-transform flex items-center gap-2`}
                >
                  <MetricIcon size={18} />
                  {!isComplexity &&
                    (isIncrease ? (
                      <TrendingUp size={14} />
                    ) : isDecrease ? (
                      <TrendingDown size={14} />
                    ) : null)}
                </div>
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 text-left ${isDark ? "text-gray-500" : "text-slate-500"}`}>
                    {displayTitle}
                  </p>
                  {isGpuMetric ? (
                    <div className="flex gap-3 mt-2">
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <MetricIcon size={16} className={theme.color} />
                        <span className={`text-[16px] font-bold ${theme.color}`}>{m.before}</span>
                        <span className={`text-[12px] font-semibold ${isDark ? "text-gray-400" : "text-slate-500"}`}>avg</span>
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className={`text-[18px] font-light ${isDark ? "text-gray-600" : "text-gray-300"}`}>|</span>
                      </div>
                      <div className="flex-1 flex flex-col items-center gap-1">
                        <MetricIcon size={16} className={theme.color} />
                        <span className={`text-[16px] font-bold ${theme.color}`}>{m.after}</span>
                        <span className={`text-[12px] font-semibold ${isDark ? "text-gray-400" : "text-slate-500"}`}>peak</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-baseline gap-2 justify-start">
                      <p className={`text-[16px] font-bold ${isDark ? "text-gray-200" : "text-slate-900"}`}>
                        {isComplexity && m.before && m.before !== "—"
                          ? `${m.before} → ${m.after}`
                          : m.after}
                      </p>
                      {!isComplexity && m.before && m.before !== "—" && (
                        <p className={`text-[12px] font-medium line-through opacity-50 ${isDark ? "text-gray-400" : "text-slate-500"}`}>
                          {m.before}
                        </p>
                      )}
                    </div>
                  )}
                  {m.interpretation && (
                    <p className={`text-[11px] leading-relaxed ${isDark ? "text-gray-400" : "text-slate-500"}`}>
                      {m.interpretation}
                    </p>
                  )}
                </div>
              </div>
            );
          })()
        )}
      </div>

      {summary.trim() && (
        <div className="mt-6 p-4 rounded-[16px] border border-border bg-secondary/30">
          <h4
            className={`text-[12px] font-bold mb-4 uppercase tracking-wide ${isDark ? "text-gray-400" : "text-slate-500"}`}
          >
            Summary
          </h4>
          <div className="space-y-4">
            {summary
              .split("\n")
              .filter((p) => p.trim())
              .map((point, index) => {
                const trimmedPoint = point.trim().replace(/^[•\-]\s*/, "");
                return (
                  <div
                    key={`summary-${index}-${trimmedPoint.slice(0, 20)}`}
                    className="flex gap-3 items-start"
                  >
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-cyan-500 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.5)]" />
                    <p
                      className={`text-[13px] leading-relaxed ${isDark ? "text-gray-300" : "text-slate-700"}`}
                    >
                      {trimmedPoint
                        .split(/(\*\*.*?\*\*)/)
                        .map((part, i) =>
                          part.startsWith("**") && part.endsWith("**") ? (
                            <strong key={i}>{part.slice(2, -2)}</strong>
                          ) : (
                            part
                          ),
                        )}
                    </p>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
