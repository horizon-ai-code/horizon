"use client";

import React from "react";
import type { GlassboxState } from "@/types/glassbox";
import type { NodeStatus } from "@/types/flowGraph";
import { PHASES } from "@/lib/flowGraph/phases";

// ── Layout ──

const NX = 300, NY = 150;
const GX = 420, GY = 270;
const PAD = 60;

const NODES = PHASES.map((p, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return { ...p, x: PAD + col * GX, y: PAD + row * GY };
});

const SVG_W = PAD + 2 * GX + NX + PAD;
const SVG_H = PAD + GY + NY + PAD;

function cx(p: number) { return NODES[p - 1].x + NX / 2; }
function cy(p: number) { return NODES[p - 1].y + NY / 2; }
function lx(p: number) { return NODES[p - 1].x; }
function rx(p: number) { return NODES[p - 1].x + NX; }
function ty(p: number) { return NODES[p - 1].y; }
function by(p: number) { return NODES[p - 1].y + NY; }

// ── Icon SVG paths (from lucide-react) ──

const ICONS: Record<string, React.ReactNode> = {
  Layers: (
    <g>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </g>
  ),
  Cpu: (
    <g>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </g>
  ),
  Zap: (
    <g>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </g>
  ),
  FileCode2: (
    <g>
      <path d="M4 22h14a2 2 0 002-2V7l-5-5H6a2 2 0 00-2 2v4" />
      <path d="M14 2v4a2 2 0 002 2h4" />
      <path d="m5 12-3 3 3 3" />
      <path d="m9 18 3-3-3-3" />
    </g>
  ),
  CheckCircle2: (
    <g>
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 12 2 2 4-4" />
    </g>
  ),
  Clock: (
    <g>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </g>
  ),
};

// ── Props ──

interface Props {
  appState: string;
  exitStatus?: string;
  glassboxState: GlassboxState;
}

export default function FlowDiagram({ appState, exitStatus, glassboxState }: Props) {
  const {
    currentPhase, strategyIteration, syntaxHealAttempt, phaseDurations,
    validationFaultCount, plannerModel, generatorModel, judgeModel,
  } = glassboxState;

  const isDone = appState === "done";
  const isSuccess = exitStatus === "SUCCESS";
  const isAbort = isDone && !isSuccess && !!exitStatus && exitStatus !== "PROCESSING";

  function ns(num: number): NodeStatus {
    if (isDone) {
      if (num === 6) return isAbort ? "done_fail" : "done_ok";
      if (num < currentPhase || (num === currentPhase && isSuccess)) return "done_ok";
      if (num === currentPhase) return "done_fail";
      return "skipped";
    }
    if (num < currentPhase) return "done_ok";
    if (num === currentPhase) return "active";
    return "waiting";
  }

  return (
    <div className="flex items-center justify-center w-full h-full overflow-auto">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}>
        <defs>
          <marker id="arFwd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ec97e" />
          </marker>
          <marker id="arHeal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#e09c3b" />
          </marker>
          <marker id="arRev" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#56a8f5" />
          </marker>
          <marker id="arAbt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f93e3e" />
          </marker>
          <marker id="arDim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
          </marker>
        </defs>

        {/* Edges */}
        <Edge1 key="e1-2" a={{ x: rx(1), y: cy(1) }} b={{ x: lx(2), y: cy(2) }}
          s={isDone ? (currentPhase > 1 ? "done" : "dimmed") : currentPhase > 1 ? "done" : currentPhase >= 2 ? "active" : "dimmed"}
        />
        <Edge1 key="e2-3" a={{ x: rx(2), y: cy(2) }} b={{ x: lx(3), y: cy(3) }}
          s={isDone ? (currentPhase > 2 ? "done" : "dimmed") : currentPhase > 2 ? "done" : currentPhase >= 3 ? "active" : "dimmed"}
        />
        <Edge1 key="e4-5" a={{ x: rx(4), y: cy(4) }} b={{ x: lx(5), y: cy(5) }}
          s={isDone ? (currentPhase > 4 ? "done" : "dimmed") : currentPhase > 4 ? "done" : currentPhase >= 5 ? "active" : "dimmed"}
        />
        <Edge1 key="e5-6" a={{ x: rx(5), y: cy(5) }} b={{ x: lx(6), y: cy(6) }}
          s={isDone ? (currentPhase > 5 ? "done" : "dimmed") : currentPhase > 5 ? "done" : currentPhase >= 6 ? "active" : "dimmed"}
        />
        <Edge1 key="e3-4" a={{ x: cx(3), y: by(3) }} b={{ x: cx(4), y: ty(4) }}
          s={isDone ? (currentPhase > 3 ? "done" : "dimmed") : currentPhase > 3 ? "done" : currentPhase >= 4 ? "active" : "dimmed"}
        />

        <SelfLoop key="e3-heal" num={3} off={0} label="Heal"
          act={!isDone && syntaxHealAttempt > 0 && currentPhase === 3}
          dn={isDone && currentPhase > 3}
        />
        <SelfLoop key="e3-fallback" num={3} off={24} label="Seq→Shot" act={false} dn={false} />

        <BackEdge key="e4-3" from={4} to={3} label="Fix"
          act={!isDone && validationFaultCount !== null && validationFaultCount > 0 && currentPhase === 3}
          dn={isDone && currentPhase > 3}
        />

        <ReviseEdge key="e3-2" from={3} to={2} label="Syntax exhausted"
          act={!isDone && strategyIteration > 1 && currentPhase === 2}
          dn={isDone && strategyIteration > 1}
        />
        <ReviseEdge key="e4-2" from={4} to={2} label="Validation exhausted"
          act={!isDone && strategyIteration > 1 && currentPhase === 2}
          dn={isDone && strategyIteration > 1}
        />
        <ReviseEdge key="e5-2" from={5} to={2} label="REVISE"
          act={!isDone && strategyIteration > 1 && currentPhase === 2}
          dn={isDone && strategyIteration > 1}
        />

        <AbortEdge key="e3-6" from={3} act={isAbort} />
        <AbortEdge key="e5-6" from={5} act={isAbort} />

        {/* Nodes */}
        {NODES.map((n, i) => {
          const pn = i + 1;
          const status = ns(pn);
          const dur = phaseDurations.find(d => d.phase === pn);

          let fill = "#1e1f22", stroke = "#393b40", sw = 1.5, textFill = "#fff", subFill = "#888";
          if (status === "active") {
            fill = "#2b2d30"; stroke = n.color; sw = 3;
          } else if (status === "done_ok") { stroke = "#27c93f"; sw = 3;
          } else if (status === "done_fail") { stroke = "#f93e3e"; sw = 3;
          } else if (status === "waiting") { textFill = "#888"; subFill = "#555";
          } else if (status === "skipped") { textFill = "#555"; subFill = "#444"; stroke = "#2b2d30"; }

          const iteration = pn === 2 ? strategyIteration : pn === 3 ? Math.max(syntaxHealAttempt, 1) : 1;
          const modelName = pn === 2 ? plannerModel : pn === 3 ? generatorModel : pn === 5 ? judgeModel : undefined;
          const iconEl = ICONS[n.icon];

          return (
            <g key={n.num}>
              {status === "active" && (
                <rect x={n.x} y={n.y} width={NX} height={NY} rx={10} fill={n.color} opacity={0.08}>
                  <animate attributeName="opacity" values="0.08;0.2;0.08" dur="1.5s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={n.x} y={n.y} width={NX} height={NY} rx={10} fill={fill} stroke={stroke} strokeWidth={sw} />

              <g transform={`translate(${n.x + 18}, ${n.y + 22}) scale(1.3)`}>
                {iconEl}
              </g>

              <text x={n.x + 54} y={n.y + 32} fontSize="15" fill={textFill} fontWeight="bold">{n.name}</text>
              <text x={n.x + 54} y={n.y + 52} fontSize="12" fill={subFill}>{n.agent}</text>
              <text x={n.x + 54} y={n.y + 14} fontSize="10" fill={subFill} fontWeight="bold" opacity={0.6}>P{n.num}</text>

              {modelName && (
                <text x={n.x + 54} y={n.y + 70} fontSize="10" fill={subFill} opacity={0.6}>{modelName}</text>
              )}

              {iteration > 1 && status !== "waiting" && status !== "skipped" && (
                <g>
                  <rect x={rx(n.num) - 38} y={ty(n.num) - 10} width={30} height={18} rx={9} fill="#f4bf4f" opacity={0.15} />
                  <text x={rx(n.num) - 23} y={ty(n.num) + 5} fontSize="11" fill="#f4bf4f" fontWeight="bold" textAnchor="middle">{iteration}</text>
                </g>
              )}

              {dur != null && (
                <g>
                  <rect x={n.x + 6} y={by(n.num) - 22} width={44} height={16} rx={4} fill="#393b40" />
                  <text x={n.x + 28} y={by(n.num) - 10} fontSize="10" fill="#888" textAnchor="middle">{(dur.durationMs / 1000).toFixed(1)}s</text>
                </g>
              )}
            </g>
          );
        })}

        {isDone && exitStatus && (
          <g>
            <rect x={cx(6) - 50} y={by(6) + 16} width={100} height={28} rx={8}
              fill={exitStatus === "SUCCESS" ? "#27c93f" : "#f93e3e"} opacity={0.12} />
            <text x={cx(6)} y={by(6) + 35} fontSize="13" fontWeight="bold"
              fill={exitStatus === "SUCCESS" ? "#27c93f" : "#f93e3e"} textAnchor="middle">{exitStatus}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Edge sub-components ──

function Edge1({ a, b, s }: { a: { x: number; y: number }; b: { x: number; y: number }; s: "dimmed" | "active" | "done" }) {
  const dx = b.x - a.x;
  const cp = Math.abs(dx) * 0.45;
  const d = `M ${a.x} ${a.y} C ${a.x + cp} ${a.y}, ${b.x - cp} ${b.y}, ${b.x} ${b.y}`;
  const c = s === "dimmed" ? "#555" : "#4ec97e";
  const op = s === "dimmed" ? 0.15 : s === "active" ? 1 : 0.5;
  return <path d={d} fill="none" stroke={c} strokeWidth={s === "active" ? 3.5 : 2.5} opacity={op} markerEnd={s === "dimmed" ? "url(#arDim)" : "url(#arFwd)"} />;
}

function SelfLoop({ num, off, label, act, dn }: { num: number; off: number; label: string; act: boolean; dn: boolean }) {
  const n = NODES[num - 1];
  const left = n.x + 50 + off, right = n.x + NX - 50 + off, top = n.y - 18;
  const d = `M ${left} ${n.y} C ${left} ${top}, ${right} ${top}, ${right} ${n.y}`;
  const s = dn ? "done" : act ? "active" : "dimmed";
  const c = s === "dimmed" ? "#555" : "#e09c3b";
  const op = s === "dimmed" ? 0.15 : s === "active" ? 1 : 0.5;
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={act ? 2.5 : 2} opacity={op} strokeDasharray={s !== "dimmed" ? "5 4" : "4 4"} markerEnd={s === "dimmed" ? "url(#arDim)" : "url(#arHeal)"} />
      <text x={(left + right) / 2} y={top - 4} fontSize="8" fill={c} opacity={op} textAnchor="middle">{label}</text>
    </g>
  );
}

function BackEdge({ from, to, label, act, dn }: { from: number; to: number; label: string; act: boolean; dn: boolean }) {
  const fx = cx(from), fy = ty(from);
  const tx = cx(to), tby = by(to);
  const midY = (fy + tby) / 2;
  const d = `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${tby}`;
  const s = dn ? "done" : act ? "active" : "dimmed";
  const c = s === "dimmed" ? "#555" : "#e09c3b";
  const op = s === "dimmed" ? 0.15 : s === "active" ? 1 : 0.5;
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={act ? 2.5 : 2} opacity={op} strokeDasharray={s !== "dimmed" ? "5 4" : "4 4"} markerEnd={s === "dimmed" ? "url(#arDim)" : "url(#arHeal)"} />
      <text x={(fx + tx) / 2} y={midY - 6} fontSize="8" fill={c} opacity={op} textAnchor="middle">{label}</text>
    </g>
  );
}

function ReviseEdge({ from, to, label, act, dn }: { from: number; to: number; label: string; act: boolean; dn: boolean }) {
  const fx = lx(from), fy = cy(from);
  const tx = lx(to) - 10, tby = ty(to) + 10;
  const midX = Math.min(fx, tx) - 60;
  const midY = (fy + tby) / 2;
  const d = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${tby}, ${tx} ${tby}`;
  const s = dn ? "done" : act ? "active" : "dimmed";
  const c = s === "dimmed" ? "#555" : "#56a8f5";
  const op = s === "dimmed" ? 0.15 : s === "active" ? 1 : 0.5;
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={act ? 2.5 : 2} opacity={op} strokeDasharray={s !== "dimmed" ? "5 5" : "4 5"} markerEnd={s === "dimmed" ? "url(#arDim)" : "url(#arRev)"} />
      <text x={midX} y={midY - 6} fontSize="8" fill={c} opacity={op} textAnchor="middle">{label}</text>
    </g>
  );
}

function AbortEdge({ from, act }: { from: number; act: boolean }) {
  const fx = rx(from) + 10, fy = cy(from);
  const tx = rx(6) + 30, ty6 = ty(6) + 10;
  const midX = Math.max(fx, tx) + 40;
  const midY = (fy + ty6) / 2;
  const d = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty6}, ${tx} ${ty6}`;
  const s = act ? "active" : "dimmed";
  const c = s === "dimmed" ? "#555" : "#f93e3e";
  const op = s === "dimmed" ? 0.15 : 0.7;
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={act ? 2.5 : 2} opacity={op} markerEnd={s === "dimmed" ? "url(#arDim)" : "url(#arAbt)"} />
      {act && <text x={midX} y={midY - 6} fontSize="8" fill={c} textAnchor="middle">Abort</text>}
    </g>
  );
}
