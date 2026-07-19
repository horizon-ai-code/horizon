"use client";

import React, { useEffect, useState, useRef } from "react";
import { useTheme } from "next-themes";
import {
  Cpu,
  Layers,
  FileCode2,
  CheckCircle2,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { NodeStatus } from "@/types/flowGraph";
import type { GlassboxState } from "@/types/glassbox";
import { PHASES } from "@/lib/flowGraph/phases";

const ICONS: Record<
  string,
  React.ComponentType<{ size?: number; className?: string }>
> = {
  Cpu,
  Layers,
  FileCode2,
  CheckCircle2,
  Clock,
  Zap,
};

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
  /** Phase states from backend (live via WS, history via API) */
  phaseStates?: Record<string, string>;
}

export default function FlowGrid({
  appState,
  exitStatus,
  glassboxState,
  phaseStates: propStates,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);
  const isDark = mounted ? resolvedTheme === "dark" : true;

  const {
    currentPhase,
    strategyIteration,
    syntaxHealAttempt,
    phaseDurations,
    plannerModel,
    generatorModel,
    judgeModel,
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
        .filter(
          ([, s]) => s === "done_ok" || s === "done_fail" || s === "flagged",
        )
        .map(([k]) => Number(k))
        .reduce((a, b) => Math.max(a, b), 0)
    : currentPhase;

  // Refs for scroll container and active cards
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivePhaseRef = useRef<number | null>(null);

  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      // Using a small threshold (2px) for rounding errors
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }
  };

  const startUserScroll = () => {
    isUserScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  };

  const handleScroll = () => {
    updateScrollButtons();
    if (isUserScrollingRef.current) {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    }
  };

  // Scroll manually via navigation buttons
  const scrollLeft = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollBy({ left: -250, behavior: "smooth" });
    }
  };

  const scrollRight = () => {
    const container = containerRef.current;
    if (container) {
      container.scrollBy({ left: 250, behavior: "smooth" });
    }
  };

  // Auto-scroll logic targeting the active card
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (currentPhase !== lastActivePhaseRef.current) {
      lastActivePhaseRef.current = currentPhase;

      const performAutoScroll = () => {
        const activeCard = cardRefs.current[currentPhase];
        if (activeCard) {
          activeCard.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest",
          });
        }
      };

      if (isUserScrollingRef.current) {
        const checkAndScroll = () => {
          if (!isUserScrollingRef.current) {
            performAutoScroll();
          } else {
            timeoutId = setTimeout(checkAndScroll, 100);
          }
        };
        timeoutId = setTimeout(checkAndScroll, 100);
      } else {
        performAutoScroll();
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentPhase]);

  // Clean up main scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Set up ResizeObserver to update scroll buttons on dimension changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    updateScrollButtons();

    const observer = new ResizeObserver(() => {
      updateScrollButtons();
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-5 h-full w-full p-6">
      <style>{`
        .flow-grid-scrollbar-none::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {strategyIteration > 1 && (
        <div
          className={`text-[10px] font-bold px-2.5 py-1 rounded-md border ${isDark ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}
        >
          Strategy Iteration {strategyIteration}/
          {glassboxState.maxStrategyIterations ?? 3}
        </div>
      )}

      {/* Reordered linear horizontal sequence */}
      <div className="relative w-full max-w-full group">
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            type="button"
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full border shadow-md backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 ${
              isDark
                ? "bg-jb-panel/85 border-jb-border/50 text-jb-text hover:bg-jb-panel"
                : "bg-white/85 border-[#dfdfdf] text-[#080808] hover:bg-white"
            }`}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        {/* Right Arrow Button */}
        {canScrollRight && (
          <button
            onClick={scrollRight}
            type="button"
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-10 h-10 rounded-full border shadow-md backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95 ${
              isDark
                ? "bg-jb-panel/85 border-jb-border/50 text-jb-text hover:bg-jb-panel"
                : "bg-white/85 border-[#dfdfdf] text-[#080808] hover:bg-white"
            }`}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Scrollable Container */}
        <div
          ref={containerRef}
          onWheel={startUserScroll}
          onPointerDown={startUserScroll}
          onTouchStart={startUserScroll}
          onScroll={handleScroll}
          className="flex items-center gap-4 overflow-x-auto py-20 px-32 flow-grid-scrollbar-none scroll-smooth"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollSnapType: "x proximity",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 128px, black calc(100% - 128px), transparent)",
            maskImage:
              "linear-gradient(to right, transparent, black 128px, black calc(100% - 128px), transparent)",
          }}
        >
          {PHASES.map((phase) => {
            const num = phase.num;
            const isLast = num === 6;

            const modelName =
              num === 2
                ? plannerModel
                : num === 3
                  ? generatorModel
                  : num === 5
                    ? judgeModel
                    : undefined;

            const iteration =
              num === 2
                ? strategyIteration
                : num === 3
                  ? Math.max(syntaxHealAttempt, 1)
                  : 1;

            return (
              <React.Fragment key={num}>
                <div
                  ref={(el) => {
                    cardRefs.current[num] = el;
                  }}
                  className={`shrink-0 origin-center transition-all duration-500 ${
                    !isDone
                      ? nodeStatus(num) === "active"
                        ? "scale-[1.5] z-10 mx-20"
                        : "scale-[0.85] opacity-60"
                      : ""
                  }`}
                  style={{ scrollSnapAlign: "center" }}
                >
                  <NodeCard
                    phase={phase}
                    status={nodeStatus(num)}
                    modelName={modelName}
                    iteration={iteration}
                    durationMs={
                      phaseDurations.find((d) => d.phase === num)?.durationMs ??
                      null
                    }
                    isDark={isDark}
                  />
                </div>
                {!isLast && (
                  <Connector active={highestDone > num} isDark={isDark} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {isDone && (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-jb-panel/90 border border-jb-border/50 text-[11px] font-medium">
          {exitStatus && (
            <span
              className={
                exitStatus === "SUCCESS" ? "text-green-500" : "text-red-500"
              }
            >
              {exitStatus}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Connector with arrow ──

function Connector({ active, isDark }: { active: boolean; isDark: boolean }) {
  const c = active ? "#4ec97e" : isDark ? "#393b40" : "#d1d1d1";
  return (
    <span className="text-lg leading-none shrink-0" style={{ color: c }}>
      ▶
    </span>
  );
}

// ── NodeCard ──

function NodeCard({
  phase,
  status,
  modelName,
  iteration,
  durationMs,
  isDark,
}: {
  phase: {
    num: number;
    name: string;
    agent: string;
    icon: string;
    color: string;
  };
  status: NodeStatus;
  modelName?: string;
  iteration: number;
  durationMs: number | null;
  isDark: boolean;
}) {
  const Icon = ICONS[phase.icon];

  const styles: Record<NodeStatus, { bg: string; ring: string; text: string }> =
    {
      waiting: {
        bg: "bg-jb-panel/30",
        ring: "ring-jb-border/30",
        text: "text-jb-text-muted/50",
      },
      active: {
        bg: "bg-jb-bg",
        ring: "ring-jb-accent/50",
        text: "text-jb-accent",
      },
      done_ok: {
        bg: "bg-green-500/5",
        ring: "ring-green-500/40",
        text: "text-green-500",
      },
      done_fail: {
        bg: "bg-red-500/5",
        ring: "ring-red-500/40",
        text: "text-red-500",
      },
      skipped: {
        bg: "bg-jb-panel/20",
        ring: "ring-jb-border/20",
        text: "text-jb-text-muted/30",
      },
      flagged: {
        bg: "bg-red-500/5",
        ring: "ring-red-500/20",
        text: "text-red-400/60",
      },
    };

  const s = styles[status];

  return (
    <div
      className={`relative flex flex-col items-center justify-center p-3 w-44 h-44 rounded-[20px] ring-1 transition-all duration-500 ${s.bg} ${s.ring} ${s.text}`}
    >
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[12px] font-bold opacity-60">P{phase.num}</span>
      </div>

      {status === "active" && (
        <div
          className="absolute inset-0 rounded-[20px] animate-contained-ping"
          style={{ backgroundColor: phase.color }}
        />
      )}

      {Icon && (
        <span
          className="mb-2"
          style={{
            color:
              status !== "waiting" && status !== "skipped"
                ? phase.color
                : undefined,
          }}
        >
          <Icon size={34} />
        </span>
      )}

      <h4 className="text-[16px] font-bold text-center leading-tight">
        {phase.name}
      </h4>
      <span className="text-[11px] font-mono opacity-60">{phase.agent}</span>

      {modelName && (
        <span className="text-[10px] font-mono opacity-40 text-center leading-tight mt-0.5">
          {modelName}
        </span>
      )}

      {iteration > 1 && status !== "waiting" && status !== "skipped" && (
        <span
          className={`absolute -top-1.5 -right-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full border ${isDark ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}
        >
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
