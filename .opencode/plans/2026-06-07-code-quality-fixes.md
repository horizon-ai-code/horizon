# Code Quality Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 15 code quality, maintainability, and reliability issues identified in audit across 12 source files.

**Architecture:** Each task is file-isolated where possible; sequential execution if files overlap. No new dependencies introduced. All changes are backward-compatible — no behavior changes, only correctness and quality improvements.

**Tech Stack:** TypeScript, Next.js 16, React 19, Zustand, Framer Motion, react-resizable-panels

---

### Task 1: Extract shared metric builder utility

**Problem:** Identical `buildMetrics()` function duplicated in `useChatStore.ts` and `useOrchestrationSocket.tsx`. Will drift on next change.

**Files:**
- Create: `src/lib/utils/buildMetrics.ts`
- Modify: `src/hooks/useOrchestrationSocket.tsx` (remove inline buildMetrics, import shared)
- Modify: `src/store/useChatStore.ts` (remove inline buildMetrics, import shared)

- [ ] **Step 1: Create `src/lib/utils/buildMetrics.ts`**

```typescript
import type { InsightMetric } from "@/types/insights";
import type { PerformanceMetrics } from "@/types/websocket";

export function buildMetrics(
  original_complexity: number | null,
  refactored_complexity: number | null,
  performance?: PerformanceMetrics
): InsightMetric[] {
  const metrics: InsightMetric[] = [];

  if (refactored_complexity !== null) {
    metrics.push({
      title: "Cyclomatic Complexity",
      before: original_complexity !== null ? `${original_complexity}` : "—",
      after: `${refactored_complexity}`,
      direction:
        original_complexity !== null
          ? refactored_complexity < original_complexity
            ? "down" as const
            : refactored_complexity > original_complexity
              ? "up" as const
              : "neutral" as const
          : refactored_complexity <= 5
            ? "down" as const
            : "up" as const,
      iconKey: "CheckCircle",
    });
  }

  if (performance) {
    const memUsed = performance.avg_gpu_memory_used ?? 0;
    const memPercent = performance.avg_gpu_memory ?? 0;
    const gpuUtil = performance.avg_gpu_utilization ?? 0;
    const infTime = performance.inference_time ?? 0;

    metrics.push({
      title: "Inference Time",
      before: "—",
      after: `${infTime}s`,
      direction: "neutral" as const,
      iconKey: "Clock",
    });

    metrics.push({
      title: "Avg GPU Utilization",
      before: "—",
      after: `${gpuUtil}%`,
      direction: "neutral" as const,
      iconKey: "Cpu",
    });

    metrics.push({
      title: "Avg GPU Memory",
      before: "—",
      after: `${(memUsed / (1024 * 1024 * 1024)).toFixed(2)} GB (${memPercent}%)`,
      direction: "neutral" as const,
      iconKey: "Layers",
    });
  }

  return metrics;
}
```

- [ ] **Step 2: Update `src/hooks/useOrchestrationSocket.tsx` — replace inline buildMetrics with import**

Add import at top (after line 8):
```typescript
import { buildMetrics } from "@/lib/utils/buildMetrics";
```

Remove the entire `buildMetrics` function (lines 351-411).

- [ ] **Step 3: Update `src/store/useChatStore.ts` — replace inline buildMetrics with import**

Add import at top:
```typescript
import { buildMetrics } from "@/lib/utils/buildMetrics";
```

Replace the inline metric-building block (lines 341-383) with:
```typescript
oResult.metrics = buildMetrics(
  detail.original_complexity ?? null,
  detail.refactored_complexity ?? null,
  detail.avg_gpu_utilization !== undefined ? {
    avg_gpu_utilization: detail.avg_gpu_utilization,
    avg_gpu_memory: detail.avg_gpu_memory,
    avg_gpu_memory_used: detail.avg_gpu_memory_used,
    inference_time: detail.inference_time,
  } : undefined
);
```

- [ ] **Step 4: Build + test**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors.

Run: `npm test`
Expected: All 71 tests pass (no behavior change).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/buildMetrics.ts src/hooks/useOrchestrationSocket.tsx src/store/useChatStore.ts
git commit -m "refactor: extract shared buildMetrics utility to lib/utils"
```

---

### Task 2: Fix WebSocket hook — stale closure, type assertions, JSON.stringify safety

**Problem:** (1) `ws.onmessage` captures handlers from `connect()` closure; if handlers change identity (deps change), WS still uses old versions. (2) Unnecessary `as` type assertions bypass discriminant narrowing. (3) `JSON.stringify` can throw on circular refs.

**Files:**
- Modify: `src/hooks/useOrchestrationSocket.tsx`

- [ ] **Step 1: Store handlers in refs to fix stale closure**

After the `useCallback` definitions for `handleStatus`, `handleResult`, `handleError` (after line 172), add:

```typescript
const handleStatusRef = useRef(handleStatus);
const handleResultRef = useRef(handleResult);
const handleErrorRef = useRef(handleError);

useEffect(() => { handleStatusRef.current = handleStatus; }, [handleStatus]);
useEffect(() => { handleResultRef.current = handleResult; }, [handleResult]);
useEffect(() => { handleErrorRef.current = handleError; }, [handleError]);
```

- [ ] **Step 2: Update `ws.onmessage` to use refs instead of closure variables**

In the `ws.onmessage` handler (lines 210-238), replace:
```typescript
case "status":
  handleStatus(msg as StatusMessage, targetId);
  break;
case "result":
  handleResult(msg as ResultMessage, targetId);
  break;
case "error":
  handleError(msg as ServerMessage & { type: "error" }, targetId);
  break;
```

With:
```typescript
case "status":
  handleStatusRef.current(msg, targetId);
  break;
case "result":
  handleResultRef.current(msg, targetId);
  break;
case "error":
  handleErrorRef.current(msg, targetId);
  break;
```

TypeScript's discriminated union narrowing on `msg.type` already narrows `msg` to the correct subtype within each case — no casts needed.

- [ ] **Step 3: Wrap JSON.stringify in try/catch in sendRefactorRequest**

Replace line 289:
```typescript
wsRef.current.send(JSON.stringify(request));
```
With:
```typescript
try {
  wsRef.current.send(JSON.stringify(request));
} catch (err) {
  console.error("[WS] Failed to serialize request:", err);
  return false;
}
```

- [ ] **Step 4: Wrap JSON.stringify in try/catch in sendHaltRequest**

Replace line 304:
```typescript
wsRef.current.send(JSON.stringify({ type: "halt" }));
```
With:
```typescript
try {
  wsRef.current.send(JSON.stringify({ type: "halt" }));
} catch (err) {
  console.error("[WS] Failed to serialize halt request:", err);
  return false;
}
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useOrchestrationSocket.tsx
git commit -m "fix: use refs for WS handlers to avoid stale closures, remove unsafe type assertions, wrap JSON.stringify in try/catch"
```

---

### Task 3: Fix ChatWorkspace — defeated useMemo, inline callbacks, collapsedSize

**Problem:** (1) `useMemo` depends on `store.sessions` (always new object ref). (2) Inline `(val) => updateLocal(...)` callbacks create new functions every render. (3) `collapsedSize={40}` means 40%, not collapsed.

**Files:**
- Modify: `src/components/features/workspace/ChatWorkspace.tsx`

- [ ] **Step 1: Use individual Zustand selectors instead of the whole store**

Replace:
```typescript
const store = useChatStore();
```
With individual selectors:
```typescript
const sessions = useChatStore((s) => s.sessions);
const draftSession = useChatStore((s) => s.draftSession);
const updateSession = useChatStore((s) => s.updateSession);
const updateDraftSession = useChatStore((s) => s.updateDraftSession);
const fetchSessionDetails = useChatStore((s) => s.fetchSessionDetails);
```

- [ ] **Step 2: Replace defeated useMemo with inline derived state**

Replace lines 66-80:
```typescript
const activeSession = useMemo(() => {
  if (!id) return { ...store.draftSession, id: "draft" };
  return store.sessions[id] || { ... };
}, [id, store.sessions, store.draftSession]);
```

With:
```typescript
const activeSession = id
  ? (sessions[id] ?? {
      id,
      sourceCode: INITIAL_SOURCE,
      refactoredOutput: "",
      activeStep: 0,
      inputInstruction: "",
      terminalEntries: [],
      isTerminalCollapsed: false,
      appState: "idle" as const,
      showFlowchartModal: false,
      orchestrationResult: EMPTY_ORCHESTRATION_RESULT,
      title: "",
      createdAt: 0,
      updatedAt: 0,
    })
  : { ...draftSession, id: "draft" };
```

- [ ] **Step 3: Fix updateLocal useCallback deps**

Replace:
```typescript
const updateLocal = useCallback((data: Partial<SessionData>) => {
  if (id) {
    store.updateSession(id, data);
  } else {
    store.updateDraftSession(data);
  }
}, [id, store]);
```

With:
```typescript
const updateLocal = useCallback((data: Partial<SessionData>) => {
  if (id) {
    updateSession(id, data);
  } else {
    updateDraftSession(data);
  }
}, [id, updateSession, updateDraftSession]);
```

- [ ] **Step 4: Update fetchSessionDetails call to use the selector**

In the useEffect at line 54, replace:
```typescript
const session = useChatStore.getState().sessions[id];
const success = await store.fetchSessionDetails(id);
```

With:
```typescript
const session = useChatStore.getState().sessions[id];
const success = await fetchSessionDetails(id);
```

- [ ] **Step 5: Add stable memoized callbacks for inline handlers**

Add before the return:
```typescript
const handleSourceChange = useCallback((val: string) => updateLocal({ sourceCode: val }), [updateLocal]);
const handleInputChange = useCallback((val: string) => updateLocal({ inputInstruction: val }), [updateLocal]);
const handleOutputChange = useCallback((val: string) => updateLocal({ refactoredOutput: val }), [updateLocal]);
const handleSourceErrorChange = useCallback(setLocalSourceError, []);
const handleInputErrorChange = useCallback(setLocalInputError, []);
const handleFlowchartChange = useCallback((val: boolean) => updateLocal({ showFlowchartModal: val }), [updateLocal]);
const handleTerminalCollapse = useCallback((val: boolean) => updateLocal({ isTerminalCollapsed: val }), [updateLocal]);
```

Then in JSX, replace inline callbacks with these handlers.

- [ ] **Step 6: Fix collapsedSize**

Change `collapsedSize={40}` to `collapsedSize={0}` (line 262).

- [ ] **Step 7: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/features/workspace/ChatWorkspace.tsx
git commit -m "fix: use individual Zustand selectors, memoize callbacks, fix collapsedSize"
```

---

### Task 4: Fix RefactoringReplay useEffect

**Problem:** Effect depends on `replaySteps.length` but not `replaySteps`. New array with same length won't reset state.

**Files:**
- Modify: `src/components/features/output/RefactoringReplay.tsx`

- [ ] **Step 1: Fix the useEffect**

Replace:
```typescript
useEffect(() => {
  if (currentReplayStep >= replaySteps.length) {
    requestAnimationFrame(() => setCurrentReplayStep(0));
  }
}, [currentReplayStep, replaySteps.length]);
```

With:
```typescript
useEffect(() => {
  setCurrentReplayStep(0);
}, [replaySteps]);
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/output/RefactoringReplay.tsx
git commit -m "fix: reset replay step when replaySteps array reference changes"
```

---

### Task 5: Fix type safety in CodeEditorPanel

**Problem:** `sanitizeTheme(theme: any)` uses `any` type.

**Files:**
- Modify: `src/components/features/editor/CodeEditorPanel.tsx`

- [ ] **Step 1: Add ThemeStyle interface and fix the function**

Replace lines 16-26:
```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sanitizeTheme = (theme: any) => {
  const cleanTheme = JSON.parse(JSON.stringify(theme));
  Object.keys(cleanTheme).forEach(key => {
    if (cleanTheme[key].background) {
      cleanTheme[key].backgroundColor = cleanTheme[key].background;
      delete cleanTheme[key].background;
    }
  });
  return cleanTheme;
};
```

With:
```typescript
interface ThemeStyle {
  [key: string]: React.CSSProperties & { background?: string; backgroundColor?: string };
}

const sanitizeTheme = (theme: ThemeStyle): ThemeStyle => {
  const cleanTheme = JSON.parse(JSON.stringify(theme)) as ThemeStyle;
  for (const key of Object.keys(cleanTheme)) {
    const style = cleanTheme[key];
    if (style.background) {
      style.backgroundColor = style.background;
      delete style.background;
    }
  }
  return cleanTheme;
};
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/editor/CodeEditorPanel.tsx
git commit -m "fix: replace any type with proper ThemeStyle interface in sanitizeTheme"
```

---

### Task 6: Fix store — typed API responses + remove unused INITIAL_REFACTORED

**Problem:** (1) `res.json()` responses in `fetchHistory` and `fetchSessionDetails` are untyped. (2) `INITIAL_REFACTORED` exported but never consumed.

**Files:**
- Modify: `src/store/useChatStore.ts`
- Modify: `src/lib/constants.ts`
- Modify: `src/lib/__tests__/constants.test.ts`

- [ ] **Step 1: Add response type interfaces at the top of useChatStore.ts**

Add after existing imports:
```typescript
interface HistoryItemResponse {
  id?: string;
  user_instruction?: string;
}

interface SessionDetailResponse {
  id?: string;
  user_instruction?: string;
  original_code?: string;
  refactored_code?: string;
  logs?: Array<{
    id?: string;
    role?: string;
    status?: string;
  }>;
  insights?: string;
  original_complexity?: number;
  refactored_complexity?: number;
  planner_model?: string;
  generator_model?: string;
  judge_model?: string;
  avg_gpu_utilization?: number;
  avg_gpu_memory?: number;
  avg_gpu_memory_used?: number;
  inference_time?: number;
  created_at?: string;
}
```

- [ ] **Step 2: Type the res.json() calls**

In `fetchHistory`, replace:
```typescript
const items: Array<{ id?: string; user_instruction?: string }> = await res.json();
```
With:
```typescript
const items: HistoryItemResponse[] = await res.json();
```

In `fetchSessionDetails`, replace:
```typescript
const detail = await res.json();
```
With:
```typescript
const detail: SessionDetailResponse = await res.json();
```

- [ ] **Step 3: Remove unused INITIAL_REFACTORED from constants.ts**

Delete the line: `export const INITIAL_REFACTORED = \`\`;`

- [ ] **Step 4: Remove unused INITIAL_REFACTORED import/export from store**

Update import to: `import { INITIAL_SOURCE, EMPTY_ORCHESTRATION_RESULT, ROLE_VISUALS, DEFAULT_ROLE_VISUALS } from '@/lib/constants';`

Update export to: `export { INITIAL_SOURCE, EMPTY_ORCHESTRATION_RESULT };`

- [ ] **Step 5: Update constants test**

In `src/lib/__tests__/constants.test.ts`:
- Remove `INITIAL_REFACTORED` from the import
- Remove the `it('INITIAL_REFACTORED is empty string', ...)` test block

- [ ] **Step 6: Build + test**

Run: `npm run build` and `npm test`
Expected: Both pass.

- [ ] **Step 7: Commit**

```bash
git add src/store/useChatStore.ts src/lib/constants.ts src/lib/__tests__/constants.test.ts
git commit -m "fix: type API responses, remove unused INITIAL_REFACTORED"
```

---

### Task 7: Fix TerminalEntry type mismatch

**Problem:** Local `TerminalEntry` type in Terminal.tsx duplicates canonical type with extra `timestamp?` and `"divider"` type variant. `timestamp` is always `undefined` because it's never set.

**Files:**
- Modify: `src/types/session.ts`
- Modify: `src/hooks/useOrchestrationSocket.tsx`
- Modify: `src/components/features/terminal/Terminal.tsx`

- [ ] **Step 1: Update canonical TerminalEntry type in session.ts**

Add `timestamp` as an optional field and `"divider"` to the type union:

```typescript
export interface TerminalEntry {
  id: string;
  type: 'command' | 'log' | 'system' | 'error' | 'divider';
  text: string;
  colorClass?: string;
  icon?: string;
  timestamp?: string;
}
```

- [ ] **Step 2: Populate timestamp in makeTerminalEntry in the hook**

In `useOrchestrationSocket.tsx`, update `makeTerminalEntry` to include timestamp:

```typescript
const makeTerminalEntry = (
  type: TerminalEntry["type"],
  text: string,
  icon?: string,
  colorClass?: string
): TerminalEntry => ({
  id: `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  type,
  text,
  icon,
  colorClass,
  timestamp: new Date().toLocaleTimeString("en-US", { hour12: false }),
});
```

- [ ] **Step 3: Remove local TerminalEntry type from Terminal.tsx**

Delete the local `interface TerminalEntry` (lines 27-34).

Update the import from:
```typescript
import type { AppState } from "@/types/session";
```
To:
```typescript
import type { AppState, TerminalEntry } from "@/types/session";
```

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/types/session.ts src/hooks/useOrchestrationSocket.tsx src/components/features/terminal/Terminal.tsx
git commit -m "fix: sync TerminalEntry types, populate timestamp in makeTerminalEntry"
```

---

### Task 8: Fix accessibility issues

**Problem:** (1) Navbar buttons missing `aria-label`. (2) Copy button uses `title` not `aria-label`. (3) Sidebar uses `<motion.div>` instead of `<motion.aside>`.

**Files:**
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/features/output/RefactoredOutput.tsx`
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add aria-labels to Navbar buttons**

In `Navbar.tsx`, add `aria-label="Horizon AI"` to the first button (line 34) and `aria-label="Refactoring Studio"` to the second button (line 38).

- [ ] **Step 2: Add aria-label to copy button in RefactoredOutput**

In `RefactoredOutput.tsx`, add `aria-label="Copy Code"` to the copy button (line 150).

- [ ] **Step 3: Change Sidebar from motion.div to motion.aside**

In `Sidebar.tsx`, change `<motion.div` (line 163) to `<motion.aside` and the closing `</motion.div>` (line 391) to `</motion.aside>`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Navbar.tsx src/components/features/output/RefactoredOutput.tsx src/components/layout/Sidebar.tsx
git commit -m "fix: add aria-labels to nav/copy buttons, use semantic motion.aside for sidebar"
```

---

## Self-Review

**Spec coverage:** All 15 issues from the audit report are covered across 8 tasks:
- Task 1: Duplicated metric logic (#2 in Top 3)
- Task 2: Stale WS handler closure (#1 in Top 3), type assertions, JSON.stringify safety
- Task 3: Defeated useMemo + inline callbacks (#3 in Top 3), collapsedSize bug
- Task 4: ReplayStep useEffect bug
- Task 5: `any` in CodeEditorPanel
- Task 6: Untyped res.json(), unused INITIAL_REFACTORED
- Task 7: TerminalEntry type mismatch
- Task 8: Accessibility (Navbar, Copy button, Sidebar)

**Placeholder scan:** No TBDs, TODOs, or vague instructions. Every step has exact code, file paths, and commands.

**Type consistency:** All type imports/exports referenced match the actual source code. No method signatures changed.

**Integration safety:** Tasks are ordered so dependent file changes happen before files that consume them (e.g., Task 1 creates `buildMetrics.ts` before Tasks that reference it).
