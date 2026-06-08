"use client"

import { useTheme } from "next-themes";
import { Copy, Layers, X, FileCode2, Cpu, CheckCircle2, Loader2, Clock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import CodeEditorPanel from "@/components/features/editor/CodeEditorPanel";
import type { AppState, OrchestrationResult } from "@/types/session";
import type { GlassboxState } from "@/types/glassbox";
import React, { useState, useEffect } from "react";
import RefactoringReplay from "@/components/features/output/RefactoringReplay";
import InsightsPanel from "@/components/features/output/InsightsPanel";

interface RefactoredOutputProps {
  refactoredOutput: string;
  setRefactoredOutput: (val: string) => void;
  showFlowchartModal: boolean;
  setShowFlowchartModal: (val: boolean) => void;
  activeStep: number;
  isTerminalCollapsed: boolean;
  appState: AppState;
  orchestrationResult: OrchestrationResult;
  glassboxState?: GlassboxState;
}

const PIPELINE_PHASES = [
  { num: 1, name: "Baseline", agent: "Validator", icon: Cpu, color: "#56a8f5" },
  { num: 2, name: "Strategy", agent: "Planner", icon: Cpu, color: "#5a8cf8" },
  { num: 3, name: "Execution", agent: "Generator", icon: Layers, color: "#3dd6c8" },
  { num: 4, name: "Validation", agent: "Validator", icon: FileCode2, color: "#e09c3b" },
  { num: 5, name: "Audit", agent: "Judge", icon: CheckCircle2, color: "#4ec97e" },
  { num: 6, name: "Finalize", agent: "System", icon: Clock, color: "#a78bfa" },
];

function getPhaseStatus(phaseNum: number, currentPhase: number): "done" | "active" | "waiting" {
  if (phaseNum < currentPhase) return "done";
  if (phaseNum === currentPhase) return "active";
  return "waiting";
}

interface PhaseDetailCardProps {
  phase: typeof PIPELINE_PHASES[number];
  gs: GlassboxState;
  isDark: boolean;
}

function PhaseDetailCard({ phase, gs, isDark }: PhaseDetailCardProps) {
  const cd = gs.currentDetail;
  const duration = gs.phaseDurations?.find((d) => d.phase === phase.num);
  const durationStr = duration ? `${(duration.durationMs / 1000).toFixed(1)}s` : null;
  const bg = isDark ? "bg-[#1e1f22]" : "bg-white";
  const border = isDark ? "border-[#393b40]" : "border-[#ddd]";
  const muted = isDark ? "text-[#8d95a5]" : "text-[#888]";

  return (
    <div className={`w-full rounded-xl border ${bg} ${border} p-5 text-center`}>
      {/* Centered header: icon + agent */}
      <div className="flex flex-col items-center mb-4">
        <div className="flex items-center justify-center w-14 h-14 rounded-xl mb-2"
          style={{ backgroundColor: `${phase.color}18`, color: phase.color, boxShadow: `0 0 20px ${phase.color}15` }}>
          <phase.icon size={28} strokeWidth={1.5} />
        </div>
        <span className="text-[16px] font-bold tracking-wide" style={{ color: phase.color }}>
          {phase.agent}
        </span>
        <span className={`text-[11px] font-medium ${muted}`}>
          Phase {phase.num}: {phase.name}{durationStr ? ` · ${durationStr}` : ""}
        </span>
      </div>

      {/* Left-aligned content sections */}
      <div className="text-left">
        {phase.num === 2 && cd?.intent && (
          <div className="flex flex-wrap gap-2">
            {cd.intent.category && <TagInline label="Category" value={cd.intent.category} color="#5a8cf8" isDark={isDark} />}
            {cd.intent.intent && <TagInline label="Intent" value={cd.intent.intent} color="#3dd6c8" isDark={isDark} />}
            {cd.intent.targetClass && <TagInline label="Class" value={cd.intent.targetClass} color="#e09c3b" isDark={isDark} />}
            {cd.intent.targetMember && <TagInline label="Member" value={cd.intent.targetMember} color="#e09c3b" isDark={isDark} />}
          </div>
        )}

        {phase.num === 2 && cd?.architecture && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px]">
            {cd.architecture.primaryTargets.length > 0 && (
              <span className={muted}>Targets: {cd.architecture.primaryTargets.map(t => t.name).join(", ")}</span>
            )}
            {cd.architecture.newStructures.length > 0 && (
              <span className={muted}>New: {cd.architecture.newStructures.map(t => t.name).join(", ")}</span>
            )}
            {cd.architecture.mustPreserve.length > 0 && (
              <span className={muted}>Preserve: {cd.architecture.mustPreserve.map(t => t.name).join(", ")}</span>
            )}
          </div>
        )}

        {phase.num === 3 && cd?.mutations && cd.mutations.length > 0 && (
          <div>
            {cd.generatorProgress && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? "#333" : "#e5e7eb" }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.round((cd.generatorProgress.completed / cd.generatorProgress.total) * 100)}%`, backgroundColor: phase.color }} />
                </div>
                <span className={`text-[11px] font-bold ${muted}`}>
                  {cd.generatorProgress.completed}/{cd.generatorProgress.total}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {cd.mutations.map((m, i) => {
                const statusColor = m.status === "completed" ? "#27c93f"
                  : m.status === "in_progress" ? phase.color
                  : m.status === "retrying" ? "#f4bf4f"
                  : m.status === "failed" ? "#f93e3e"
                  : "#888";
                const icon = m.status === "completed" ? "✅"
                  : m.status === "in_progress" ? "◉"
                  : m.status === "retrying" ? "⟳"
                  : m.status === "failed" ? "✗"
                  : "○";
                return (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span style={{ color: statusColor }}>{icon}</span>
                    <span className="font-bold" style={{ color: "#3dd6c8" }}>{m.action}</span>
                    <span className={muted}>on</span>
                    <code className={`text-[11px] ${isDark ? "text-[#56a8f5]" : "text-[#3574f0]"}`}>{m.target}</code>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {phase.num === 4 && cd?.checks && cd.checks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className={`text-[12px] font-bold ${muted}`}>
              {cd.checks.filter(c => c.passed).length}/{cd.checks.length} checks passed
              {cd.checks.some(c => !c.passed) && ` · ${cd.checks.filter(c => !c.passed).length} failed`}
            </span>
            {cd.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2 text-[12px]">
                <span style={{ color: c.passed ? "#27c93f" : "#f93e3e" }}>{c.passed ? "✅" : "✗"}</span>
                <span className={c.passed ? "" : "font-bold"} style={{ color: c.passed ? (isDark ? "#aaa" : "#666") : "#f93e3e" }}>
                  {c.name}
                </span>
                {!c.passed && c.details && <span className={muted}>— {c.details}</span>}
              </div>
            ))}
          </div>
        )}

        {phase.num === 5 && gs.judgeDecision && (
          <div className="flex items-center gap-2">
            <span className="text-[18px]">{gs.judgeDecision === "ACCEPT" ? "✅" : "❌"}</span>
            <span className={`text-[16px] font-bold ${gs.judgeDecision === "ACCEPT" ? "text-[#27c93f]" : "text-[#f93e3e]"}`}>
              {gs.judgeDecision}
            </span>
          </div>
        )}

        {phase.num === 5 && cd?.judgeIssues && cd.judgeIssues.length > 0 && (
          <div className="flex flex-col gap-1 mt-2">
            {cd.judgeIssues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <AlertCircle size={12} className="mt-0.5 shrink-0 text-orange-400" />
                <span className="font-bold text-orange-400">{issue.issueType}</span>
                <span className={muted}>— {issue.description}</span>
              </div>
            ))}
          </div>
        )}

        {phase.num === 1 && cd?.analysisSummary && (
          <span className={`text-[12px] ${muted}`}>{cd.analysisSummary}</span>
        )}

        {(() => {
          const isEmpty = !cd?.intent && !cd?.mutations && !cd?.checks && !gs.judgeDecision;
          if (isEmpty || phase.num === 6) {
            return <span className={`text-[12px] ${muted}`}>{cd?.phaseAction ?? "Processing..."}</span>;
          }
          return null;
        })()}
      </div>
    </div>
  );
}

function TagInline({ label, value, color, isDark }: { label: string; value: string; color: string; isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border
      ${isDark ? "bg-[#2b2d30]" : "bg-white"}`}
      style={{ borderColor: `${color}44` }}>
      <span className="font-bold" style={{ color }}>{label}</span>
      <code className="text-[11px]" style={{ color: isDark ? "#56a8f5" : "#3574f0" }}>{value}</code>
    </span>
  );
}

const OrchestrationFlowchart = ({ activeStep, glassboxState }: { activeStep: number; glassboxState?: GlassboxState }) => {
  const gs = glassboxState;
  const currentPhase = gs?.currentPhase ?? 0;
  const strategyIter = gs?.strategyIteration ?? 1;
  const hasRetry = strategyIter > 1;
  const activePhase = PIPELINE_PHASES.find((p) => p.num === currentPhase) ?? PIPELINE_PHASES[0];
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex flex-col items-center w-full p-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Top: Compact pipeline dots */}
      <div className="flex items-center justify-center w-full max-w-2xl mb-6 relative">
        {hasRetry && (
          <svg className="absolute -top-4 left-[18%] w-[64%] h-6 z-20 pointer-events-none" viewBox="0 0 100 16" fill="none">
            <path d="M 8 12 Q 50 -4 92 12" stroke="#f4bf4f" strokeWidth="1.2" strokeDasharray="2.5 2" fill="none"
              markerEnd="url(#retryArrow2)" />
            <defs>
              <marker id="retryArrow2" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                <path d="M0,0 L0,5 L5,2.5 z" fill="#f4bf4f" />
              </marker>
            </defs>
            <text x="50" y="5" textAnchor="middle" className="text-[4px]" fill="#f4bf4f" fontSize="4" fontWeight="bold">
              Retry {strategyIter}/{gs?.maxStrategyIterations ?? 3}
            </text>
          </svg>
        )}
        <div className="flex items-center gap-0 w-full">
          {PIPELINE_PHASES.map((p, i) => {
            const status = getPhaseStatus(p.num, currentPhase);
            const isActive = status === "active";
            const isDone = status === "done";
            return (
              <React.Fragment key={p.num}>
                <div className="flex flex-col items-center gap-1 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full transition-all duration-500
                      ${isActive ? "animate-pulse" : ""}
                      ${isDone ? "ring-2 ring-offset-2 ring-offset-jb-panel" : ""}`}
                    style={{
                      backgroundColor: isDone ? "#27c93f" : (isActive ? p.color : (isDark ? "#555" : "#ccc")),
                      boxShadow: isActive ? `0 0 10px ${p.color}` : "none",
                    }}
                  />
                  <span className={`text-[9px] font-bold ${isActive ? "" : (isDone ? "" : "opacity-40")}`}
                    style={{ color: isDone ? "#27c93f" : (isActive ? p.color : (isDark ? "#888" : "#999")) }}>
                    {p.num}
                  </span>
                  <span className={`text-[8px] font-medium ${isActive ? "" : "opacity-40"}`}
                    style={{ color: isActive ? p.color : (isDark ? "#888" : "#999") }}>
                    {p.name}
                  </span>
                </div>
                {i < PIPELINE_PHASES.length - 1 && (
                  <div className="flex-1 h-[2px] mx-[-2px] relative overflow-hidden self-start mt-[6px]"
                    style={{ backgroundColor: isDark ? "#333" : "#ddd" }}>
                    <div className="absolute h-full left-0 transition-all duration-700"
                      style={{
                        width: getPhaseStatus(p.num + 1, currentPhase) !== "waiting" ? "100%" : "0%",
                        backgroundColor: getPhaseStatus(p.num + 1, currentPhase) === "active" ? "#548af7" : "#27c93f",
                      }} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Bottom: Detail card for active phase */}
      <div className="w-full max-w-2xl flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={activePhase.num}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <PhaseDetailCard phase={activePhase} gs={gs ?? {
              currentPhase: 0, currentAgent: "System", strategyIteration: 1,
              maxStrategyIterations: 3, syntaxHealAttempt: 0, maxSyntaxHealAttempts: 3,
              sequentialMutationRetry: 0, maxSequentialMutationRetries: 3,
              validationFaultCount: null, judgeDecision: null, currentDetail: null,
              phaseSummaries: {}, phaseDurations: [], totalDurationMs: null,
            } as GlassboxState} isDark={isDark} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default function RefactoredOutput({
  refactoredOutput,
  setRefactoredOutput,
  showFlowchartModal,
  setShowFlowchartModal,
  activeStep,
  isTerminalCollapsed,
  appState,
  orchestrationResult,
  glassboxState,
}: RefactoredOutputProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  // 1. ADD 'output' state and make it the default
  const [rightPanelMode, setRightPanelMode] = useState<'output' | 'replay' | 'insights'>('output');

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  const isDark = mounted ? resolvedTheme === "dark" : true;

  const handleCopy = async () => {
    const textToCopy = refactoredOutput || "// Awaiting code generation...";
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  if (!mounted) return null;

  return (
    <div className={`flex flex-col min-h-0 overflow-hidden bg-jb-panel transition-all duration-300 h-full
      ${isTerminalCollapsed ? 'flex-none h-[48px]' : (appState === 'done' ? 'flex-1' : 'flex-[1.5]')}`}>
      
      <div className={`flex items-center justify-between border-b h-[40px] shrink-0 relative z-20 transition-colors duration-300 pr-2
        ${isDark ? 'bg-jb-bg border-jb-border' : 'bg-[#f7f8fa] border-[#ebecf0]'}`}>
        
        <div className="flex items-center h-full pt-1.5 pb-1 px-2 gap-1 overflow-x-auto custom-chat-scrollbar">


          
          <button 
            onClick={() => setRightPanelMode('insights')}
            role="tab"
            aria-selected={rightPanelMode === 'insights'}
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'insights' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
            Insights.md
          </button>
          
          <button 
            onClick={() => setRightPanelMode('output')}
            role="tab"
            aria-selected={rightPanelMode === 'output'}
            className={`h-full px-3 flex items-center gap-2 text-[12px] font-medium transition-all cursor-pointer rounded-md 
              ${rightPanelMode === 'output' 
                ? (isDark ? 'bg-jb-panel text-jb-text border-[#393b40]/50 shadow-sm' : 'bg-white text-[#080808] border-[#dfdfdf] shadow-sm') 
                : (isDark ? 'text-jb-text opacity-70 hover:opacity-100 hover:bg-jb-panel/40 border-transparent' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')}`}
          >
            RefactoredOutput.java
          </button>
        </div>
        
        <div className="flex items-center gap-2 pr-4">
          {appState === 'done' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border shadow-sm transition-transform flex items-center gap-1.5 duration-300
              ${isDark ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${isDark ? 'bg-green-500' : 'bg-emerald-600'}`}></div> Ready
            </span>
          )}
          <button 
            onClick={handleCopy}
            className={`p-1.5 rounded-md transition-all ring-1 cursor-pointer hover:scale-110 active:scale-90 ring-transparent
              ${isDark ? 'text-jb-text-muted hover:text-jb-text hover:bg-jb-border/40 hover:ring-jb-border' : 'text-[#818594] hover:text-[#080808] hover:bg-[#ebecf0] hover:ring-[#dbdbdb]'}`}
            title="Copy Code"
            aria-label="Copy Code"
          >
            <Copy size={16} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden z-10">
        {appState === 'idle' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 opacity-100 pointer-events-none z-10 transition-colors duration-300">
            <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[24px] mb-6 shadow-2xl ring-1 transition-all duration-300
              ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
              <Layers size={36} className={isDark ? "text-jb-accent/60" : "text-[#3574f0]/60"} strokeWidth={1.5} />
            </div>
            <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
              Awaiting source code analysis
            </p>
            <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
              Output will be generated by the Swarm
            </p>
          </div>
        ) : appState === 'waiting' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10 transition-colors duration-300">
             <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl ring-1 transition-all duration-300 relative
                ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
                <Clock size={36} className="text-yellow-400 animate-pulse" strokeWidth={1.5} />
                <div className="absolute inset-0 bg-yellow-400/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
             </div>
             <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
                Server Busy
             </p>
             <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
                Waiting for other requests to complete...
             </p>
          </div>
        ) : appState === 'analyzing' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 pointer-events-none z-10 transition-colors duration-300">
             <div className={`flex items-center justify-center w-[88px] h-[88px] rounded-[32px] mb-6 shadow-2xl ring-1 transition-all duration-300 relative
                ${isDark ? 'bg-jb-bg ring-jb-border' : 'bg-[#f7f8fa] ring-[#ebecf0]'}`}>
                <Loader2 size={36} className="text-jb-accent animate-spin" strokeWidth={1.5} />
                <div className="absolute inset-0 bg-jb-accent/10 blur-2xl rounded-full scale-150 animate-pulse"></div>
             </div>
             <p className={`text-[15px] font-semibold transition-colors ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
                Synthesis Engine Active
             </p>
             <p className={`text-[13px] mt-2 font-medium transition-colors ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
                Generating consensus from Swarm nodes...
             </p>
          </div>
        ) : (
          // 3. RENDER LOGIC UPDATE
          rightPanelMode === 'output' ? (
             <CodeEditorPanel 
               value={refactoredOutput} 
               onChange={setRefactoredOutput} 
               highlightLines={{
                 added: orchestrationResult.diffHighlights.added,
                 removed: orchestrationResult.diffHighlights.removed,
               }}
               showDiff={appState === 'done'}
               placeholder="" 
               bottomPadding="48px"
             />
          ) : rightPanelMode === 'replay' ? (
             <RefactoringReplay replaySteps={orchestrationResult.replaySteps} />
          ) : (
             <InsightsPanel 
               metrics={orchestrationResult.metrics} 
               summary={orchestrationResult.summary} 
               planner_model={orchestrationResult.planner_model}
               generator_model={orchestrationResult.generator_model}
               judge_model={orchestrationResult.judge_model}
             />
          )
        )}

        {showFlowchartModal && (appState === 'analyzing' || appState === 'done') && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-jb-panel/95 backdrop-blur-2xl">
             <div className="flex justify-end p-5 absolute top-0 right-0 w-full z-40">
                {appState === 'done' && <button onClick={() => setShowFlowchartModal(false)} className="p-2 rounded-full ring-1 transition-transform cursor-pointer bg-secondary hover:bg-secondary/80 ring-border text-foreground"><X size={18} /></button>}
             </div>
             
             <OrchestrationFlowchart activeStep={activeStep} glassboxState={glassboxState} />
          </div>
        )}
      </div>
    </div>
  );
}