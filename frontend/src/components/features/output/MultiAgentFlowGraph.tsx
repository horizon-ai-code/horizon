"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import PhaseCard from "./PhaseCard";
import EdgeSVG from "./EdgeSVG";
import { buildGraphState } from "@/lib/flowGraph/buildGraphState";
import { PHASES } from "@/lib/flowGraph/phases";
import type { GlassboxState } from "@/types/glassbox";

const NODE_POS: Record<number, { left: number; top: number }> = {
  1: { left: 210, top: 10 },
  2: { left: 210, top: 230 },
  3: { left: 210, top: 450 },
  4: { left: 210, top: 670 },
  5: { left: 210, top: 890 },
  6: { left: 210, top: 1110 },
};

const DIAGRAM_W = 800;
const DIAGRAM_H = 1300;

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
}

export default function MultiAgentFlowGraph({ appState, exitStatus, glassboxState }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.95);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const centered = useRef(false);

  useEffect(() => {
    if (!containerRef.current || centered.current) return;
    centered.current = true;
    const cw = containerRef.current.clientWidth;
    if (cw === 0) return;
    setOffset({ x: (cw - DIAGRAM_W * 0.95) / 2, y: 0 });
  }, []);

  function horizontalFit() {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    if (cw === 0) return;
    const s = Math.min(cw / DIAGRAM_W, 1.0) * 0.95;
    setScale(s);
    setOffset({ x: (cw - DIAGRAM_W * s) / 2, y: 0 });
    el.scrollTop = 0;
  }

  function zoomIn() {
    setScale((s) => Math.min(s + 0.2, 2.5));
  }

  function zoomOut() {
    setScale((s) => Math.max(s - 0.2, 0.25));
  }

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      setScale((s) => Math.max(0.25, Math.min(2.5, s + delta)));
    }
  }, []);

  const { nodeStates, edgeStates } = buildGraphState(glassboxState, appState, exitStatus);

  const phases = PHASES.map((p) => {
    const modelName =
      p.num === 2 ? glassboxState.plannerModel :
      p.num === 3 ? glassboxState.generatorModel :
      p.num === 5 ? glassboxState.judgeModel :
      undefined;

    const iteration =
      p.num === 2 ? glassboxState.strategyIteration :
      p.num === 3 ? Math.max(glassboxState.syntaxHealAttempt, 1) :
      1;

    const duration = glassboxState.phaseDurations?.find((d) => d.phase === p.num)?.durationMs ?? null;
    const status = nodeStates[p.num] ?? "waiting";
    const pos = NODE_POS[p.num];

    return { phase: p, status, iteration, durationMs: duration, modelName, ...pos };
  });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-x-hidden overflow-y-auto select-none"
      onWheel={handleWheel}
    >
      <div
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          width: DIAGRAM_W,
          height: DIAGRAM_H,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <EdgeSVG edgeStates={edgeStates} />
        </div>

        <div style={{ position: "absolute", inset: 0 }}>
          {phases.map((p) => (
            <PhaseCard key={p.phase.num} {...p} />
          ))}
        </div>
      </div>

      <div className="fixed bottom-4 right-4 flex items-center gap-1 z-10">
        <button
          type="button"
          onClick={zoomIn}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-jb-panel/85 border border-jb-border/50 text-jb-text shadow-md backdrop-blur-md hover:bg-jb-panel transition-colors cursor-pointer"
          aria-label="Zoom in"
        >
          <Plus size={15} />
        </button>
        <button
          type="button"
          onClick={zoomOut}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-jb-panel/85 border border-jb-border/50 text-jb-text shadow-md backdrop-blur-md hover:bg-jb-panel transition-colors cursor-pointer"
          aria-label="Zoom out"
        >
          <Minus size={15} />
        </button>
        <button
          type="button"
          onClick={horizontalFit}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-jb-panel/85 border border-jb-border/50 text-jb-text shadow-md backdrop-blur-md hover:bg-jb-panel transition-colors cursor-pointer"
          aria-label="Fit to width"
        >
          <Maximize2 size={14} />
        </button>
      </div>
    </div>
  );
}
