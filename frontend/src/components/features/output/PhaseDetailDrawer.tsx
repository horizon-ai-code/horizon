"use client";

import React from "react";
import { X, Clock, Cpu, CheckCircle2, AlertTriangle, Terminal, Code2, Target } from "lucide-react";
import type { FlowNodeData } from "@/types/flowGraph";

interface Props {
  nodeData: FlowNodeData | null;
  onClose: () => void;
}

export default function PhaseDetailDrawer({ nodeData, onClose }: Props) {
  if (!nodeData) return null;

  const { phase, status, iteration, durationMs, modelName, summary } = nodeData;
  const detail = summary?.detail;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 bg-jb-bg/95 border-l border-jb-border/60 shadow-2xl backdrop-blur-md z-30 flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Drawer Header */}
      <div className="flex items-center justify-between p-4 border-b border-jb-border/50">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-[11px]">
            {phase.num}
          </span>
          <div>
            <h3 className="text-[14px] font-bold text-jb-text leading-tight">{phase.name}</h3>
            <span className="text-[10px] font-mono text-jb-text-muted">{phase.agent}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-jb-text-muted hover:text-jb-text hover:bg-jb-panel transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-chat-scrollbar text-[12px]">
        {/* Status & Overview */}
        <div className="p-3 rounded-lg bg-jb-panel/50 border border-jb-border/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-jb-text-muted font-mono">STATUS</span>
            <span className={`font-bold capitalize ${status === "done_ok" ? "text-emerald-400" : status === "active" ? "text-cyan-400" : status === "done_fail" ? "text-red-400" : "text-jb-text-muted"}`}>
              {status.replace("_", " ")}
            </span>
          </div>
          {modelName && (
            <div className="pt-2 border-t border-jb-border/20 flex items-center gap-1.5 text-jb-text-muted">
              <Cpu size={12} className="text-cyan-400" />
              <span className="font-mono text-[10px] truncate">{modelName}</span>
            </div>
          )}
        </div>

        {/* Baseline Metrics (Node 1 Baseline ONLY) */}
        {phase.num === 1 && (
          <div className="space-y-2">
            {detail?.baselineMetrics && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-jb-text-muted uppercase block">Baseline Analysis</span>
                <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-jb-panel/50 border border-jb-border/40 text-[11px]">
                  {detail.baselineMetrics.cyclomaticComplexity !== undefined && (
                    <div>
                      <span className="text-[10px] text-jb-text-muted font-mono block">CYCLOMATIC COMPLEXITY</span>
                      <span className="font-mono text-cyan-300 font-bold">{detail.baselineMetrics.cyclomaticComplexity}</span>
                    </div>
                  )}
                  {detail.baselineMetrics.linesOfCode !== undefined && (
                    <div>
                      <span className="text-[10px] text-jb-text-muted font-mono block">LINES OF CODE</span>
                      <span className="font-mono text-jb-text font-medium">{detail.baselineMetrics.linesOfCode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="p-3 rounded-lg bg-jb-panel/30 border border-jb-border/20 text-[11px] text-jb-text-muted leading-relaxed">
              Phase 1 performs static analysis on the original input code to establish baseline metrics (Cyclomatic Complexity, Line Count, AST scope anchors) before any refactoring begins.
            </div>
          </div>
        )}

        {/* Strategy Intent & Scope (Node 2 Strategy ONLY) */}
        {phase.num === 2 && detail?.intent && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase flex items-center gap-1">
              <Target size={12} className="text-cyan-400" /> Strategy Intent & Scope
            </span>
            <div className="p-3 rounded-lg bg-jb-panel/50 border border-jb-border/40 space-y-2 text-[11px]">
              {detail.intent.intent && (
                <div>
                  <span className="text-[10px] text-jb-text-muted font-mono block">SPECIFIC INTENT</span>
                  <span className="font-mono text-cyan-300 font-bold">{detail.intent.intent}</span>
                </div>
              )}
              {detail.intent.category && (
                <div>
                  <span className="text-[10px] text-jb-text-muted font-mono block">CATEGORY</span>
                  <span className="font-mono text-jb-text font-medium">{detail.intent.category}</span>
                </div>
              )}
              {(detail.intent.targetClass || detail.intent.targetMember) && (
                <div className="pt-1.5 border-t border-jb-border/30">
                  <span className="text-[10px] text-jb-text-muted font-mono block">TARGET SCOPE</span>
                  <span className="font-mono text-emerald-300 font-semibold">
                    {detail.intent.targetClass ? `${detail.intent.targetClass}#` : ''}{detail.intent.targetMember || 'method'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AST Modification Plan / Mutations (Node 2 Strategy & Node 3 Execution ONLY) */}
        {(phase.num === 2 || phase.num === 3) && detail?.mutations && detail.mutations.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase flex items-center gap-1">
              <Code2 size={12} className="text-teal-400" /> AST Modification Plan
            </span>
            <div className="space-y-1.5">
              {detail.mutations.map((m, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-jb-panel/40 border border-jb-border/30 text-[11px] space-y-1">
                  <div className="font-mono text-teal-300 font-bold flex items-center justify-between">
                    <span>{m.action}</span>
                    <span className="text-[10px] text-jb-text-muted font-normal">on {m.target}</span>
                  </div>
                  {m.description && (
                    <p className="text-jb-text-muted text-[10px] leading-relaxed border-t border-jb-border/20 pt-1">
                      {m.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Checks (Node 4 Validation ONLY) */}
        {phase.num === 4 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-400" /> Validation Checks
            </span>
            {detail?.checks && detail.checks.length > 0 ? (
              <div className="space-y-1.5">
                {detail.checks.map((chk, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-jb-panel/40 border border-jb-border/30 text-[11px] space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-jb-text font-bold">{chk.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold ${chk.passed ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                        {chk.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                    {(chk.before_value !== undefined || chk.after_value !== undefined) && (
                      <div className="text-[10px] font-mono text-cyan-300/80 pt-0.5">
                        Metric: {chk.before_value ?? '—'} &rarr; {chk.after_value ?? '—'}
                      </div>
                    )}
                    {chk.details && (
                      <p className="text-[10px] text-jb-text-muted border-t border-jb-border/20 pt-1 leading-relaxed">
                        {chk.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-jb-panel/30 border border-jb-border/20 text-[11px] text-jb-text-muted">
                Validation checks passed cleanly.
              </div>
            )}
          </div>
        )}

        {/* Judge Audit Verdict & Thinking (Node 5 Adjudication ONLY) */}
        {phase.num === 5 && (
          <div className="p-3 rounded-lg bg-jb-panel/50 border border-jb-border/40 space-y-2.5">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase block">Judge Audit Verdict</span>
            {detail?.judgeVerdict && (
              <div className={`text-[13px] font-bold ${detail.judgeVerdict === "ACCEPT" ? "text-emerald-400" : "text-amber-400"}`}>
                {detail.judgeVerdict}
              </div>
            )}

            {/* Variable Trace Box */}
            {detail?.variableTrace && (detail.variableTrace.original || detail.variableTrace.refactored) && (
              <div className="pt-1.5 border-t border-jb-border/30 space-y-1">
                <span className="text-[10px] font-mono text-jb-text-muted block">VARIABLE TRACE</span>
                <div className="p-2 rounded bg-jb-bg/60 border border-jb-border/30 font-mono text-[10px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-jb-text-muted">Original:</span>
                    <span className="text-amber-300 font-bold">&quot;{detail.variableTrace.original || '—'}&quot;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-jb-text-muted">Refactored:</span>
                    <span className="text-emerald-300 font-bold">&quot;{detail.variableTrace.refactored || '—'}&quot;</span>
                  </div>
                  {detail.variableTrace.mapping && detail.variableTrace.mapping !== "None" && (
                    <div className="flex justify-between">
                      <span className="text-jb-text-muted">Mapping:</span>
                      <span className="text-cyan-300">{detail.variableTrace.mapping}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logic Comparison */}
            {detail?.logicComparison && (
              <div className="pt-1.5 border-t border-jb-border/30">
                <span className="text-[10px] font-mono text-jb-text-muted block">LOGIC COMPARISON</span>
                <p className="text-[11px] text-jb-text leading-relaxed mt-0.5 font-medium">
                  {detail.logicComparison}
                </p>
              </div>
            )}

            {/* Audit Issues */}
            {detail?.judgeIssues && detail.judgeIssues.length > 0 && (
              <ul className="list-disc list-inside text-[10px] text-amber-300/90 pt-1 space-y-0.5 border-t border-jb-border/30">
                {detail.judgeIssues.map((iss, i) => (
                  <li key={i}><span className="font-bold">{iss.issueType}:</span> {iss.description}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Finalization (Node 6 Finalization ONLY) */}
        {phase.num === 6 && (
          <div className="p-3 rounded-lg bg-jb-panel/50 border border-jb-border/40 space-y-2 text-[11px]">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase block">Finalization Status</span>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="font-bold text-emerald-400">Refactoring Session Complete</span>
            </div>
            <p className="text-[10px] text-jb-text-muted leading-relaxed border-t border-jb-border/20 pt-1.5">
              The refactored code has passed all static validation checks and Judge audit verification. Output code and insights are fully synthesized.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
