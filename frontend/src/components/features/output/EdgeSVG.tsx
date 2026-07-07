"use client";

import React from "react";

export interface EdgeDef {
  id: string;
  d: string;
  type: "forward" | "syntax_heal" | "structural_fix" | "strategy" | "abort";
}

const EDGE_PATHS: EdgeDef[] = [
  { id: "e1-2",       d: "M290,170 L290,230",                        type: "forward" },
  { id: "e2-3",       d: "M290,390 L290,450",                        type: "forward" },
  { id: "e3-4",       d: "M290,610 L290,670",                        type: "forward" },
  { id: "e4-5",       d: "M290,830 L290,890",                        type: "forward" },
  { id: "e5-6",       d: "M290,1050 L290,1110",                      type: "forward" },

  { id: "e2-2-retry", d: "M210,280 C60,255 60,365 210,340",         type: "strategy" },
  { id: "e3-3-heal",  d: "M370,500 C540,475 540,585 370,560",       type: "syntax_heal" },

  { id: "e3-2-revise", d: "M210,500 L70,500 L70,280 L210,280",       type: "strategy" },
  { id: "e4-2-revise", d: "M210,750 L50,750 L50,340 L210,340",       type: "strategy" },

  { id: "e3-6-abort",  d: "M210,560 L30,560 L30,1190 L210,1190",     type: "abort" },

  { id: "e5-2-revise", d: "M370,970 L530,970 L530,310 L370,310",     type: "strategy" },
  { id: "e4-3-fix",    d: "M370,750 L560,750 L560,530 L370,530",     type: "structural_fix" },
];

const TYPE_COLORS: Record<string, string> = {
  forward:        "#22c55e",
  syntax_heal:    "#eab308",
  structural_fix: "#f97316",
  strategy:       "#3b82f6",
  abort:          "#ef4444",
};

function edgeStyle(type: string, status: string): React.SVGAttributes<SVGPathElement> {
  const color = TYPE_COLORS[type] ?? "#555";

  if (status === "dimmed") {
    return {
      stroke: color,
      strokeWidth: 2,
      opacity: 0.3,
      fill: "none",
      strokeDasharray: type !== "forward" ? "4 4" : undefined,
    };
  }

  if (status === "done") {
    const dash = type !== "forward" ? "6 3" : undefined;
    return {
      stroke: color,
      strokeWidth: 3,
      opacity: 0.8,
      fill: "none",
      strokeDasharray: dash,
    };
  }

  const dash = type !== "forward" ? "6 3" : undefined;
  return {
    stroke: color,
    strokeWidth: type === "forward" ? 4 : 3.5,
    opacity: 1,
    fill: "none",
    strokeDasharray: dash,
    className: dash ? "edge-animated" : undefined,
  };
}

const EDGE_LABELS: { id: string; x: number; y: number; text: string }[] = [
  { id: "e2-2-retry",  x: 60,  y: 310,  text: "Retry" },
  { id: "e3-3-heal",   x: 550, y: 530,  text: "Heal" },
  { id: "e3-2-revise", x: 80,  y: 390,  text: "Revise" },
  { id: "e4-2-revise", x: 60,  y: 545,  text: "Revise" },
  { id: "e3-6-abort",  x: 40,  y: 875,  text: "Abort" },
  { id: "e5-2-revise", x: 500, y: 640,  text: "Revise" },
  { id: "e4-3-fix",    x: 580, y: 640,  text: "Fix" },
];

interface Props {
  edgeStates: Record<string, string>;
}

export default function EdgeSVG({ edgeStates }: Props) {
  return (
    <>
      <svg
        className="absolute inset-0 pointer-events-none"
        width={800}
        height={1300}
        viewBox="0 0 800 1300"
        style={{ overflow: "visible" }}
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#4ec97e" />
          </marker>
          <marker id="arrow-dim" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#393b40" />
          </marker>
        </defs>

        <style>{`
          .edge-animated {
            animation: edge-flow 0.8s linear infinite;
          }
          @keyframes edge-flow {
            0%   { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -18; }
          }
        `}</style>

        {EDGE_PATHS.map((ep) => {
          const status = edgeStates[ep.id] ?? "dimmed";
          const style = edgeStyle(ep.type, status);
          return <path key={ep.id} d={ep.d} {...style} />;
        })}

        {EDGE_LABELS.map((label) => {
          const status = edgeStates[label.id] ?? "dimmed";
          const edge = EDGE_PATHS.find((p) => p.id === label.id);
          const color = edge ? TYPE_COLORS[edge.type] ?? "#555" : "#555";
          const opacity = status === "dimmed" ? 0.5 : status === "done" ? 0.95 : 1;

          return (
            <text
              key={label.id}
              x={label.x}
              y={label.y}
              fill={color}
              opacity={opacity}
              fontSize="11"
              fontFamily="ui-monospace, monospace"
              fontWeight="700"
              textAnchor="middle"
            >
              {label.text}
            </text>
          );
        })}
      </svg>
    </>
  );
}
