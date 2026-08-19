"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, Play, CheckCircle2, XCircle, RefreshCcw, Database, Server, TerminalSquare, RotateCcw, X, PanelLeft, PanelLeftClose, PanelLeftOpen, Terminal } from "lucide-react";
import { MOCK_PIPELINE_EVENTS, PHASES_CONFIG, PipelineEvent } from "./pipelineEvents";
import CodeEditorPanel from "../editor/CodeEditorPanel";

interface PipelineTrackerProps {
  onClose: () => void;
}

export default function PipelineTracker({ onClose }: PipelineTrackerProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [eventIndex, setEventIndex] = useState(0);
  
  // UI states
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isTraceLogOpen, setIsTraceLogOpen] = useState(true);

  // Track expanded phases
  const [expandedPhases, setExpandedPhases] = useState<Record<number, boolean>>({});
  
  // Auto-scroll ref for trace console
  const traceEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  // Scroll to bottom of trace when new event arrives
  useEffect(() => {
    if (traceEndRef.current && isTraceLogOpen) {
      traceEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [eventIndex, isTraceLogOpen]);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  
  // Derived state from events
  const currentEvents = MOCK_PIPELINE_EVENTS.slice(0, eventIndex + 1);
  const latestEvent = currentEvents[currentEvents.length - 1] || MOCK_PIPELINE_EVENTS[0];
  const activePhase = latestEvent.phase;
  const activeStep = latestEvent.step;

  // Auto-expand active phase
  useEffect(() => {
    const timeout = setTimeout(() => {
      setExpandedPhases(prev => ({ ...prev, [activePhase]: true }));
    }, 0);
    return () => clearTimeout(timeout);
  }, [activePhase]);

  // Derive model VRAM state
  const activeModel = [...currentEvents].reverse().find(e => e.model_active !== undefined)?.model_active || null;

  // Derive loops state
  const innerLoopEvent = [...currentEvents].reverse().find(e => e.loop?.type === "inner");
  const outerLoopEvent = [...currentEvents].reverse().find(e => e.loop?.type === "outer");

  // Derive code state
  const codeStateEvent = [...currentEvents].reverse().find(e => e.codeState !== undefined);
  const originalCode = codeStateEvent?.codeState?.original || "// Waiting for code generation...";
  const candidateCode = codeStateEvent?.codeState?.candidate || "// Waiting for code generation...";

  const handleNext = () => {
    if (eventIndex < MOCK_PIPELINE_EVENTS.length - 1) {
      setEventIndex(prev => prev + 1);
    }
  };

  const handleReset = () => {
    setEventIndex(0);
  };

  const getStatusIcon = (status: PipelineEvent["status"]) => {
    switch (status) {
      case "pass": return <CheckCircle2 size={14} className="text-emerald-500" />;
      case "fail": return <XCircle size={14} className="text-red-500" />;
      case "looping": return <RefreshCcw size={14} className="text-amber-500 animate-spin" />;
      case "running": return <div className="w-3.5 h-3.5 rounded-full bg-blue-500 animate-pulse border border-blue-400" />;
      default: return <div className="w-3 h-3 rounded-full bg-gray-400/50" />;
    }
  };

  const getStepStatus = (stepId: number): PipelineEvent["status"] => {
    const stepEvents = currentEvents.filter(e => e.step === stepId);
    if (stepEvents.length === 0) return "pending";
    const lastStepEvent = stepEvents[stepEvents.length - 1];
    return lastStepEvent.status;
  };

  const getPhaseStatus = (phaseId: number): PipelineEvent["status"] => {
    const phaseEvents = currentEvents.filter(e => e.phase === phaseId);
    if (phaseEvents.length === 0) return "pending";
    const lastPhaseEvent = phaseEvents[phaseEvents.length - 1];
    if (lastPhaseEvent.status === "fail" || lastPhaseEvent.status === "looping") return lastPhaseEvent.status;
    
    const phaseConfig = PHASES_CONFIG.find(p => p.id === phaseId);
    if (!phaseConfig) return "pending";
    
    const allStepsPass = phaseConfig.steps.every(s => getStepStatus(s) === "pass");
    return allStepsPass ? "pass" : "running";
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className={`flex flex-col w-full h-full max-w-[1400px] max-h-[900px] overflow-hidden rounded-xl shadow-2xl border ${
          isDark ? 'bg-jb-panel border-white/10 ring-1 ring-white/5' : 'bg-white border-[#ebecf0] ring-1 ring-black/5'
        }`}
      >
        {/* Header / Next Button */}
        <div className={`flex items-center justify-between px-4 py-2 border-b shrink-0 z-20 ${isDark ? 'border-jb-border' : 'border-[#ebecf0]'}`}>
          <div className="flex items-center gap-2">
            <TerminalSquare size={16} className={isDark ? "text-jb-accent" : "text-[#3574f0]"} />
            <span className={`text-[13px] font-medium ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
              Live Execution Tracker
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-md ${isDark ? 'bg-jb-bg text-jb-text-muted' : 'bg-[#ebecf0] text-[#818594]'}`}>
              Mock Demo
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTraceLogOpen(!isTraceLogOpen)}
              className={`p-1.5 rounded-md transition-colors mr-1 ${
                isTraceLogOpen 
                  ? (isDark ? 'bg-jb-border/40 text-jb-text' : 'bg-[#ebecf0] text-[#080808]')
                  : (isDark ? 'text-jb-text-muted hover:bg-jb-border/40 hover:text-jb-text' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]')
              }`}
              title="Toggle Trace Log"
            >
              <Terminal size={16} />
            </button>
            <button
              onClick={handleReset}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                isDark ? 'bg-jb-bg hover:bg-jb-border/40 text-jb-text' : 'bg-[#f7f8fa] hover:bg-[#ebecf0] text-[#080808]'
              }`}
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={handleNext}
              disabled={eventIndex >= MOCK_PIPELINE_EVENTS.length - 1}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors mr-2 ${
                eventIndex >= MOCK_PIPELINE_EVENTS.length - 1
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark ? 'bg-jb-accent text-white hover:bg-jb-accent/90' : 'bg-[#3574f0] text-white hover:bg-[#3574f0]/90'
              }`}
            >
              Next Event <Play size={14} />
            </button>
            <div className={`w-px h-5 mx-1 ${isDark ? 'bg-jb-border' : 'bg-[#dfdfdf]'}`} />
            <button
              onClick={onClose}
              className={`p-1.5 rounded-md transition-colors ${
                isDark ? 'text-jb-text-muted hover:bg-jb-border/40 hover:text-jb-text' : 'text-[#818594] hover:bg-[#ebecf0] hover:text-[#080808]'
              }`}
              title="Close Tracker"
            >
              <X size={16} />
            </button>
          </div>
        </div>

      {/* Workspace */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        
        {/* Left Rail: Phase Stepper */}
        <motion.div 
          initial={false}
          animate={{ width: isSidebarOpen ? 280 : 48 }}
          transition={{ duration: 0.2 }}
          className={`shrink-0 border-r overflow-hidden flex flex-col ${isDark ? 'border-jb-border bg-[#1e1f22]' : 'border-[#ebecf0] bg-[#f7f8fa]'}`}
        >
          {isSidebarOpen ? (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1, delay: 0.1 }}
              className="w-[280px] h-full flex flex-col overflow-y-auto custom-chat-scrollbar"
            >
              <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDark ? 'border-jb-border/40' : 'border-[#ebecf0]/40'}`}>
                <div className={`text-[11px] font-bold tracking-wider uppercase ${isDark ? 'text-jb-text-muted' : 'text-[#818594]'}`}>
                  Orchestration Phases
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className={`p-1 rounded-md transition-colors ${
                    isDark ? 'text-jb-text-muted hover:bg-white/10 hover:text-jb-text' : 'text-[#818594] hover:bg-black/5 hover:text-[#080808]'
                  }`}
                  title="Close Sidebar"
                >
                  <PanelLeftClose size={16} />
                </button>
              </div>
              <div className="flex-1 px-2 py-2">
                {PHASES_CONFIG.map((phase) => {
                  const phaseStatus = getPhaseStatus(phase.id);
                  const isExpanded = expandedPhases[phase.id];
                  
                  return (
                    <div key={phase.id} className="mb-2">
                      <div 
                        onClick={() => setExpandedPhases(p => ({ ...p, [phase.id]: !p[phase.id] }))}
                        className={`flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors ${
                          isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'
                        }`}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {getStatusIcon(phaseStatus)}
                        <span className={`text-[13px] font-medium ${isDark ? 'text-jb-text' : 'text-[#080808]'}`}>
                          {phase.name}
                        </span>
                      </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden ml-6 pl-2 border-l border-jb-border/40 mt-1"
                            >
                              {phase.steps.map(step => {
                                const stepStatus = getStepStatus(step);
                                return (
                                  <div key={step} className={`flex items-center gap-2 p-1.5 rounded-md ${
                                    activeStep === step && (stepStatus === 'running' || stepStatus === 'looping' || stepStatus === 'fail')
                                      ? (isDark ? 'bg-blue-500/10' : 'bg-[#3574f0]/10') : ''
                                  }`}>
                                    {getStatusIcon(stepStatus)}
                                    <span className={`text-[12px] ${
                                      activeStep === step ? (isDark ? 'text-jb-text font-medium' : 'text-[#080808] font-medium') : (isDark ? 'text-jb-text-muted' : 'text-[#818594]')
                                    }`}>
                                      Step {step}
                                    </span>
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="w-[48px] h-full flex flex-col items-center py-2 shrink-0"
            >
              <button
                onClick={() => setIsSidebarOpen(true)}
                className={`p-1.5 rounded-md transition-colors ${
                  isDark ? 'text-jb-text-muted hover:bg-white/10 hover:text-jb-text' : 'text-[#818594] hover:bg-black/5 hover:text-[#080808]'
                }`}
                title="Open Sidebar"
              >
                <PanelLeftOpen size={18} />
              </button>
            </motion.div>
          )}
        </motion.div>

        {/* Center Content: Code + Terminal */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-jb-panel">
          
          <div className="flex-1 flex overflow-hidden">
            {/* Original Code */}
            <div className={`flex-1 flex flex-col border-r ${isDark ? 'border-jb-border' : 'border-[#ebecf0]'}`}>
              <div className={`px-4 py-1.5 text-[11px] font-mono border-b shrink-0 ${isDark ? 'bg-[#2b2d30] border-jb-border text-jb-text-muted' : 'bg-[#ebecf0] border-[#dfdfdf] text-[#818594]'}`}>
                Original.java
              </div>
              <CodeEditorPanel value={originalCode} onChange={() => {}} placeholder="" readOnly />
            </div>
            
            {/* Candidate Code */}
            <div className="flex-1 flex flex-col relative">
              <div className={`px-4 py-1.5 text-[11px] font-mono border-b shrink-0 ${isDark ? 'bg-[#2b2d30] border-jb-border text-jb-text-muted' : 'bg-[#ebecf0] border-[#dfdfdf] text-[#818594]'}`}>
                Candidate.java
              </div>
              <CodeEditorPanel 
                value={candidateCode} 
                onChange={() => {}} 
                placeholder="" 
                readOnly 
                highlightLines={{
                  issue: getStepStatus(7) === 'fail' ? [7] : []
                }}
              />
              
              {/* Loop arrow animations overlay */}
              <AnimatePresence>
                {latestEvent.status === 'looping' && latestEvent.loop?.type === 'inner' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute top-1/2 left-4 z-50 flex items-center gap-2 p-3 rounded-lg bg-amber-500/20 border border-amber-500/50 backdrop-blur-md shadow-lg"
                  >
                    <RefreshCcw size={20} className="text-amber-500 animate-reverse-spin" />
                    <div className="text-amber-500 font-bold text-[13px]">Inner Loop Triggered</div>
                  </motion.div>
                )}
                {latestEvent.status === 'looping' && latestEvent.loop?.type === 'outer' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.8, y: -20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute top-1/3 left-1/4 z-50 flex items-center gap-2 p-3 rounded-lg bg-purple-500/20 border border-purple-500/50 backdrop-blur-md shadow-lg"
                  >
                    <RefreshCcw size={20} className="text-purple-500 animate-reverse-spin" />
                    <div className="text-purple-400 font-bold text-[13px]">Outer Loop Triggered</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Status Bar */}
          <div className={`h-8 border-t shrink-0 flex items-center justify-between px-3 text-[11px] font-mono z-20 ${isDark ? 'bg-[#2b2d30] border-jb-border text-jb-text-muted' : 'bg-[#ebecf0] border-[#dfdfdf] text-[#818594]'}`}>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Database size={12} />
                VRAM:
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={activeModel || "empty"}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className={activeModel ? "text-emerald-500 font-bold" : ""}
                  >
                    {activeModel || "Empty"}
                  </motion.span>
                </AnimatePresence>
              </div>
              <div className="flex items-center gap-1.5">
                <Server size={12} />
                Status: {latestEvent.status}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span>Inner Loop:</span>
                <div className="flex gap-0.5">
                  {[1,2,3].map(i => (
                    <div key={i} className={`w-2 h-2 rounded-full ${
                      (innerLoopEvent?.loop?.iteration || 0) >= i ? 'bg-amber-500' : 'bg-gray-500/30'
                    }`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <span>Outer Loop:</span>
                <div className="flex gap-0.5">
                  {[1,2,3].map(i => (
                    <div key={i} className={`w-2 h-2 rounded-full ${
                      (outerLoopEvent?.loop?.iteration || 0) >= i ? 'bg-purple-500' : 'bg-gray-500/30'
                    }`} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trace Log (Collapsible) */}
          <AnimatePresence initial={false}>
            {isTraceLogOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 220, opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`border-t flex flex-col font-mono text-[12px] overflow-hidden shrink-0 ${isDark ? 'border-jb-border bg-[#1e1f22]' : 'border-[#ebecf0] bg-[#f7f8fa]'}`}
              >
                <div className="h-full w-full flex flex-col">
                  <div className={`flex items-center justify-between text-[11px] font-bold tracking-wider px-3 py-2 border-b uppercase ${isDark ? 'border-jb-border text-jb-text-muted' : 'border-[#ebecf0] text-[#818594]'}`}>
                    <span>Trace Log Terminal</span>
                    <button onClick={() => setIsTraceLogOpen(false)} className={`hover:text-jb-text transition-colors p-0.5 rounded-sm ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/10'}`}>
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-chat-scrollbar p-2 flex flex-col gap-1">
                    {currentEvents.map((event, idx) => {
                      const isError = event.status === 'fail' || event.status === 'looping';
                      const isPass = event.status === 'pass';
                      return (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={idx}
                          className={`flex py-1 px-2 rounded hover:bg-white/5 transition-colors`}
                        >
                          <span className="opacity-50 w-[40px] shrink-0">[{event.step}]</span>
                          <span className={`flex-1 break-words ${isError ? 'text-red-400' : isPass ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-jb-text' : 'text-[#080808]')}`}>
                            {event.detail}
                          </span>
                        </motion.div>
                      );
                    })}
                    <div ref={traceEndRef} className="h-4 shrink-0" />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
      </motion.div>
    </div>
  );
}
