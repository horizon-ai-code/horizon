# Glassbox Detail Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show detailed structured data from each status message — intent classification, mutation plans, validation findings, judge decisions — via click-expand on the GlassboxBar agent badge and hover tooltips on phase dots.

**Architecture:** Structured detail is parsed from status message `content` strings in the WebSocket hook, stored in extended `GlassboxState`, and rendered by a `StatusDetailPanel` that expands below the terminal header when the agent badge is clicked.

**Tech Stack:** TypeScript, React 19, Framer Motion

---

### Task 1: Update glassbox types

**Files:**
- Modify: `src/types/glassbox.ts`

- [ ] **Step 1: Extend the types**

Replace the file content with:
```typescript
export type AgentRole = "Planner" | "Generator" | "Validator" | "Judge" | "System";

export interface RetryInfo {
  current: number;
  max: number;
  type: "strategy" | "syntax_heal" | "sequential_mutation";
}

export interface IntentDetail {
  category?: string;
  intent?: string;
  targetUnit?: string;
  targetClass?: string;
  targetMember?: string;
}

export interface MutationItem {
  action: string;
  target: string;
  description?: string;
}

export interface ValidationFinding {
  tier: string;
  description: string;
}

export interface JudgeIssue {
  issueType: string;
  description: string;
}

export interface CurrentStatusDetail {
  intent?: IntentDetail;
  mutations?: MutationItem[];
  analysisSummary?: string;
  totalFaults?: number;
  findings?: ValidationFinding[];
  judgeVerdict?: "ACCEPT" | "REVISE";
  judgeIssues?: JudgeIssue[];
  phaseName?: string;       // "Strategy", "Execution", etc.
  phaseAction?: string;     // "Classifying intent", "Applying mutations", etc.
}

export interface PhaseSummary {
  summary: string;
  detail: CurrentStatusDetail | null;
  timestamp: number;
}

export interface GlassboxState {
  currentPhase: number;
  currentAgent: AgentRole;
  strategyIteration: number;
  maxStrategyIterations: number;
  syntaxHealAttempt: number;
  maxSyntaxHealAttempts: number;
  sequentialMutationRetry: number;
  maxSequentialMutationRetries: number;
  validationFaultCount: number | null;
  judgeDecision: "ACCEPT" | "REVISE" | null;
  currentDetail: CurrentStatusDetail | null;
  phaseSummaries: Record<number, PhaseSummary>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/glassbox.ts
git commit -m "feat: add CurrentStatusDetail, MutationItem, PhaseSummary types to glassbox"
```

---

### Task 2: Update status info parser

**Files:**
- Modify: `src/lib/parseStatusInfo.ts`

- [ ] **Step 1: Add structured detail parsers**

Extend the file with:

```typescript
import type { IntentDetail, MutationItem, ValidationFinding, CurrentStatusDetail } from "@/types/glassbox";

export function parseIntentDetail(content: string): IntentDetail | undefined {
  const extract = (label: string): string | undefined => {
    const re = new RegExp(`${label}:\\s*\`([^`]+)\``);
    const m = content.match(re);
    return m ? m[1] : undefined;
  };
  const cat = extract("Category");
  const intent = extract("Intent");
  const unit = extract("Target Unit");
  const cls = extract("Target Class");
  const member = extract("Target Member");
  if (cat || intent || unit || cls || member) {
    return { category: cat, intent, targetUnit: unit, targetClass: cls, targetMember: member };
  }
  return undefined;
}

export function parseMutationPlan(content: string): MutationItem[] | undefined {
  const items: MutationItem[] = [];
  const regex = /-\s+\*\*([^*]+)\*\*\s*on\s+`([^`]+)`/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    items.push({ action: match[1].trim(), target: match[2].trim() });
  }
  return items.length > 0 ? items : undefined;
}

export function parseValidationFindings(content: string): ValidationFinding[] | undefined {
  const findings: ValidationFinding[] = [];
  const regex = /\*\*\[([^\]]+)\]\*\*[\s\S]*?>([^<>\n]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    findings.push({ tier: match[1].trim(), description: match[2].trim() });
  }
  return findings.length > 0 ? findings : undefined;
}

export function parseJudgeIssues(content: string): { issueType: string; description: string }[] | undefined {
  const issues: { issueType: string; description: string }[] = [];
  const regex = /'issue_type':\s*'([^']+)',\s*'description':\s*'([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    issues.push({ issueType: match[1], description: match[2] });
  }
  return issues.length > 0 ? issues : undefined;
}

export function parsePhaseAction(content: string): string | undefined {
  const m = content.match(/Ph\d+:\s*(.+?)(?:\.\.\.|$)/);
  return m ? m[1].trim() : undefined;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/parseStatusInfo.ts
git commit -m "feat: add parsers for intent detail, mutation plan, validation findings, judge issues"
```

---

### Task 3: Update hook to store structured detail

**Files:**
- Modify: `src/hooks/useOrchestrationSocket.tsx`

- [ ] **Step 1: Add new imports**

After the existing `parseStatusInfo` imports, add:
```typescript
import {
  parseIntentDetail,
  parseMutationPlan,
  parseValidationFindings,
  parseJudgeIssues,
  parsePhaseAction,
} from "@/lib/parseStatusInfo";
```

- [ ] **Step 2: Update glassboxState initialization**

Find the `useState<GlassboxState>` initialization. Add the two new fields to the default state:
```typescript
const [glassboxState, setGlassboxState] = useState<GlassboxState>({
  currentPhase: 0,
  currentAgent: "System",
  strategyIteration: 1,
  maxStrategyIterations: 3,
  syntaxHealAttempt: 0,
  maxSyntaxHealAttempts: 3,
  sequentialMutationRetry: 0,
  maxSequentialMutationRetries: 3,
  validationFaultCount: null,
  judgeDecision: null,
  currentDetail: null,
  phaseSummaries: {},
});
```

- [ ] **Step 3: Update handleStatus to parse structured detail**

Inside `handleStatus`, after the existing glassbox parsing block, add:
```typescript
// Parse structured detail
const intent = parseIntentDetail(msg.content);
const mutations = parseMutationPlan(msg.content);
const findings = parseValidationFindings(msg.content);
const judgeIssues = parseJudgeIssues(msg.content);
const phaseAction = parsePhaseAction(msg.content);

setGlassboxState((prev) => {
  const detail: CurrentStatusDetail = {
    ...prev.currentDetail,
    intent: intent ?? prev.currentDetail?.intent,
    mutations: mutations ?? prev.currentDetail?.mutations,
    findings: findings ?? prev.currentDetail?.findings,
    judgeIssues: judgeIssues ?? prev.currentDetail?.judgeIssues,
    totalFaults: parseValidationFaults(msg.content) ?? prev.currentDetail?.totalFaults,
    judgeVerdict: decision ?? prev.currentDetail?.judgeVerdict,
    phaseName: prev.currentDetail?.phaseName,
    phaseAction: phaseAction ?? prev.currentDetail?.phaseAction,
  };

  // Also store phase summary
  const phaseNum = phase !== null && phase !== undefined ? phase : prev.currentPhase;
  const phaseSummaries = { ...prev.phaseSummaries };
  if (phaseNum > 0 && msg.content.trim()) {
    const firstLine = msg.content.split("\n")[0].trim();
    if (!phaseSummaries[phaseNum] || Date.now() - phaseSummaries[phaseNum].timestamp > 5000) {
      phaseSummaries[phaseNum] = {
        summary: firstLine,
        detail: { ...detail },
        timestamp: Date.now(),
      };
    }
  }

  return { ...prev, currentDetail: detail, phaseSummaries };
});
```

- [ ] **Step 4: Reset detail when new session starts**

In both branches of the `connection_id` handler, add to the existing reset:
```typescript
setGlassboxState({
  currentPhase: 0,
  currentAgent: "System",
  strategyIteration: 1,
  maxStrategyIterations: 3,
  syntaxHealAttempt: 0,
  maxSyntaxHealAttempts: 3,
  sequentialMutationRetry: 0,
  maxSequentialMutationRetries: 3,
  validationFaultCount: null,
  judgeDecision: null,
  currentDetail: null,
  phaseSummaries: {},
});
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOrchestrationSocket.tsx
git commit -m "feat: parse structured status detail in WebSocket hook"
```

---

### Task 4: Add click-expand detail panel to GlassboxBar

**Files:**
- Modify: `src/components/features/terminal/GlassboxBar.tsx`

- [ ] **Step 1: Add expandable detail panel**

Replace the file content. The GlassboxBar now:
- Still shows phase dots + agent badge + counters
- Agent badge is clickable — toggles the detail panel
- Phase dots have `title` attributes showing phase summaries
- When expanded, shows `StatusDetailPanel` below

```typescript
"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GlassboxState } from "@/types/glassbox";
import StatusDetailPanel from "@/components/features/terminal/StatusDetailPanel";

interface GlassboxBarProps {
  state: GlassboxState;
  isDark: boolean;
}

const PHASES = [
  { num: 1, label: "Baseline", agent: "Validator" as const },
  { num: 2, label: "Strategy", agent: "Planner" as const },
  { num: 3, label: "Execution", agent: "Generator" as const },
  { num: 4, label: "Validation", agent: "Validator" as const },
  { num: 5, label: "Adjudication", agent: "Judge" as const },
  { num: 6, label: "Finalization", agent: "System" as const },
];

const AGENT_COLORS: Record<string, string> = {
  Planner: "#5a8cf8",
  Generator: "#3dd6c8",
  Validator: "#e09c3b",
  Judge: "#4ec97e",
  System: "#a78bfa",
};

export default function GlassboxBar({ state, isDark }: GlassboxBarProps) {
  const [showDetail, setShowDetail] = useState(false);
  const { currentPhase, currentAgent, strategyIteration, syntaxHealAttempt, maxStrategyIterations, maxSyntaxHealAttempts, validationFaultCount, judgeDecision, phaseSummaries, currentDetail } = state;

  const hasRetries = syntaxHealAttempt > 0 || strategyIteration > 1;
  const agentColor = AGENT_COLORS[currentAgent] ?? "#888";

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 h-full px-2 text-[11px] font-medium select-none">
        {/* Phase dots with tooltips */}
        <div className="flex items-center gap-1">
          {PHASES.map((p) => {
            const summary = phaseSummaries[p.num];
            return (
              <div key={p.num} className="flex items-center gap-1 group relative">
                <div
                  className="w-2 h-2 rounded-full cursor-help"
                  style={{
                    backgroundColor: currentPhase >= p.num ? (currentPhase === p.num ? agentColor : (isDark ? "#777" : "#aaa")) : (isDark ? "#555" : "#ccc"),
                    boxShadow: currentPhase === p.num ? `0 0 6px ${agentColor}` : "none",
                  }}
                />
                {currentPhase === p.num && (
                  <span className={`text-[10px] ${isDark ? "text-[#8d95a5]" : "text-[#888]"}`}>
                    {p.label}
                  </span>
                )}
                {/* Tooltip */}
                {summary && (
                  <div className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-[10px] whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity
                    ${isDark ? "bg-[#1e1f22] text-[#d9dee7] border border-[#393b40]" : "bg-white text-[#333] border border-[#ddd]"}`}>
                    {summary.summary}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Clickable agent badge */}
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide border cursor-pointer whitespace-nowrap"
          style={{
            backgroundColor: `${agentColor}18`,
            color: agentColor,
            borderColor: `${agentColor}33`,
          }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: agentColor }} />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: agentColor }} />
          </span>
          {currentAgent}
        </button>

        {/* Retry counter */}
        {hasRetries && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
            ${isDark ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-50 text-yellow-600"}`}>
            Retry {strategyIteration}/{maxStrategyIterations}
            {syntaxHealAttempt > 0 && ` · Heal ${syntaxHealAttempt}/${maxSyntaxHealAttempts}`}
          </span>
        )}

        {/* Validation faults */}
        {validationFaultCount !== null && validationFaultCount > 0 && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
            ${isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"}`}>
            {validationFaultCount} fault{validationFaultCount !== 1 ? "s" : ""}
          </span>
        )}

        {/* Judge decision */}
        {judgeDecision && (
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
              ${judgeDecision === "ACCEPT"
                ? (isDark ? "bg-green-500/15 text-green-400" : "bg-green-50 text-green-600")
                : (isDark ? "bg-orange-500/15 text-orange-400" : "bg-orange-50 text-orange-600")
              }`}
          >
            {judgeDecision === "ACCEPT" ? "✅" : "❌"} {judgeDecision}
          </span>
        )}
      </div>

      {/* Expandable detail panel */}
      <AnimatePresence>
        {showDetail && currentDetail && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <StatusDetailPanel detail={currentDetail} isDark={isDark} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds (StatusDetailPanel is imported but doesn't exist yet — will be created in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/components/features/terminal/GlassboxBar.tsx
git commit -m "feat: add click-expand detail panel to GlassboxBar with phase dot tooltips"
```

---

### Task 5: Build StatusDetailPanel component

**Files:**
- Create: `src/components/features/terminal/StatusDetailPanel.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { Cpu, Layers, FileCode2, CheckCircle2, AlertCircle } from "lucide-react";
import type { CurrentStatusDetail } from "@/types/glassbox";

interface StatusDetailPanelProps {
  detail: CurrentStatusDetail;
  isDark: boolean;
}

const AGENT_ICONS: Record<string, typeof Cpu> = {
  Planner: Cpu,
  Generator: Layers,
  Validator: FileCode2,
  Judge: CheckCircle2,
};

const TIER_LABELS: Record<string, string> = {
  TIER_1_SYNTAX: "Syntax Error",
  TIER_2_A_COMPLEXITY: "Complexity",
  TIER_2_B_BOUNDARY: "Boundary",
  TIER_2_C_INTENT_MATH: "Intent Mismatch",
  TIER_3_JUDGE: "Judge Rejected",
};

const MUTATION_LABELS: Record<string, string> = {
  ADD_METHOD: "Add Method",
  MODIFY_METHOD: "Modify Method",
  DELETE_METHOD: "Delete Method",
  EXTRACT_METHOD: "Extract Method",
  INLINE_METHOD: "Inline Method",
};

export default function StatusDetailPanel({ detail, isDark }: StatusDetailPanelProps) {
  const { intent, mutations, findings, judgeVerdict, judgeIssues, totalFaults, phaseName, phaseAction } = detail;
  const muted = isDark ? "text-[#8d95a5]" : "text-[#888]";
  const border = isDark ? "border-[#393b40]" : "border-[#ddd]";
  const bg = isDark ? "bg-[#1e1f22]" : "bg-[#f2f2f2]";

  return (
    <div className={`px-4 py-2 text-[11px] leading-relaxed ${bg} border-t ${border}`}>
      {/* Intent detail */}
      {intent && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mb-1">
          {intent.category && <Tag label="Category" value={intent.category} color="#5a8cf8" isDark={isDark} />}
          {intent.intent && <Tag label="Intent" value={intent.intent} color="#3dd6c8" isDark={isDark} />}
          {intent.targetClass && <Tag label="Class" value={intent.targetClass} color="#e09c3b" isDark={isDark} />}
          {intent.targetMember && <Tag label="Member" value={intent.targetMember} color="#e09c3b" isDark={isDark} />}
          {intent.targetUnit && <Tag label="Unit" value={intent.targetUnit} color="#a78bfa" isDark={isDark} />}
        </div>
      )}

      {/* Mutation plan */}
      {mutations && mutations.length > 0 && (
        <div className="mb-1">
          <span className={`text-[10px] font-bold tracking-wide ${muted}`}>Mutations:</span>
          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {mutations.map((m, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border"
                style={{
                  backgroundColor: isDark ? "#2b2d30" : "#fff",
                  borderColor: isDark ? "#393b40" : "#ddd",
                  color: isDark ? "#d9dee7" : "#333",
                }}
              >
                <span className="font-bold" style={{ color: "#3dd6c8" }}>
                  {MUTATION_LABELS[m.action] ?? m.action}
                </span>
                <span className={muted}>on</span>
                <code className={`text-[10px] ${isDark ? "text-[#56a8f5]" : "text-[#3574f0]"}`}>
                  {m.target}
                </code>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Validation findings */}
      {findings && findings.length > 0 && (
        <div className="mb-1">
          <span className={`text-[10px] font-bold tracking-wide ${muted}`}>
            {totalFaults ? `${totalFaults} Faults` : "Findings"}:
          </span>
          <div className="flex flex-col gap-0.5 mt-0.5">
            {findings.map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <span className={`shrink-0 px-1 rounded text-[9px] font-bold
                  ${f.tier.includes("SYNTAX") ? "bg-red-500/15 text-red-400"
                    : f.tier.includes("COMPLEXITY") ? "bg-orange-500/15 text-orange-400"
                    : f.tier.includes("BOUNDARY") ? "bg-yellow-500/15 text-yellow-400"
                    : f.tier.includes("JUDGE") ? "bg-purple-500/15 text-purple-400"
                    : "bg-gray-500/15 text-gray-400"}`}>
                  {TIER_LABELS[f.tier] ?? f.tier}
                </span>
                <span className={isDark ? "text-[#c1c8d6]" : "text-[#555]"}>
                  {f.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Judge verdict */}
      {judgeVerdict && (
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[13px]">{judgeVerdict === "ACCEPT" ? "✅" : "❌"}</span>
          <span className={`text-[12px] font-bold ${judgeVerdict === "ACCEPT" ? "text-[#27c93f]" : "text-[#f93e3e]"}`}>
            {judgeVerdict}
          </span>
        </div>
      )}

      {/* Judge issues */}
      {judgeIssues && judgeIssues.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {judgeIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <AlertCircle size={10} className="mt-0.5 shrink-0 text-orange-400" />
              <span>
                <span className="font-bold text-orange-400">{issue.issueType}</span>
                <span className={muted}> — {issue.description}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fallback: empty state */}
      {!intent && !mutations && (!findings || findings.length === 0) && !judgeVerdict && (
        <span className={muted}>{phaseAction ?? "Processing..."}</span>
      )}
    </div>
  );
}

function Tag({ label, value, color, isDark }: { label: string; value: string; color: string; isDark: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border
      ${isDark ? "bg-[#2b2d30]" : "bg-white"}`}
      style={{ borderColor: `${color}44`, color: isDark ? "#d9dee7" : "#333" }}
    >
      <span className="font-bold" style={{ color }}>{label}</span>
      <code className="text-[10px]" style={{ color: isDark ? "#56a8f5" : "#3574f0" }}>{value}</code>
    </span>
  );
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/terminal/StatusDetailPanel.tsx
git commit -m "feat: add StatusDetailPanel showing intent, mutations, findings, judge verdict"
```

---

### Task 6: Enhance LogEntry with richer formatting

**Files:**
- Modify: `src/components/features/terminal/Terminal.tsx`

- [ ] **Step 1: Update LogEntry with agent-colored inline code and details**

Find the `LogEntry` component. Replace the text span that renders `summary` with:

```typescript
{/* Summary with inline code highlighting */}
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/terminal/Terminal.tsx
git commit -m "feat: enhance LogEntry with agent-colored inline code formatting"
```

---

## Self-Review

**Spec coverage:** All three features covered:
- Hover tooltip on phase dots with phase summary — Task 4 (tooltip in GlassboxBar, data from hook in Task 3)
- Click-expand detail panel for current status — Tasks 4+5 (GlassboxBar click toggles StatusDetailPanel)
- Enhanced terminal log entries — Task 6 (inline code highlighting)

**Placeholder scan:** No TBDs, TODOs, or vague instructions. Every step has complete code.

**Type consistency:** `CurrentStatusDetail`, `PhaseSummary` types defined in Task 1, used by parser Task 2, hook Task 3, StatusDetailPanel Task 5, and GlassboxBar Task 4. All consistent.
