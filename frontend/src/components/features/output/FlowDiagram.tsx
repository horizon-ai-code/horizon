"use client";

import React from "react";
import type { GlassboxState } from "@/types/glassbox";
import type { NodeStatus } from "@/types/flowGraph";
import { PHASES } from "@/lib/flowGraph/phases";

// ── Layout ──

const NX = 200, NY = 90;
const GX = 280, GY = 190;
const PAD = 40;

const NODES = PHASES.map((p, i) => {
  const col = i % 3;
  const row = Math.floor(i / 3);
  return {
    ...p,
    x: PAD + col * GX,
    y: PAD + row * GY,
  };
});

const SVG_W = PAD + 2 * GX + NX + PAD;
const SVG_H = PAD + GY + NY + PAD;

function cx(p: number) { return NODES[p - 1].x + NX / 2; }
function cy(p: number) { return NODES[p - 1].y + NY / 2; }
function lx(p: number) { return NODES[p - 1].x; }
function rx(p: number) { return NODES[p - 1].x + NX; }
function ty(p: number) { return NODES[p - 1].y; }
function by(p: number) { return NODES[p - 1].y + NY; }

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
          <marker id="ar-fwd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4ec97e" />
          </marker>
          <marker id="ar-heal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#e09c3b" />
          </marker>
          <marker id="ar-rev" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#56a8f5" />
          </marker>
          <marker id="ar-abt" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#f93e3e" />
          </marker>
          <marker id="ar-dim" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
          </marker>
        </defs>

        {/* ── Edges ── */}
        <Edge1 key="e1-2" a={{ x: rx(1), y: cy(1) }} b={{ x: lx(2), y: cy(2) }}
          status={isDone ? (currentPhase > 1 ? "done" : "dimmed") : currentPhase > 1 ? "done" : currentPhase >= 2 ? "active" : "dimmed"}
        />
        <Edge1 key="e2-3" a={{ x: rx(2), y: cy(2) }} b={{ x: lx(3), y: cy(3) }}
          status={isDone ? (currentPhase > 2 ? "done" : "dimmed") : currentPhase > 2 ? "done" : currentPhase >= 3 ? "active" : "dimmed"}
        />
        <Edge1 key="e4-5" a={{ x: rx(4), y: cy(4) }} b={{ x: lx(5), y: cy(5) }}
          status={isDone ? (currentPhase > 4 ? "done" : "dimmed") : currentPhase > 4 ? "done" : currentPhase >= 5 ? "active" : "dimmed"}
        />
        <Edge1 key="e5-6" a={{ x: rx(5), y: cy(5) }} b={{ x: lx(6), y: cy(6) }}
          status={isDone ? (currentPhase > 5 ? "done" : "dimmed") : currentPhase > 5 ? "done" : currentPhase >= 6 ? "active" : "dimmed"}
        />
        <Edge1 key="e3-4"
          a={{ x: cx(3), y: by(3) }}
          b={{ x: cx(4), y: ty(4) }}
          status={isDone ? (currentPhase > 3 ? "done" : "dimmed") : currentPhase > 3 ? "done" : currentPhase >= 4 ? "active" : "dimmed"}
        />
        <SelfLoop key="e3-heal" num={3} offset={0} label="Heal" type="syntax"
          active={!isDone && syntaxHealAttempt > 0 && currentPhase === 3}
          done={isDone && currentPhase > 3}
        />
        <SelfLoop key="e3-fallback" num={3} offset={18} label="Seq→Shot" type="syntax"
          active={false}
          done={false}
        />
        <BackEdge key="e4-3" from={4} to={3} label="Fix" type="fix"
          active={!isDone && validationFaultCount !== null && validationFaultCount > 0 && currentPhase === 3}
          done={isDone && currentPhase > 3}
        />

        {/* Strategy revision → P2 */}
        <ReviseEdge
          from={3} to={2} label="Syntax exhausted"
          active={!isDone && strategyIteration > 1 && currentPhase === 2}
          done={isDone && strategyIteration > 1}
        />
        <ReviseEdge
          from={4} to={2} label="Validation exhausted"
          active={!isDone && strategyIteration > 1 && currentPhase === 2}
          done={isDone && strategyIteration > 1}
        />
        <ReviseEdge
          from={5} to={2} label="REVISE"
          active={!isDone && strategyIteration > 1 && currentPhase === 2}
          done={isDone && strategyIteration > 1}
        />

        {/* Abort → P6 */}
        <AbortEdge
          from={3} label="Abort"
          active={isAbort}
        />
        <AbortEdge
          from={5} label="Abort"
          active={isAbort}
        />

        {/* ── Nodes ── */}
        {NODES.map((n, i) => {
          const pn = i + 1;
          const status = ns(pn);
          const dur = phaseDurations.find(d => d.phase === pn);

          let fill = "#1e1f22";
          let stroke = "#393b40";
          let sw = 1.5;
          let textFill = "#fff";
          let subFill = "#888";

          if (status === "active") {
            fill = "#2b2d30";
            stroke = n.color;
            sw = 2.5;
          } else if (status === "done_ok") {
            stroke = "#27c93f";
            sw = 2.5;
          } else if (status === "done_fail") {
            stroke = "#f93e3e";
            sw = 2.5;
          } else if (status === "waiting") {
            textFill = "#888";
            subFill = "#555";
          } else if (status === "skipped") {
            textFill = "#555";
            subFill = "#444";
            stroke = "#2b2d30";
          }

          const iteration = pn === 2 ? strategyIteration : pn === 3 ? Math.max(syntaxHealAttempt, 1) : 1;
          const modelName = pn === 2 ? plannerModel : pn === 3 ? generatorModel : pn === 5 ? judgeModel : undefined;

          return (
            <g key={n.num} className={status === "active" ? "flow-node-active" : undefined}>
              {status === "active" && (
                <rect x={n.x} y={n.y} width={NX} height={NY} rx={8} fill={n.color} opacity={0.08}>
                  <animate attributeName="opacity" values="0.08;0.18;0.08" dur="1.5s" repeatCount="indefinite" />
                </rect>
              )}
              <rect x={n.x} y={n.y} width={NX} height={NY} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />

              <text x={n.x + 10} y={n.y + 16} fontSize="9" fill={subFill} fontWeight="bold">P{pn}</text>
              <text x={n.x + 36} y={n.y + 38} fontSize="13" fill={textFill} fontWeight="bold">{n.name}</text>
              <text x={n.x + 36} y={n.y + 56} fontSize="10" fill={subFill}>{n.agent}</text>

              {modelName && (
                <text x={n.x + 36} y={n.y + 70} fontSize="8" fill={subFill} opacity={0.6}>{modelName}</text>
              )}

              <circle cx={n.x + 18} cy={n.y + 33} r={7} fill={n.color} />

              {iteration > 1 && status !== "waiting" && status !== "skipped" && (
                <g>
                  <rect x={rx(n.num) - 32} y={ty(n.num) - 8} width={24} height={14} rx={7} fill="#f4bf4f" opacity={0.15} />
                  <text x={rx(n.num) - 20} y={n.y + 5} fontSize="9" fill="#f4bf4f" fontWeight="bold" textAnchor="middle">{iteration}</text>
                </g>
              )}

              {dur != null && (
                <g>
                  <rect x={n.x + 4} y={by(n.num) - 16} width={36} height={12} rx={4} fill="#393b40" />
                  <text x={n.x + 22} y={by(n.num) - 7} fontSize="8" fill="#888" textAnchor="middle">{(dur.durationMs / 1000).toFixed(1)}s</text>
                </g>
              )}
            </g>
          );
        })}

        {/* ── Exit status badge ── */}
        {isDone && exitStatus && (
          <g>
            <rect x={cx(6) - 40} y={by(6) + 14} width={80} height={22} rx={6}
              fill={exitStatus === "SUCCESS" ? "#27c93f" : "#f93e3e"} opacity={0.12} />
            <text x={cx(6)} y={by(6) + 29} fontSize="11" fontWeight="bold"
              fill={exitStatus === "SUCCESS" ? "#27c93f" : "#f93e3e"} textAnchor="middle">
              {exitStatus}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Edge types ──

function Edge1({ a, b, status }: {
  a: { x: number; y: number };
  b: { x: number; y: number };
  status: "dimmed" | "active" | "done";
}) {
  const dx = b.x - a.x;
  const cp = Math.abs(dx) * 0.45;
  const d = `M ${a.x} ${a.y} C ${a.x + cp} ${a.y}, ${b.x - cp} ${b.y}, ${b.x} ${b.y}`;
  const c = status === "dimmed" ? "#555" : "#4ec97e";
  const op = status === "dimmed" ? 0.15 : status === "active" ? 1 : 0.5;
  const marker = status === "dimmed" ? "url(#ar-dim)" : "url(#ar-fwd)";
  return <path d={d} fill="none" stroke={c} strokeWidth={status === "active" ? 3 : 2} opacity={op} markerEnd={marker} />;
}

function SelfLoop({ num, offset, label, type, active, done }: {
  num: number; offset: number; label: string; type: string;
  active: boolean; done: boolean;
}) {
  const n = NODES[num - 1];
  const left = n.x + 40 + offset;
  const right = n.x + NX - 40 + offset;
  const top = n.y - 14;
  const d = `M ${left} ${n.y} C ${left} ${top}, ${right} ${top}, ${right} ${n.y}`;
  const status = done ? "done" : active ? "active" : "dimmed";
  const c = status === "dimmed" ? "#555" : "#e09c3b";
  const op = status === "dimmed" ? 0.15 : status === "active" ? 1 : 0.5;
  const marker = status === "dimmed" ? "url(#ar-dim)" : "url(#ar-heal)";
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={active ? 2 : 1.5} opacity={op}
        strokeDasharray={status !== "dimmed" ? "4 3" : "3 3"} markerEnd={marker} />
      <text x={(left + right) / 2} y={top - 2} fontSize="7" fill={c} opacity={op} textAnchor="middle">{label}</text>
    </g>
  );
}

function BackEdge({ from, to, label, type, active, done }: {
  from: number; to: number; label: string; type: string;
  active: boolean; done: boolean;
}) {
  const fx = cx(from), fy = ty(from);
  const tx = cx(to), tby = by(to);
  const midY = (fy + tby) / 2;
  const d = `M ${fx} ${fy} C ${fx} ${midY}, ${tx} ${midY}, ${tx} ${tby}`;
  const status = done ? "done" : active ? "active" : "dimmed";
  const c = status === "dimmed" ? "#555" : "#e09c3b";
  const op = status === "dimmed" ? 0.15 : status === "active" ? 1 : 0.5;
  const marker = status === "dimmed" ? "url(#ar-dim)" : "url(#ar-heal)";
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={active ? 2 : 1.5} opacity={op}
        strokeDasharray={status !== "dimmed" ? "4 3" : "3 3"} markerEnd={marker} />
      <text x={(fx + tx) / 2} y={midY - 4} fontSize="7" fill={c} opacity={op} textAnchor="middle">{label}</text>
    </g>
  );
}

function ReviseEdge({ from, to, label, active, done }: {
  from: number; to: number; label: string;
  active: boolean; done: boolean;
}) {
  const fx = lx(from), fy = cy(from);
  const tx = lx(to) - 10, tby = ty(to) + 10;
  const midX = Math.min(fx, tx) - 50;
  const midY = (fy + tby) / 2;
  const d = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${tby}, ${tx} ${tby}`;
  const status = done ? "done" : active ? "active" : "dimmed";
  const c = status === "dimmed" ? "#555" : "#56a8f5";
  const op = status === "dimmed" ? 0.15 : status === "active" ? 1 : 0.5;
  const marker = status === "dimmed" ? "url(#ar-dim)" : "url(#ar-rev)";
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={active ? 2 : 1.5} opacity={op}
        strokeDasharray={status !== "dimmed" ? "4 4" : "3 4"} markerEnd={marker} />
      <text x={midX} y={midY - 4} fontSize="7" fill={c} opacity={op} textAnchor="middle">{label}</text>
    </g>
  );
}

function AbortEdge({ from, label, active }: {
  from: number; label: string;
  active: boolean;
}) {
  const fx = rx(from), fy = cy(from);
  const tx = rx(6) + 20, ty6 = ty(6) + 10;
  const midX = Math.max(fx, tx) + 30;
  const midY = (fy + ty6) / 2;
  const d = `M ${fx} ${fy} C ${midX} ${fy}, ${midX} ${ty6}, ${tx} ${ty6}`;
  const status = active ? "active" : "dimmed";
  const c = status === "dimmed" ? "#555" : "#f93e3e";
  const op = status === "dimmed" ? 0.15 : 0.7;
  const marker = status === "dimmed" ? "url(#ar-dim)" : "url(#ar-abt)";
  return (
    <g>
      <path d={d} fill="none" stroke={c} strokeWidth={active ? 2 : 1.5} opacity={op} markerEnd={marker} />
      {active && (
        <text x={midX} y={midY - 4} fontSize="7" fill={c} textAnchor="middle">{label}</text>
      )}
    </g>
  );
}
