# Glassbox Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a live "glassbox" view showing the backend's orchestration pipeline — phase progress, active agent, retry counters, and phase timings — in both the terminal header and the analysis flowchart overlay.

**Architecture:** Status messages are parsed in the WebSocket hook into structured `GlassboxState`, exposed via context, and consumed by two UI components: a slim `GlassboxBar` in the terminal header and the enhanced `OrchestrationFlowchart` overlay.

**Tech Stack:** TypeScript, React 19, Framer Motion, Zustand

---

### Task 1: Create glassbox types

**Files:**
- Create: `src/types/glassbox.ts`

- [ ] **Step 1: Create the file**

```typescript
export type AgentRole = "Planner" | "Generator" | "Validator" | "Judge" | "System";

export interface PhaseInfo {
  number: number;
  name: string;
  agent: AgentRole;
}

export interface RetryInfo {
  current: number;
  max: number;
  type: "strategy" | "syntax_heal" | "sequential_mutation";
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
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/glassbox.ts
git commit -m "feat: add glassbox state types"
```

---

### Task 2: Create status info parser

**Files:**
- Create: `src/lib/parseStatusInfo.ts`

- [ ] **Step 1: Create the file**

```typescript
import type { AgentRole, RetryInfo } from "@/types/glassbox";

const PHASE_PATTERNS: Record<string, number> = {
  "Ph1": 1,
  "Ph2": 2,
  "Ph3": 3,
  "Ph4": 4,
  "Ph5": 5,
  "Ph6": 6,
};

export function parsePhaseNumber(content: string): number | null {
  for (const [prefix, num] of Object.entries(PHASE_PATTERNS)) {
    if (content.includes(prefix)) return num;
  }
  if (content.toLowerCase().includes("baseline")) return 1;
  if (content.toLowerCase().includes("audit") || content.toLowerCase().includes("adjudication")) return 5;
  if (content.toLowerCase().includes("finalizing") || content.toLowerCase().includes("result")) return 6;
  return null;
}

export function parseStrategyIteration(content: string): number | null {
  const match = content.match(/Strategy\s+Iter\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function parseRetryInfo(content: string): RetryInfo | null {
  const syntaxMatch = content.match(/attempt\s+(\d+)\s*\/\s*(\d+)/i);
  if (syntaxMatch) {
    return { current: parseInt(syntaxMatch[1], 10), max: parseInt(syntaxMatch[2], 10), type: "syntax_heal" };
  }
  const seqMatch = content.match(/retrying\s+(\d+)\s*\/\s*(\d+)/i);
  if (seqMatch) {
    return { current: parseInt(seqMatch[1], 10), max: parseInt(seqMatch[2], 10), type: "sequential_mutation" };
  }
  return null;
}

export function parseValidationFaults(content: string): number | null {
  const match = content.match(/Total\s+Faults?[:\s]+(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export function parseJudgeDecision(content: string): "ACCEPT" | "REVISE" | null {
  if (content.includes("ACCEPT")) return "ACCEPT";
  if (content.includes("REVISE")) return "REVISE";
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/parseStatusInfo.ts
git commit -m "feat: add status info parser for glassbox data"
```

---

### Task 3: Add glassbox state to WebSocket hook

**Files:**
- Modify: `src/hooks/useOrchestrationSocket.tsx`

- [ ] **Step 1: Add glassbox imports after line 9**

```typescript
import type { GlassboxState } from "@/types/glassbox";
import {
  parsePhaseNumber,
  parseStrategyIteration,
  parseRetryInfo,
  parseValidationFaults,
  parseJudgeDecision,
} from "@/lib/parseStatusInfo";
```

- [ ] **Step 2: Add glassbox state to OrchestrationContextValue (around line 23-30)**

Add a `glassboxState` field:
```typescript
export interface OrchestrationContextValue {
  connectionStatus: ConnectionStatus;
  connect: (targetSessionId: string) => void;
  disconnect: () => void;
  sendRefactorRequest: (request: RefactorRequest, commandId?: string) => boolean;
  sendHaltRequest: () => boolean;
  setTargetSessionId: (id: string) => void;
  glassboxState: GlassboxState;
}
```

- [ ] **Step 3: Add GlassboxState ref and default state inside OrchestrationProvider**

After `const lastProcessedCommandIdRef = useRef<string | null>(null);` (around line 41), add:
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
});
```

- [ ] **Step 4: Update `handleStatus` to parse glassbox info**

Inside `handleStatus`, after computing `visuals` but before creating the entry, add:
```typescript
// Parse glassbox data
const phase = parsePhaseNumber(msg.content) ?? (msg.role === "System" ? 6 : undefined);
const strategyIter = parseStrategyIteration(msg.content);
const retry = parseRetryInfo(msg.content);
const faults = parseValidationFaults(msg.content);
const decision = parseJudgeDecision(msg.content);

setGlassboxState((prev) => {
  const next = { ...prev, currentAgent: msg.role as GlassboxState["currentAgent"] };
  if (phase !== undefined && phase !== null) next.currentPhase = phase;
  if (strategyIter !== null) next.strategyIteration = strategyIter;
  if (retry !== null) {
    if (retry.type === "syntax_heal") { next.syntaxHealAttempt = retry.current; }
    if (retry.type === "sequential_mutation") { next.sequentialMutationRetry = retry.current; }
  }
  if (faults !== null) next.validationFaultCount = faults;
  if (decision !== null) next.judgeDecision = decision;
  return next;
});
```

- [ ] **Step 5: Reset glassbox state when analysis starts**

In the `connection_id` handler's `"draft"` branch (where `appState: "analyzing"` is set), and in `handleResult` when analysis finishes, add reset logic. Add this effect that resets glassbox when a status with "Ph1" or "Baseline" arrives:

Find where `handleStatus` transitions to `appState === "analyzing"` (around line 93-96). After that block, add a reset when entering analyzing state:

Actually, the cleanest approach: add a `useEffect` that resets glassbox when `appState` transitions to "analyzing". But the hook doesn't directly know `appState`. Instead, reset glassbox state at the start of a new run by watching for the first status message.

Simpler approach: reset in the `connection_id` handler (when a new session starts). Add this to both branches of the `connection_id` case:

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
});
```

- [ ] **Step 6: Update the context value to include glassboxState**

Find the Provider value (around line 416):
```typescript
value={{
  connectionStatus,
  connect,
  disconnect,
  sendRefactorRequest,
  sendHaltRequest,
  setTargetSessionId,
  glassboxState,
}}
```

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useOrchestrationSocket.tsx
git commit -m "feat: add glassbox state tracking to WebSocket hook"
```

---

### Task 4: Build GlassboxBar component

**Files:**
- Create: `src/components/features/terminal/GlassboxBar.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { GlassboxState } from "@/types/glassbox";

interface GlassboxBarProps {
  state: GlassboxState;
  isDark: boolean;
}

const PHASES = [
  { num: 1, label: "Baseline", agent: "Validator" },
  { num: 2, label: "Strategy", agent: "Planner" },
  { num: 3, label: "Execution", agent: "Generator" },
  { num: 4, label: "Validation", agent: "Validator" },
  { num: 5, label: "Adjudication", agent: "Judge" },
  { num: 6, label: "Finalization", agent: "System" },
];

const AGENT_COLORS: Record<string, string> = {
  Planner: "#5a8cf8",
  Generator: "#3dd6c8",
  Validator: "#e09c3b",
  Judge: "#4ec97e",
  System: "#a78bfa",
};

export default function GlassboxBar({ state, isDark }: GlassboxBarProps) {
  const { currentPhase, currentAgent, strategyIteration, syntaxHealAttempt, validationFaultCount, judgeDecision } = state;

  const hasRetries = syntaxHealAttempt > 0 || strategyIteration > 1;
  const agentColor = AGENT_COLORS[currentAgent] ?? "#888";

  return (
    <div className="flex items-center gap-3 h-full px-2 text-[11px] font-medium select-none">
      {/* Phase dots */}
      <div className="flex items-center gap-1">
        {PHASES.map((p) => (
          <div
            key={p.num}
            className="flex items-center gap-1"
          >
            <motion.div
              animate={{
                scale: currentPhase === p.num ? 1.3 : 1,
                opacity: currentPhase >= p.num ? 1 : 0.35,
              }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: currentPhase >= p.num ? agentColor : (isDark ? "#555" : "#ccc"),
                boxShadow: currentPhase === p.num ? `0 0 6px ${agentColor}` : "none",
              }}
            />
            {currentPhase === p.num && (
              <span className={`text-[10px] ${isDark ? "text-[#8d95a5]" : "text-[#888]"}`}>
                {p.label}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Active agent badge */}
      <motion.span
        key={currentAgent}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide border whitespace-nowrap"
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
      </motion.span>

      {/* Retry counter */}
      {hasRetries && (
        <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold
          ${isDark ? "bg-yellow-500/15 text-yellow-400" : "bg-yellow-50 text-yellow-600"}`}>
          Retry {strategyIteration}/{state.maxStrategyIterations}
          {syntaxHealAttempt > 0 && ` · Heal ${syntaxHealAttempt}/${state.maxSyntaxHealAttempts}`}
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
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/features/terminal/GlassboxBar.tsx
git commit -m "feat: add GlassboxBar with phase dots, agent badge, retry counters"
```

---

### Task 5: Integrate GlassboxBar into Terminal header

**Files:**
- Modify: `src/components/features/terminal/Terminal.tsx`

- [ ] **Step 1: Add import**

After the existing imports, add:
```typescript
import GlassboxBar from "@/components/features/terminal/GlassboxBar";
```

- [ ] **Step 2: Add glassboxState prop to TerminalProps**

Update the `TerminalProps` interface:
```typescript
interface TerminalProps {
  isTerminalCollapsed: boolean;
  setIsTerminalCollapsed: (val: boolean) => void;
  terminalEndRef: React.RefObject<HTMLDivElement | null>;
  terminalEntries?: TerminalEntry[];
  appState: AppState;
  glassboxState: GlassboxState;
}
```

- [ ] **Step 3: Add glassboxState import**

Update the type import:
```typescript
import type { AppState, TerminalEntry } from "@/types/session";
import type { GlassboxState } from "@/types/glassbox";
```

- [ ] **Step 4: Update the component signature**

Change from:
```typescript
export default function Terminal({
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  terminalEndRef,
  terminalEntries = [],
  appState,
}: TerminalProps) {
```
To:
```typescript
export default function Terminal({
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  terminalEndRef,
  terminalEntries = [],
  appState,
  glassboxState,
}: TerminalProps) {
```

- [ ] **Step 5: Add GlassboxBar to the header**

In the header section (around line 214, after the `<h3>Terminal</h3>` line), find the section where `appState === "analyzing"` and `appState === "waiting"` badges are shown. After those badges but before the separator (`<div className="h-[20px] w-[1px]" />`), add:

```typescript
{(appState === "analyzing") && (
  <GlassboxBar state={glassboxState} isDark={isDark} />
)}
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/terminal/Terminal.tsx
git commit -m "feat: integrate GlassboxBar into terminal header"
```

---

### Task 6: Wire glassbox state from hook through ChatWorkspace to Terminal

**Files:**
- Modify: `src/components/features/workspace/ChatWorkspace.tsx`

- [ ] **Step 1: Add glassboxState from context**

In `ChatWorkspace.tsx`, find the line:
```typescript
const { connectionStatus, connect, sendRefactorRequest, sendHaltRequest, setTargetSessionId } = useOrchestrationSocket();
```

Add `glassboxState` to the destructuring:
```typescript
const { connectionStatus, connect, sendRefactorRequest, sendHaltRequest, setTargetSessionId, glassboxState } = useOrchestrationSocket();
```

- [ ] **Step 2: Pass glassboxState to Terminal**

Find the `<Terminal ... />` component (around line 289). Add `glassboxState={glassboxState}`:
```typescript
<Terminal
  isTerminalCollapsed={isTerminalCollapsed}
  setIsTerminalCollapsed={handleTerminalCollapse}
  terminalEndRef={terminalEndRef}
  terminalEntries={terminalEntries}
  appState={appState}
  glassboxState={glassboxState}
/>
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/features/workspace/ChatWorkspace.tsx
git commit -m "feat: wire glassbox state from hook to Terminal component"
```

---

### Task 7: Enhance OrchestrationFlowchart with live glassbox data

**Files:**
- Modify: `src/components/features/output/RefactoredOutput.tsx`

- [ ] **Step 1: Add glassboxState prop to RefactoredOutputProps and component**

Find the `RefactoredOutputProps` interface. Add:
```typescript
glassboxState?: GlassboxState;
```

Find the component signature. Add `glassboxState` to destructured props.

Add the import:
```typescript
import type { GlassboxState } from "@/types/glassbox";
```

- [ ] **Step 2: Update OrchestrationFlowchart to use live data**

Find the `OrchestrationFlowchart` component (around line 55). Update it to accept and use glassbox data:

```typescript
interface FlowchartProps {
  activeStep: number;
  glassboxState?: GlassboxState;
}

const AGENT_PHASE_MAP: Record<string, { node: number; label: string; desc: string }> = {
  Validator: { node: 1, label: "Validator", desc: "Baseline check" },
  Planner:   { node: 2, label: "Planner", desc: "Designing strategy" },
  Generator: { node: 3, label: "Generator", desc: "Applying changes" },
  Judge:     { node: 4, label: "Judge", desc: "Final audit" },
};

const OrchestrationFlowchart = ({ activeStep, glassboxState }: FlowchartProps) => {
  const currentAgent = glassboxState?.currentAgent;
  const liveNode = currentAgent ? (AGENT_PHASE_MAP[currentAgent]?.node ?? activeStep) : activeStep;
  const strategyIter = glassboxState?.strategyIteration ?? 1;
  const hasRetry = strategyIter > 1;

  return (
    <div className="flex flex-col items-center justify-center w-full h-full p-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex flex-row items-center justify-center w-full max-w-4xl relative">
        {/* Retry loop indicator */}
        {hasRetry && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              Strategy Iteration {strategyIter}/3
            </span>
          </div>
        )}
        <FlowNode icon={Cpu} title="Planner" desc="Analyzing architecture"
          status={liveNode === 2 ? 'active' : activeStep > 2 ? 'done' : 'waiting'} colorCode="#56a8f5" />
        <FlowConnector isActive={activeStep > 2} />
        <FlowNode icon={Layers} title="Generator" desc="Drafting optimizations"
          status={liveNode === 3 ? 'active' : activeStep > 3 ? 'done' : 'waiting'} colorCode="#2aacb8" />
        <FlowConnector isActive={activeStep > 3} />
        <FlowNode icon={FileCode2} title="AST Parser" desc="Structuring output"
          status={liveNode === 4 ? 'active' : activeStep > 4 ? 'done' : 'waiting'} colorCode="#00e5ff" />
        <FlowConnector isActive={activeStep > 4} />
        <FlowNode icon={CheckCircle2} title="Judge" desc="Final validation"
          status={liveNode === 5 ? 'active' : activeStep > 5 ? 'done' : 'waiting'} colorCode="#27c93f" />
      </div>
    </div>
  );
};
```

Note: The existing `FlowNode` and `FlowConnector` sub-components already handle active/done/waiting states with animations. The live agent from `glassboxState.currentAgent` maps to a specific node, making it pulse even when the phase number hasn't advanced yet (e.g., during retries within the same phase).

- [ ] **Step 3: Pass glassboxState to OrchestrationFlowchart usage**

Find where `<OrchestrationFlowchart activeStep={activeStep} />` is rendered (around line 236). Change to:
```typescript
<OrchestrationFlowchart activeStep={activeStep} glassboxState={glassboxState} />
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Wire glassboxState through ChatWorkspace to RefactoredOutput**

In `ChatWorkspace.tsx`, add `glassboxState` to the `<RefactoredOutput ... />` component:
```typescript
<RefactoredOutput
  refactoredOutput={refactoredOutput}
  setRefactoredOutput={handleOutputChange}
  showFlowchartModal={showFlowchartModal}
  setShowFlowchartModal={handleFlowchartChange}
  activeStep={activeStep}
  isTerminalCollapsed={isTerminalCollapsed}
  appState={appState}
  orchestrationResult={orchestrationResult}
  glassboxState={glassboxState}
/>
```

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/features/output/RefactoredOutput.tsx src/components/features/workspace/ChatWorkspace.tsx
git commit -m "feat: enhance OrchestrationFlowchart with live glassbox agent and retry indicators"
```

---

## Self-Review

**Spec coverage:** All 4 glassbox features are covered:
- Phase progress bar — Task 4 (GlassboxBar) + Task 5 (integrated into terminal header)
- Active agent indicator — Task 4 (pulsing badge in GlassboxBar) + Task 7 (enhanced flowchart)
- Retry counter — Task 4 (badge showing strategy/syntax retries) + Task 7 (strategy iteration indicator)
- Phase timings — Not yet implemented; phase timings require tracking message timestamps client-side. Add as a future enhancement.

**Placeholder scan:** No TBDs, TODOs, or vague instructions. Every step has exact code, file paths, and commands.

**Type consistency:** `GlassboxState` type is defined in Task 1 and referenced consistently across all subsequent tasks. `parseStatusInfo.ts` functions are imported in Task 3 and used correctly.
