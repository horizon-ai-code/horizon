"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { X, Cpu, CheckCircle2, AlertTriangle, Code2, Target, ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import type { FlowNodeData } from "@/types/flowGraph";

interface Props {
  nodeData: FlowNodeData | null;
  onClose: () => void;
}

const REFACTORING_DESCRIPTIONS: Record<string, string> = {
  // Refactor Categories (RefactorCategory)
  CONTROL_FLOW: "Restructures conditionals and loops to flatten deeply nested logic, eliminate control flags, and lower cyclomatic complexity.",
  METHOD_MOVEMENT: "Extracts or inlines methods to improve modular encapsulation, code reuse, and single responsibility.",
  STATE_MANAGEMENT: "Encapsulates variable scopes, extracts static constants, and renames symbols to minimize mutable state side effects.",

  // Refactor Intents (RefactorIntent)
  FLATTEN_CONDITIONAL: "Replaces deeply nested if-else statements with early return guard clauses to simplify execution paths.",
  DECOMPOSE_CONDITIONAL: "Extracts complex condition checks into boolean helper methods or descriptive condition variables.",
  CONSOLIDATE_CONDITIONAL: "Combines multiple checks that yield the same outcome into a single, clean logical expression.",
  REMOVE_CONTROL_FLAG: "Eliminates boolean control flag variables by using direct return or break statements.",
  REPLACE_LOOP_WITH_PIPELINE: "Transforms imperative for/while loops into functional Java Stream API pipelines.",
  SPLIT_LOOP: "Splits a loop performing multiple unrelated operations into separate loops with single responsibilities.",
  EXTRACT_METHOD: "Extracts a cohesive block of code into a dedicated, reusable helper method.",
  INLINE_METHOD: "Replaces calls to simple or single-use methods directly with their body implementation.",
  EXTRACT_VARIABLE: "Assigns complex inline sub-expressions to well-named local variables to clarify intent.",
  INLINE_VARIABLE: "Replaces redundant temporary variables used only once directly with their assignment expression.",
  EXTRACT_CONSTANT: "Replaces hardcoded literal values or magic numbers with descriptive static final constants.",
  RENAME_SYMBOL: "Renames variables, parameters, or methods to clearer, self-documenting names.",

  // AST Mutation Actions (MutationAction)
  ADD_METHOD: "Generates and inserts a new helper method definition into the target class body.",
  REMOVE_METHOD: "Removes redundant or unreferenced method declarations from the class scope.",
  MODIFY_METHOD: "Updates signature, return type, or statements of an existing method.",
  ADD_FIELD: "Introduces a new class-level field variable into the target class body.",
  ADD_DECLARATION: "Inserts a new local variable or constant declaration into the method or class scope.",
  REMOVE_FIELD: "Deletes unused or redundant class fields from the class definition.",
  ADD_CONSTANT: "Declares a new static final constant at the class level.",
  ADD_ENUM: "Introduces a new Enum type definition to replace magic status integers or string codes.",
  SPLIT_BODY: "Splits a monolithic method body into distinct logical sub-sections.",
};

export default function PhaseDetailDrawer({ nodeData, onClose }: Props) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!nodeData) return null;

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const { phase, status, iteration, durationMs, modelName, summary } = nodeData;
  const detail = summary?.detail;

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderInfoTrigger = (key: string) => {
    const isExpanded = !!expandedKeys[key];
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleExpand(key);
        }}
        title={isExpanded ? "Collapse explanation" : "Expand explanation"}
        className={`inline-flex items-center justify-center p-0.5 rounded-md transition-all cursor-pointer ${
          isExpanded
            ? isDark
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "bg-cyan-100 text-cyan-700 border border-cyan-300"
            : isDark
            ? "text-jb-text-muted hover:text-cyan-400 hover:bg-jb-panel border border-transparent"
            : "text-slate-400 hover:text-cyan-700 hover:bg-slate-100 border border-transparent"
        }`}
      >
        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
    );
  };

  const renderDescriptionPanel = (key: string, descLookupKey: string) => {
    if (!expandedKeys[key]) return null;
    const description =
      REFACTORING_DESCRIPTIONS[descLookupKey] ||
      REFACTORING_DESCRIPTIONS[descLookupKey.toUpperCase()] ||
      "Modifies code structure according to defined transformation rule.";

    return (
      <div
        className={`mt-1.5 p-2 rounded-md border text-[10px] leading-relaxed animate-in fade-in slide-in-from-top-1 ${
          isDark
            ? "bg-cyan-950/40 border-cyan-500/30 text-cyan-200 shadow-inner"
            : "bg-cyan-50 border-cyan-200 text-cyan-900 shadow-inner"
        }`}
      >
        {description}
      </div>
    );
  };

  return (
    <div className={`absolute top-0 right-0 bottom-0 w-80 border-l shadow-2xl backdrop-blur-md z-30 flex flex-col transition-all duration-300 animate-in slide-in-from-right ${
      isDark ? 'bg-jb-bg/95 border-jb-border/60 text-jb-text' : 'bg-white/95 border-slate-200 text-slate-900'
    }`}>
      {/* Drawer Header */}
      <div className={`flex items-center justify-between p-4 border-b ${isDark ? 'border-jb-border/50' : 'border-slate-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center w-6 h-6 rounded-full font-bold text-[11px] ${
            isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'
          }`}>
            {phase.num}
          </span>
          <div>
            <h3 className={`text-[14px] font-bold leading-tight ${isDark ? 'text-jb-text' : 'text-slate-900'}`}>{phase.name}</h3>
            <span className={`text-[10px] font-mono ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>{phase.agent}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className={`p-1 rounded-md transition-colors ${
            isDark ? 'text-jb-text-muted hover:text-jb-text hover:bg-jb-panel' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-chat-scrollbar text-[12px]">
        {/* Status & Overview */}
        <div className={`p-3 rounded-lg border space-y-2 ${isDark ? 'bg-jb-panel/50 border-jb-border/40' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-mono ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>STATUS</span>
            <span className={`font-bold capitalize ${
              status === "done_ok"
                ? isDark ? "text-emerald-400" : "text-emerald-600"
                : status === "active"
                ? isDark ? "text-cyan-400" : "text-cyan-700"
                : status === "done_fail"
                ? isDark ? "text-red-400" : "text-red-600"
                : isDark ? "text-jb-text-muted" : "text-slate-500"
            }`}>
              {status === "done_ok"
                ? "Passed"
                : status === "done_fail"
                ? "Failed"
                : status === "active"
                ? "Active"
                : status === "flagged"
                ? "Flagged"
                : status === "skipped"
                ? "Skipped"
                : "Waiting"}
            </span>
          </div>
          {modelName && (
            <div className={`pt-2 border-t flex items-center gap-1.5 ${isDark ? 'border-jb-border/30 text-jb-text-muted' : 'border-slate-200 text-slate-600'}`}>
              <Cpu size={12} className={isDark ? "text-cyan-400" : "text-cyan-600"} />
              <span className="font-mono text-[10px] truncate">{modelName}</span>
            </div>
          )}
        </div>

        {/* Baseline Metrics (Node 1 Baseline ONLY) */}
        {phase.num === 1 && (
          <div className="space-y-2">
            {detail?.baselineMetrics && (
              <div className="space-y-1.5">
                <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>Baseline Analysis</span>
                <div className={`grid grid-cols-2 gap-2 p-3 rounded-lg border text-[11px] ${isDark ? 'bg-jb-panel/50 border-jb-border/40' : 'bg-slate-50 border-slate-200'}`}>
                  {detail.baselineMetrics.cyclomaticComplexity !== undefined && (
                    <div>
                      <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>CYCLOMATIC COMPLEXITY</span>
                      <span className={`font-mono font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{detail.baselineMetrics.cyclomaticComplexity}</span>
                    </div>
                  )}
                  {detail.baselineMetrics.linesOfCode !== undefined && (
                    <div>
                      <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>LINES OF CODE</span>
                      <span className={`font-mono font-medium ${isDark ? 'text-jb-text' : 'text-slate-800'}`}>{detail.baselineMetrics.linesOfCode}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className={`p-3 rounded-lg border text-[11px] leading-relaxed ${isDark ? 'bg-jb-panel/30 border-jb-border/20 text-jb-text-muted' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
              Phase 1 performs static analysis on the original input code to establish baseline metrics (Cyclomatic Complexity, Line Count, AST scope anchors) before any refactoring begins.
            </div>
          </div>
        )}

        {/* Strategy Intent & Scope (Node 2 Strategy ONLY) */}
        {phase.num === 2 && detail?.intent && (
          <div className="space-y-1.5">
            <span className={`text-[10px] font-mono uppercase flex items-center gap-1 ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>
              <Target size={12} className={isDark ? "text-cyan-400" : "text-cyan-600"} /> Strategy Intent & Scope
            </span>
            <div className={`p-3 rounded-lg border space-y-2 text-[11px] ${isDark ? 'bg-jb-panel/50 border-jb-border/40' : 'bg-slate-50 border-slate-200'}`}>
              {detail.intent.intent && (
                <div>
                  <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>SPECIFIC INTENT</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`font-mono font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{detail.intent.intent}</span>
                    {renderInfoTrigger(`intent_${detail.intent.intent}`)}
                  </div>
                  {renderDescriptionPanel(`intent_${detail.intent.intent}`, detail.intent.intent)}
                </div>
              )}
              {detail.intent.category && (
                <div>
                  <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>CATEGORY</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`font-mono font-medium ${isDark ? 'text-jb-text' : 'text-slate-800'}`}>{detail.intent.category}</span>
                    {renderInfoTrigger(`category_${detail.intent.category}`)}
                  </div>
                  {renderDescriptionPanel(`category_${detail.intent.category}`, detail.intent.category)}
                </div>
              )}
              {(detail.intent.targetClass || detail.intent.targetMember) && (
                <div className={`pt-1.5 border-t ${isDark ? 'border-jb-border/30' : 'border-slate-200'}`}>
                  <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>TARGET SCOPE</span>
                  <span className={`font-mono font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
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
            <span className={`text-[10px] font-mono uppercase flex items-center gap-1 ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>
              <Code2 size={12} className={isDark ? "text-teal-400" : "text-teal-600"} /> AST Modification Plan
            </span>
            <div className="space-y-1.5">
              {detail.mutations.map((m, idx) => (
                <div key={idx} className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${isDark ? 'bg-jb-panel/40 border-jb-border/30' : 'bg-slate-50 border-slate-200'}`}>
                  <div className={`font-mono font-bold flex items-center justify-between ${isDark ? 'text-teal-300' : 'text-teal-700'}`}>
                    <div className="flex items-center gap-1.5">
                      <span>{m.action}</span>
                      {renderInfoTrigger(`mutation_${idx}_${m.action}`)}
                    </div>
                    <span className={`text-[10px] font-normal ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>on {m.target}</span>
                  </div>
                  {m.description && (
                    <p className={`text-[10px] leading-relaxed border-t pt-1 ${isDark ? 'text-jb-text-muted border-jb-border/20' : 'text-slate-600 border-slate-200'}`}>
                      {m.description}
                    </p>
                  )}
                  {renderDescriptionPanel(`mutation_${idx}_${m.action}`, m.action)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Validation Checks (Node 4 Validation ONLY) */}
        {phase.num === 4 && (
          <div className="space-y-1.5">
            <span className={`text-[10px] font-mono uppercase flex items-center gap-1 ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>
              <CheckCircle2 size={12} className={isDark ? "text-emerald-400" : "text-emerald-600"} /> Validation Checks
            </span>
            {detail?.checks && detail.checks.length > 0 ? (
              <div className="space-y-1.5">
                {detail.checks.map((chk, idx) => (
                  <div key={idx} className={`p-2.5 rounded-lg border text-[11px] space-y-1 ${isDark ? 'bg-jb-panel/40 border-jb-border/30' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isDark ? 'text-jb-text' : 'text-slate-900'}`}>{chk.name}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-extrabold ${chk.passed ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30" : "bg-red-500/20 text-red-600 border border-red-500/30"}`}>
                        {chk.passed ? "PASSED" : "FAILED"}
                      </span>
                    </div>
                    {(chk.before_value !== undefined || chk.after_value !== undefined) && (
                      <div className={`text-[10px] font-mono pt-0.5 ${isDark ? 'text-cyan-300/80' : 'text-cyan-700'}`}>
                        Metric: {chk.before_value ?? '—'} &rarr; {chk.after_value ?? '—'}
                      </div>
                    )}
                    {chk.details && (
                      <p className={`text-[10px] border-t pt-1 leading-relaxed ${isDark ? 'text-jb-text-muted border-jb-border/20' : 'text-slate-600 border-slate-200'}`}>
                        {chk.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`p-3 rounded-lg border text-[11px] ${isDark ? 'bg-jb-panel/30 border-jb-border/20 text-jb-text-muted' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                Validation checks passed cleanly.
              </div>
            )}
          </div>
        )}

        {/* Judge Audit Verdict & Thinking (Node 5 Adjudication ONLY) */}
        {phase.num === 5 && (
          <div className={`p-3 rounded-lg border space-y-2.5 ${isDark ? 'bg-jb-panel/50 border-jb-border/40' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>Judge Audit Verdict</span>
            {detail?.judgeVerdict && (
              <div className={`text-[13px] font-bold ${detail.judgeVerdict === "ACCEPT" ? isDark ? "text-emerald-400" : "text-emerald-700" : isDark ? "text-amber-400" : "text-amber-700"}`}>
                {detail.judgeVerdict}
              </div>
            )}

            {/* Variable Trace Box */}
            {detail?.variableTrace && (detail.variableTrace.original || detail.variableTrace.refactored) && (
              <div className={`pt-1.5 border-t space-y-1 ${isDark ? 'border-jb-border/30' : 'border-slate-200'}`}>
                <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>VARIABLE TRACE</span>
                <div className={`p-2 rounded border font-mono text-[10px] space-y-0.5 ${isDark ? 'bg-jb-bg/60 border-jb-border/30' : 'bg-white border-slate-200'}`}>
                  <div className="flex justify-between">
                    <span className={isDark ? "text-jb-text-muted" : "text-slate-500"}>Original:</span>
                    <span className={`font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>&quot;{detail.variableTrace.original || '—'}&quot;</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDark ? "text-jb-text-muted" : "text-slate-500"}>Refactored:</span>
                    <span className={`font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>&quot;{detail.variableTrace.refactored || '—'}&quot;</span>
                  </div>
                  {detail.variableTrace.mapping && detail.variableTrace.mapping !== "None" && (
                    <div className="flex justify-between">
                      <span className={isDark ? "text-jb-text-muted" : "text-slate-500"}>Mapping:</span>
                      <span className={isDark ? "text-cyan-300" : "text-cyan-700"}>{detail.variableTrace.mapping}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logic Comparison */}
            {detail?.logicComparison && (
              <div className={`pt-1.5 border-t ${isDark ? 'border-jb-border/30' : 'border-slate-200'}`}>
                <span className={`text-[10px] font-mono block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>LOGIC COMPARISON</span>
                <p className={`text-[11px] leading-relaxed mt-0.5 font-medium ${isDark ? 'text-jb-text' : 'text-slate-800'}`}>
                  {detail.logicComparison}
                </p>
              </div>
            )}

            {/* Audit Issues */}
            {detail?.judgeIssues && detail.judgeIssues.length > 0 && (
              <ul className={`list-disc list-inside text-[10px] pt-1 space-y-0.5 border-t ${isDark ? 'text-amber-300/90 border-jb-border/30' : 'text-amber-800 border-slate-200'}`}>
                {detail.judgeIssues.map((iss, i) => (
                  <li key={i}><span className="font-bold">{iss.issueType}:</span> {iss.description}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Finalization (Node 6 Finalization ONLY) */}
        {phase.num === 6 && (
          <div className={`p-3 rounded-lg border space-y-2 text-[11px] ${isDark ? 'bg-jb-panel/50 border-jb-border/40' : 'bg-slate-50 border-slate-200'}`}>
            <span className={`text-[10px] font-mono uppercase block ${isDark ? 'text-jb-text-muted' : 'text-slate-500'}`}>Finalization Status</span>
            {status === "done_fail" ? (
              <>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className={isDark ? "text-red-400" : "text-red-600"} />
                  <span className={`font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>Refactoring Session Aborted</span>
                </div>
                <p className={`text-[10px] leading-relaxed border-t pt-1.5 ${isDark ? 'text-jb-text-muted border-jb-border/20' : 'text-slate-600 border-slate-200'}`}>
                  The refactoring pipeline ended without producing a passing solution. Original input code is safely preserved.
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className={isDark ? "text-emerald-400" : "text-emerald-600"} />
                  <span className={`font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>Refactoring Session Complete</span>
                </div>
                <p className={`text-[10px] leading-relaxed border-t pt-1.5 ${isDark ? 'text-jb-text-muted border-jb-border/20' : 'text-slate-600 border-slate-200'}`}>
                  The refactored code has passed all static validation checks and Judge audit verification. Output code and insights are fully synthesized.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
