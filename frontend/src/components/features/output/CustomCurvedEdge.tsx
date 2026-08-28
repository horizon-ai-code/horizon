"use client";

import React from "react";
import { getBezierPath, type EdgeProps, type Edge } from "@xyflow/react";
import type { FlowEdgeData } from "@/types/flowGraph";

export default function CustomCurvedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<Edge<FlowEdgeData>>) {
  const edgeType = data?.edgeType || "forward";
  const status = data?.status || "dimmed";
  const animatedParticle = data?.animatedParticle || false;
  const label = data?.label;

  let edgePath = "";
  let labelX = (sourceX + targetX) / 2;
  let labelY = (sourceY + targetY) / 2;

  // Custom path calculations tailored for L-Shaped Layout with explicit Edge ID discrimination
  if (id === "e4-5" || id === "e5-6") {
    // Pure straight vertical line for P4 -> P5 and P5 -> P6
    edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    labelX = sourceX + 30;
    labelY = (sourceY + targetY) / 2;
  } else if (id === "e4-3-heal" || id === "e4-2-revise") {
    // Bottom U-shaped arc for Inner Loop Heal (P4 -> P3) or Validator Strategy Revision (P4 -> P2)
    const offset = id === "e4-3-heal" ? 55 : 95;
    const controlY = Math.max(sourceY, targetY) + offset;
    edgePath = `M ${sourceX} ${sourceY} C ${sourceX} ${controlY}, ${targetX} ${controlY}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = controlY - 12;
  } else if (id === "e5-2-revise") {
    // Judge Strategy Revision curve from P5 left handle to P2 bottom handle
    const controlX = targetX;
    const controlY = sourceY;
    edgePath = `M ${sourceX} ${sourceY} C ${controlX} ${sourceY}, ${targetX} ${controlY}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2;
    labelY = (sourceY + targetY) / 2 + 10;
  } else if (id === "e2-6-abort") {
    // Abort curve from P2 bottom handle to P6 left handle
    const controlX = targetX - 40;
    const controlY = sourceY + 120;
    edgePath = `M ${sourceX} ${sourceY} C ${sourceX} ${controlY}, ${controlX} ${targetY}, ${targetX} ${targetY}`;
    labelX = (sourceX + targetX) / 2 - 30;
    labelY = (sourceY + targetY) / 2;
  } else {
    // Standard Bezier path for horizontal forward pipeline (P1 -> P2 -> P3 -> P4)
    const [bPath, lx, ly] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      curvature: 0.2,
    });
    edgePath = bPath;
    labelX = lx;
    labelY = ly;
  }

  const isReroutingActiveOrDone = status === "active" || status === "done";

  // Dynamic edge styling: Grayed out (#333742 at 30% opacity) when rerouting has not occurred
  const edgeStyles: Record<string, { stroke: string; strokeWidth: number; strokeDasharray?: string; opacity: number }> = {
    forward: {
      stroke: status === "active" ? "#22d3ee" : status === "done" ? "#10b981" : "#2a2e3d",
      strokeWidth: status === "active" ? 2.5 : status === "done" ? 2 : 1.5,
      opacity: status === "dimmed" ? 0.4 : 1,
    },
    syntax_heal: {
      stroke: isReroutingActiveOrDone ? "#fbbf24" : "#333742",
      strokeWidth: isReroutingActiveOrDone ? 2.5 : 1.5,
      strokeDasharray: "5,5",
      opacity: isReroutingActiveOrDone ? 1 : 0.3,
    },
    strategy: {
      stroke: isReroutingActiveOrDone ? "#60a5fa" : "#333742",
      strokeWidth: isReroutingActiveOrDone ? 2.5 : 1.5,
      strokeDasharray: "5,5",
      opacity: isReroutingActiveOrDone ? 1 : 0.3,
    },
    abort: {
      stroke: isReroutingActiveOrDone ? "#f87171" : "#333742",
      strokeWidth: isReroutingActiveOrDone ? 2.5 : 1.5,
      strokeDasharray: "4,4",
      opacity: isReroutingActiveOrDone ? 1 : 0.25,
    },
  };

  const style = edgeStyles[edgeType] || edgeStyles.forward;

  return (
    <>
      <style>{`
        @keyframes dash-flow {
          to {
            stroke-dashoffset: -20;
          }
        }
      `}</style>

      {/* Main Path Line */}
      <path
        id={id}
        className="react-flow__edge-path transition-all duration-500 ease-in-out"
        d={edgePath}
        style={{
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          strokeDasharray: style.strokeDasharray,
          opacity: style.opacity,
          animation: status === "active" ? "dash-flow 1.2s linear infinite" : undefined,
        }}
      />

      {/* Traveling Directional Arrows along active/traversed paths */}
      {(animatedParticle || isReroutingActiveOrDone) && (
        <g fill={style.stroke} opacity={style.opacity}>
          <polygon points="-6,-5 6,0 -6,5" className="shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            <animateMotion dur="2.4s" repeatCount="indefinite" path={edgePath} rotate="auto" />
          </polygon>
          <polygon points="-6,-5 6,0 -6,5" className="shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            <animateMotion dur="2.4s" begin="0.8s" repeatCount="indefinite" path={edgePath} rotate="auto" />
          </polygon>
          <polygon points="-6,-5 6,0 -6,5" className="shadow-[0_0_8px_rgba(34,211,238,0.8)]">
            <animateMotion dur="2.4s" begin="1.6s" repeatCount="indefinite" path={edgePath} rotate="auto" />
          </polygon>
        </g>
      )}

      {/* Route Label - ONLY displayed when rerouting actually happens */}
      {label && isReroutingActiveOrDone && (
        <g transform={`translate(${labelX}, ${labelY})`} className="animate-in fade-in duration-300">
          <rect
            x="-60"
            y="-10"
            width="120"
            height="20"
            rx="5"
            fill="#0b0e14"
            stroke={style.stroke}
            strokeWidth="1"
            className="shadow-lg backdrop-blur-md opacity-95"
          />
          <text
            x="0"
            y="3"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="9 font-mono"
            fontWeight="bold"
          >
            {label}
          </text>
        </g>
      )}
    </>
  );
}
