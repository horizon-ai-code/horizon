"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { AlertCircle, ChevronDown, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AppState, TerminalEntry } from "@/types/session";
import { formatStatusContent } from "@/lib/formatStatusContent";
import GlassboxBar from "@/components/features/terminal/GlassboxBar";
import type { GlassboxState } from "@/types/glassbox";

const AGENT_BADGE: Record<string, { bg: string; text: string }> = {
  Cpu:          { bg: "#1a2f4a", text: "#5a8cf8" },
  Layers:       { bg: "#1c2e2e", text: "#3dd6c8" },
  FileCode2:    { bg: "#2e2218", text: "#e09c3b" },
  CheckCircle2: { bg: "#1a2e1a", text: "#4ec97e" },
  Clock:        { bg: "#2a2030", text: "#a78bfa" },
  AlertCircle:  { bg: "#3c1a1a", text: "#e06c75" },
  Monolith:     { bg: "#1a2f4a", text: "#548af7" },
};

const AGENT_LABEL: Record<string, string> = {
  Cpu:          "PLANNER",
  Layers:       "GENERATOR",
  FileCode2:    "AST PARSER",
  CheckCircle2: "JUDGE",
  Clock:        "SYSTEM",
  AlertCircle:  "ERROR",
  Monolith:     "MONOLITH",
};

interface TerminalProps {
  isTerminalCollapsed: boolean;
  setIsTerminalCollapsed: (val: boolean) => void;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  terminalEntries?: TerminalEntry[];
  appState: AppState;
  glassboxState?: GlassboxState;
}

interface EntryProps {
  entry: TerminalEntry;
  isDark: boolean;
}

// Sub-components defined outside for Rule 4 compliance
function DividerEntry({ isDark }: { isDark: boolean }) {
  return (
    <hr
      className="shrink-0 border-none my-2"
      style={{ borderTop: isDark ? "1px solid #3f4552" : "1px solid #d6d9df" }}
    />
  );
}

function CommandEntry({ entry, isDark }: EntryProps) {
  return (
    <div className="flex items-start gap-0 w-full max-w-6xl mb-3 mt-1 text-[12px] font-mono leading-relaxed shrink-0">
      <span
        className="shrink-0 select-none whitespace-nowrap pt-[2px] pr-[10px]"
        style={{ minWidth: "54px", color: isDark ? "#7d8594" : "#666" }}
      >
        {entry.timestamp ?? ""}
      </span>
      <div className="flex items-start flex-wrap gap-0 flex-1">
        <span className={`text-[13px] font-semibold whitespace-nowrap pt-[1px]
          ${isDark ? "text-[#5a8cf8]" : "text-[#3b5fc0]"}`}>
          user
        </span>
        <span className={`text-[13px] pt-[1px] ${isDark ? "text-[#8d95a5]" : "text-[#8a8f99]"}`}>@</span>
        <span className={`text-[13px] font-semibold whitespace-nowrap pt-[1px]
          ${isDark ? "text-[#5a8cf8]" : "text-[#3b5fc0]"}`}>
          horizon
        </span>
        <span className={`text-[13px] pt-[1px] ${isDark ? "text-[#4ec97e]" : "text-[#2a8a5e]"}`}>&nbsp;~</span>
        <span className={`text-[13px] pt-[1px] ${isDark ? "text-[#9aa3b3]" : "text-[#8a8f99]"}`}>&nbsp;&gt;</span>
        <span className={`text-[13px] font-semibold break-all
          ${isDark ? "text-[#e2e4ea]" : "text-[#080808]"}`}>
          &nbsp;{entry.text}
        </span>
      </div>
    </div>
  );
}

function LogEntry({ entry, isDark }: EntryProps) {
  const iconKey = entry.icon ?? "Cpu";
  const badge = AGENT_BADGE[iconKey] ?? AGENT_BADGE.Cpu;
  const label = AGENT_LABEL[iconKey] ?? "AGENT";
  const { summary, tags, details } = formatStatusContent(entry.text);
  const [showDetails, setShowDetails] = useState(false);

  const tagLine = tags
    .map((t) => (t.label ? `${t.label}: ${t.value}` : t.value))
    .join(" · ");

  return (
    <div className="flex items-start gap-0 w-full max-w-6xl mb-0.5 text-[12px] font-mono leading-relaxed shrink-0">
      <span
        className="shrink-0 select-none whitespace-nowrap pt-[2px] pr-[10px]"
        style={{ minWidth: "54px", color: isDark ? "#7d8594" : "#666" }}
      >
        {entry.timestamp ?? ""}
      </span>
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <span
          className="inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide border whitespace-nowrap"
          style={{
            backgroundColor: badge.bg,
            color:           badge.text,
            borderColor:     `${badge.text}33`,
          }}
        >
          {label}
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className={`text-[12px] leading-relaxed break-words
            ${entry.colorClass ?? (isDark ? "text-[#d9dee7]" : "text-[#333]")}`}>
            {summary.split(/(`[^`]+`)/).map((part, i) =>
              part.startsWith("`") && part.endsWith("`")
                ? <code key={i} className="text-[11px] px-1 rounded" style={{
                    backgroundColor: isDark ? "#2b2d30" : "#f2f2f2",
                    color: isDark ? "#56a8f5" : "#3574f0",
                  }}>{part.slice(1, -1)}</code>
                : <span key={i}>{part}</span>
            )}
          </span>
          {(tagLine || details) && (
            <span className={`text-[11px] leading-relaxed ${isDark ? "text-[#8d95a5]" : "text-[#888]"}`}>
              └{" "}{tagLine}{tagLine && details ? " · " : ""}
              {details && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  className={`inline cursor-pointer border-0 p-0 bg-transparent font-mono text-[11px] leading-relaxed
                    ${isDark ? "text-[#5a8cf8]/70 hover:text-[#5a8cf8]" : "text-[#3574f0]/70 hover:text-[#3574f0]"}`}
                >
                  {showDetails ? "▾ Hide analysis data" : "▸ View analysis data"}
                </button>
              )}
            </span>
          )}
          {showDetails && details && (
            <pre className={`mt-1 p-2 rounded text-[10px] leading-relaxed overflow-x-auto
              ${isDark ? "bg-[#1e1f22] text-[#a8b0bd]" : "bg-[#f2f2f2] text-[#555]"}`}>
              {details}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

function SystemEntry({ entry, isDark }: EntryProps) {
  return (
    <div className="flex items-start gap-0 w-full max-w-6xl mb-0.5 text-[12px] font-mono leading-relaxed shrink-0">
      <span
        className="shrink-0 select-none whitespace-nowrap pt-[2px] pr-[10px]"
        style={{ minWidth: "54px", color: isDark ? "#7d8594" : "#666" }}
      >
        {entry.timestamp ?? ""}
      </span>
      <div className="flex items-start gap-2 flex-1 overflow-hidden">
        <span className="inline-flex items-center shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide border whitespace-nowrap bg-[#2a2030] text-[#a78bfa] border-[#a78bfa33]">
          SYSTEM
        </span>
        <span className={`text-[12px] leading-relaxed break-words flex-1
          ${isDark ? "text-[#c1c8d6]" : "text-[#5d6672]"}`}>
          {entry.text}
        </span>
      </div>
    </div>
  );
}

function ErrorEntry({ entry, isDark }: EntryProps) {
  return (
    <div className={`mb-3 p-3 rounded-lg border flex items-start gap-3 animate-in fade-in slide-in-from-left-2 duration-300
      ${isDark ? "bg-red-500/5 border-red-500/20" : "bg-red-50 border-red-200"}`}>
      <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-red-500">
          Execution Error
        </span>
        <span className={`text-[12px] leading-relaxed ${isDark ? "text-red-200/80" : "text-red-700"}`}>
          {entry.text}
        </span>
      </div>
    </div>
  );
}

function EntryRouter({ entry, isDark }: EntryProps) {
  switch (entry.type) {
    case "divider":
      return <DividerEntry isDark={isDark} />;
    case "command":
      return <CommandEntry entry={entry} isDark={isDark} />;
    case "log":
      return <LogEntry entry={entry} isDark={isDark} />;
    case "system":
      return <SystemEntry entry={entry} isDark={isDark} />;
    case "error":
      return <ErrorEntry entry={entry} isDark={isDark} />;
    default:
      return null;
  }
}

export default function Terminal({
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  terminalEndRef,
  terminalEntries = [],
  appState,
  glassboxState,
}: TerminalProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";

  // Rule 23: Narrow auto-scroll effect dependency to primitives (.length)
  useEffect(() => {
    if (!isTerminalCollapsed && terminalEndRef.current && typeof terminalEndRef.current.scrollIntoView === "function") {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalEntries.length, isTerminalCollapsed, appState, terminalEndRef]);

  // Cleaned layout update: extracted toggle handlers
  const handleToggleCollapse = () => {
    setIsTerminalCollapsed(!isTerminalCollapsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleToggleCollapse();
    }
  };

  return (
    <div className="flex flex-col min-h-0 overflow-hidden bg-jb-panel relative h-full w-full ring-1 ring-white/[0.05]">
      {/* Header Container */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!isTerminalCollapsed}
        aria-label={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
        onClick={handleToggleCollapse}
        onKeyDown={handleKeyDown}
        draggable={false}
        title={isTerminalCollapsed ? "Expand Terminal" : "Collapse Terminal"}
        className={`px-4 flex items-center justify-between border-b h-[40px] shrink-0 cursor-pointer select-none outline-none focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-inset
          ${isDark ? "bg-jb-panel border-jb-border" : "bg-[#f7f8fa] border-[#ebecf0]"}`}
      >
        <div className="flex items-center h-full gap-4">
          <h3 className={`text-[12px] font-semibold tracking-wide flex items-center gap-2
            ${isDark ? "text-jb-text opacity-90" : "text-[#080808] opacity-80"}`}>
            Terminal
          </h3>

          {appState === "waiting" ? (
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border animate-pulse
              ${isDark ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" : "bg-yellow-50 text-yellow-600 border-yellow-200"}`}>
              BUSY
            </div>
          ) : null}

          {appState === "analyzing" ? (
            <div className={`px-2 py-0.5 rounded text-[10px] font-bold border
              ${isDark ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-cyan-50 text-cyan-600 border-cyan-200"}`}>
              ANALYZING
            </div>
          ) : null}

{appState === "analyzing" && glassboxState && (
  <GlassboxBar state={glassboxState} isDark={isDark} />
)}

          <span className={`mx-1 ${isDark ? "text-jb-border/60" : "text-[#ebecf0]"}`}>|</span>

          <div className={`h-[20px] w-[1px] ${isDark ? "bg-jb-border/60" : "bg-[#ebecf0]"}`} />

          <div className="flex items-center h-full pt-1.5 pb-1">
            <div className={`flex items-center gap-2 h-full px-3 rounded-md text-[12px] font-medium border shadow-sm
              ${isDark ? "bg-jb-panel text-jb-text border-jb-border/50" : "bg-white text-[#080808] border-[#dfdfdf]"}`}>
              Local
              <button
                aria-label="Close terminal tab"
                onClick={(e) => e.stopPropagation()}
                className={`opacity-0 group-hover:opacity-100 hover:opacity-100 p-0.5 rounded ml-1 w-4 h-4 flex items-center justify-center
                  ${isDark ? "hover:bg-jb-border" : "hover:bg-[#ebecf0]"}`}
              >
                <X size={10} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {(appState === "analyzing" || appState === "waiting") ? (
            <span className="flex h-2.5 w-2.5 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                appState === "waiting"
                  ? (isDark ? "bg-yellow-400" : "bg-yellow-500")
                  : (isDark ? "bg-cyan-400"   : "bg-cyan-500")
              }`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                appState === "waiting"
                  ? (isDark ? "bg-yellow-400" : "bg-yellow-500")
                  : (isDark ? "bg-cyan-400"   : "bg-cyan-500")
              }`} />
            </span>
          ) : null}

          <motion.div
            animate={{ rotate: isTerminalCollapsed ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 450, damping: 40 }}
          >
            <ChevronDown size={18} className={isDark ? "text-gray-500" : "text-slate-400"} />
          </motion.div>
        </div>
      </div>

      {/* Terminal Body Container */}
      <AnimatePresence initial={false}>
        {!isTerminalCollapsed && (
          <motion.div
            key="terminal-body"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 40 }}
            className={`pt-4 px-4 pb-4 overflow-y-auto flex-1 flex flex-col gap-1 custom-terminal-scrollbar font-mono
              ${isDark ? "bg-jb-panel" : "bg-white"}`}
          >
            {/* Boot header */}
            <div
              className={`text-[12px] font-mono mb-4 leading-relaxed shrink-0 ${isDark ? "text-[#a8b0bd]" : "text-jb-text-muted"}`}
            >
              Welcome to Horizon AI [Version 2.0.0]<br />
              (c) Horizon Corporation. All rights reserved.
            </div>

            {/* Entries list */}
            {terminalEntries.map((entry) => (
              <EntryRouter key={entry.id} entry={entry} isDark={isDark} />
            ))}

            {/* Scroll anchor */}
            <div ref={terminalEndRef} className="h-4 shrink-0" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}