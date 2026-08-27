"use client";

import React from "react";
import { X, Clock, Cpu, CheckCircle2, AlertTriangle, Terminal, Code2 } from "lucide-react";
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
        {/* Status & Timing Overview */}
        <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-jb-panel/50 border border-jb-border/30">
          <div>
            <span className="text-[10px] text-jb-text-muted font-mono block">STATUS</span>
            <span className={`font-bold capitalize ${status === "done_ok" ? "text-emerald-400" : status === "active" ? "text-cyan-400" : status === "done_fail" ? "text-red-400" : "text-jb-text-muted"}`}>
              {status.replace("_", " ")}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-jb-text-muted font-mono block">DURATION</span>
            <span className="font-mono text-jb-text">
              {durationMs ? `${(durationMs / 1000).toFixed(1)}s` : "—"}
            </span>
          </div>
          {modelName && (
            <div className="col-span-2 pt-1 border-t border-jb-border/20 flex items-center gap-1.5 text-jb-text-muted">
              <Cpu size={12} className="text-cyan-400" />
              <span className="font-mono text-[10px] truncate">{modelName}</span>
            </div>
          )}
        </div>

        {/* Phase Summary */}
        {summary?.summary && (
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase">Summary</span>
            <div className="p-3 rounded-lg bg-jb-panel/30 border border-jb-border/20 text-jb-text font-medium leading-relaxed">
              {summary.summary}
            </div>
          </div>
        )}

        {/* Mutations Executed */}
        {detail?.mutations && detail.mutations.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase flex items-center gap-1">
              <Code2 size={12} className="text-teal-400" /> AST Mutations
            </span>
            <div className="space-y-1">
              {detail.mutations.map((m, idx) => (
                <div key={idx} className="p-2 rounded bg-jb-panel/40 border border-jb-border/30 text-[11px]">
                  <div className="font-mono text-teal-300 font-semibold">{m.action} ({m.target})</div>
                  {m.description && <p className="text-jb-text-muted text-[10px] mt-0.5">{m.description}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Checks */}
        {detail?.checks && detail.checks.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase flex items-center gap-1">
              <CheckCircle2 size={12} className="text-emerald-400" /> Validation Checks
            </span>
            <div className="space-y-1">
              {detail.checks.map((chk, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-jb-panel/40 border border-jb-border/30">
                  <span className="text-jb-text font-medium">{chk.name}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${chk.passed ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                    {chk.passed ? "PASSED" : "FAILED"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Judge Audit Verdict */}
        {detail?.judgeVerdict && (
          <div className="p-3 rounded-lg bg-jb-panel/50 border border-jb-border/40 space-y-1">
            <span className="text-[10px] font-mono text-jb-text-muted uppercase block">Judge Audit Verdict</span>
            <div className={`text-[13px] font-bold ${detail.judgeVerdict === "ACCEPT" ? "text-emerald-400" : "text-amber-400"}`}>
              {detail.judgeVerdict}
            </div>
            {detail.judgeIssues && detail.judgeIssues.length > 0 && (
              <ul className="list-disc list-inside text-[10px] text-amber-300/80 pt-1 space-y-0.5">
                {detail.judgeIssues.map((iss, i) => (
                  <li key={i}>{iss.issueType}: {iss.description}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
