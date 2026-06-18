# Backend API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the Horizon AI frontend to match the deployed backend API — fix WebSocket protocol gaps (heartbeat, insights, halt_acknowledged, reconnect, exit_status), align REST handling, and update types.

**Architecture:** Sequential tasks ordered by dependency (types first, then hook, then store, then UI). Tasks 2-5 all modify `useOrchestrationSocket.tsx` and are batched into a single implementation task to avoid merge conflicts.

**Tech Stack:** TypeScript, Next.js 16, React 19, Zustand

---

### Task 1: Update WebSocket types to match API

**Files:**
- Modify: `src/types/websocket.ts`

- [ ] **Step 1: Add new server message types**

Add before the `ServerMessage` type alias:

```typescript
export type ExitStatus =
  | "SUCCESS"
  | "ABORT_STRATEGY"
  | "ABORT_SYNTAX"
  | "ABORT_SEMANTIC"
  | "PROCESSING";

export interface PingMessage {
  type: "ping";
  id: string;
  ts: string;
}

export interface HaltAcknowledgedMessage {
  type: "halt_acknowledged";
  id: string;
}

export interface InsightItem {
  title: string;
  details: string;
}

export interface InsightsMessage {
  type: "insights";
  id: string;
  insights: InsightItem[] | string;
}
```

- [ ] **Step 2: Add new client message types**

```typescript
export interface PongRequest {
  type: "pong";
}

export interface ReconnectRequest {
  type: "reconnect";
  session_id: string;
}
```

- [ ] **Step 3: Update ResultMessage**

Replace the existing `ResultMessage` interface:
```typescript
export interface ResultMessage {
  type: "result";
  id: string;
  code: string;
  exit_status: ExitStatus;
  original_complexity: number | null;
  refactored_complexity: number | null;
  performance: PerformanceMetrics;
  planner_model: string | null;
  generator_model: string | null;
  judge_model: string | null;
}
```

Note: Removed `insights`, added `exit_status`, made `performance` required, model fields are `string | null` not optional.

- [ ] **Step 4: Update ServerMessage union**

```typescript
export type ServerMessage =
  | ConnectionIdMessage
  | PingMessage
  | StatusMessage
  | ResultMessage
  | InsightsMessage
  | HaltAcknowledgedMessage
  | ErrorMessage;
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build succeeds (these types aren't consumed yet, so no new errors).

- [ ] **Step 6: Commit**

```bash
git add src/types/websocket.ts
git commit -m "feat: update WebSocket types to match backend API — add ping/insights/halt_acknowledged/exit_status"
```

---

### Task 2: Wire up heartbeat, insights, halt_acknowledged, reconnect, exit_status in hook

**Files:**
- Modify: `src/hooks/useOrchestrationSocket.tsx`
- Modify: `src/types/session.ts`

This is the largest task. All WebSocket protocol fixes go into `useOrchestrationSocket.tsx`.

- [ ] **Step 1: Update import in useOrchestrationSocket.tsx**

Replace:
```typescript
import type { RefactorRequest, ServerMessage, StatusMessage, ResultMessage } from "@/types/websocket";
```
With:
```typescript
import type { RefactorRequest, ServerMessage, StatusMessage, ResultMessage, InsightsMessage } from "@/types/websocket";
```

- [ ] **Step 2: Add refs for new handlers**

After the existing refs for handleStatusRef etc (around line 182), add refs for new handlers:
```typescript
// These will be defined next — forward declare with placeholder refs
const handleInsightsRef = useRef<(msg: InsightsMessage, targetId: string) => void>(() => {});
const handleHaltAckRef = useRef<(targetId: string) => void>(() => {});
```

- [ ] **Step 3: Add heartbeat handler in ws.onmessage**

In the `ws.onmessage` switch statement, add before `case "status":`:
```typescript
case "ping":
  if (wsRef.current?.readyState === WebSocket.OPEN) {
    wsRef.current.send(JSON.stringify({ type: "pong" }));
  }
  break;
```

- [ ] **Step 4: Add insights and halt_acknowledged cases**

After `case "result":`, add:
```typescript
case "insights":
  handleInsightsRef.current(msg, targetId);
  break;
case "halt_acknowledged":
  handleHaltAckRef.current(targetId);
  break;
```

- [ ] **Step 5: Update handleResult to use exit_status**

Replace the `handleResult` callback:
```typescript
const handleResult = useCallback(
  (msg: ResultMessage, targetId: string) => {
    const isSuccess = msg.exit_status === "SUCCESS";

    const doneEntry = makeTerminalEntry(
      "log",
      isSuccess
        ? "[System]: Refactoring cycle complete. Output ready."
        : `[System]: Refactoring failed — ${msg.exit_status}. Original code preserved.`,
      isSuccess ? "CheckCircle2" : "AlertCircle",
      isSuccess ? "text-[#27c93f]" : "text-[#f93e3e]"
    );

    const orchestrationResult: OrchestrationResult = {
      ...EMPTY_ORCHESTRATION_RESULT,
      exit_status: msg.exit_status,
      original_complexity: msg.original_complexity,
      refactored_complexity: msg.refactored_complexity,
      performance: msg.performance,
      planner_model: msg.planner_model,
      generator_model: msg.generator_model,
      judge_model: msg.judge_model,
      metrics: buildMetrics(msg.original_complexity, msg.refactored_complexity, msg.performance),
    };

    updateSession(targetId, (prev: SessionData) => ({
      activeStep: isSuccess ? 5 : 0,
      terminalEntries: [...prev.terminalEntries, doneEntry],
      refactoredOutput: msg.code,
      orchestrationResult,
      appState: (isSuccess ? "done" : "idle") as AppState,
      showFlowchartModal: isSuccess ? false : prev.showFlowchartModal,
    }));
  },
  [updateSession]
);
```

Note: Need to also import `AppState` from `@/types/session` — add it to the import:
```typescript
import type { TerminalEntry, SessionData, OrchestrationResult, AppState } from "@/types/session";
```

- [ ] **Step 6: Add handleInsights callback**

Add after `handleResult`:
```typescript
const handleInsights = useCallback(
  (msg: InsightsMessage, targetId: string) => {
    const insightsStr = Array.isArray(msg.insights)
      ? msg.insights.map((i) => `${i.title}: ${i.details}`).join("\n")
      : msg.insights;

    updateSession(targetId, (prev: SessionData) => ({
      orchestrationResult: {
        ...prev.orchestrationResult,
        insights: insightsStr,
        summary: insightsStr,
      },
    }));
  },
  [updateSession]
);
```

- [ ] **Step 7: Add handleHaltAcknowledged callback**

```typescript
const handleHaltAck = useCallback(
  (targetId: string) => {
    const entry = makeTerminalEntry(
      "system",
      "[System]: Halt acknowledged. Orchestration cancelled."
    );

    updateSession(targetId, (prev: SessionData) => ({
      terminalEntries: [...prev.terminalEntries, entry],
      appState: "idle" as AppState,
      showFlowchartModal: false,
    }));
  },
  [updateSession]
);
```

- [ ] **Step 8: Wire up refs**

Update the ref assignments around line 176-182 to include new handlers:
```typescript
const handleStatusRef = useRef(handleStatus);
const handleResultRef = useRef(handleResult);
const handleErrorRef = useRef(handleError);
const handleInsightsRef = useRef(handleInsights);
const handleHaltAckRef = useRef(handleHaltAck);

useEffect(() => { handleStatusRef.current = handleStatus; }, [handleStatus]);
useEffect(() => { handleResultRef.current = handleResult; }, [handleResult]);
useEffect(() => { handleErrorRef.current = handleError; }, [handleError]);
useEffect(() => { handleInsightsRef.current = handleInsights; }, [handleInsights]);
useEffect(() => { handleHaltAckRef.current = handleHaltAck; }, [handleHaltAck]);
```

- [ ] **Step 9: Add reconnect flow on WS open**

In `ws.onopen` (around line 207-212), after setting connection status, add:
```typescript
// Attempt to reconnect to previous session
const lastSessionId = typeof window !== "undefined"
  ? localStorage.getItem("lastSessionId")
  : null;
if (lastSessionId && sessionIdRef.current === null) {
  sessionIdRef.current = lastSessionId;
  try {
    ws.send(JSON.stringify({ type: "reconnect", session_id: lastSessionId }));
  } catch (err) {
    console.warn("[WS] Failed to send reconnect message:", err);
  }
}
```

- [ ] **Step 10: Store session ID in localStorage**

In the `connection_id` handler (around line 222-235), after receiving a connection_id, add:
```typescript
localStorage.setItem("lastSessionId", msg.id);
```

Put this in both branches (new draft session and existing session migration).

- [ ] **Step 11: Add exit_status to OrchestrationResult in session.ts**

In `src/types/session.ts`, add `exit_status` to `OrchestrationResult`:
```typescript
import type { PerformanceMetrics, ExitStatus } from "./websocket";

export interface OrchestrationResult {
  // ... existing fields ...
  exit_status?: ExitStatus;
  // ... rest stays the same ...
}
```

- [ ] **Step 12: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 13: Commit**

```bash
git add src/hooks/useOrchestrationSocket.tsx src/types/session.ts
git commit -m "feat: add heartbeat, insights, halt_acknowledged, reconnect, exit_status handling to WS hook"
```

---

### Task 3: Update REST error handling and insights parsing

**Files:**
- Modify: `src/store/useChatStore.ts`

- [ ] **Step 1: Differentiate 404 vs 409**

In `fetchSessionDetails`, replace the error handling block (lines 317-329):
```typescript
if (!res.ok) {
  const errorType = res.status === 404 ? "not_found" : res.status === 409 ? "system_busy" : "unknown";
  set((state) => ({
     ...state,
     sessions: {
       ...state.sessions,
       [id]: {
         ...(state.sessions[id] || { ...DEFAULT_SESSION, id }),
         error: errorType,
         isLoaded: true
       }
     }
  }));
  return false;
}
```

- [ ] **Step 2: Parse insights JSON string**

After constructing `oResult`, replace the lines that set summary/insights:
```typescript
// Parse insights JSON string
let parsedInsights = detail.insights || "";
if (typeof parsedInsights === "string" && parsedInsights.startsWith("[")) {
  try {
    const parsed = JSON.parse(parsedInsights);
    if (Array.isArray(parsed)) {
      parsedInsights = parsed.map((i: { title?: string; details?: string }) =>
        `${i.title || ""}: ${i.details || ""}`
      ).join("\n");
    }
  } catch {
    // Not valid JSON, use as-is
  }
}

oResult.summary = parsedInsights;
oResult.insights = parsedInsights;
```

- [ ] **Step 3: Update SessionDetailResponse to include log content + created_at**

Find the `SessionDetailResponse` interface and update the `logs` array type:
```typescript
logs?: Array<{
  id?: string;
  role?: string;
  status?: string;
  content?: string | null;
  created_at?: string;
}>;
```

- [ ] **Step 4: Use log.created_at for timestamps**

In the terminal entries mapping (around line 339-349), update to use `created_at`:
```typescript
const terminalEntries: TerminalEntry[] = (detail.logs || []).map((log: Record<string, unknown>, index: number) => {
    const role = log.role as string;
    const visuals = ROLE_VISUALS[role] || DEFAULT_ROLE_VISUALS;
    const timestamp = log.created_at
      ? new Date(log.created_at as string).toLocaleTimeString("en-US", { hour12: false })
      : undefined;
    return {
        id: log.id ? `p-${log.id}` : `p-log-${index}`,
        type: "log",
        text: `[${role}]: ${log.status}`,
        icon: visuals.icon,
        colorClass: visuals.colorClass,
        timestamp,
    };
});
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/store/useChatStore.ts
git commit -m "feat: differentiate 404/409 in REST, parse insights JSON, use log timestamps"
```

---

### Task 4: Update ChatWorkspace for failed state

**Files:**
- Modify: `src/components/features/workspace/ChatWorkspace.tsx`

- [ ] **Step 1: Allow re-running from failed state**

In `startAnalysis`, update the guard:
```typescript
if (appState === 'analyzing' || appState === 'waiting') return;
```

If `appState === "failed"`, we allow re-running. No change needed to the current guard since `"failed"` isn't in the check — it already passes through. But add `"done"` to be explicit:
```typescript
if (appState === 'analyzing' || appState === 'waiting' || appState === 'done') return;
```

Wait — `startAnalysis` currently already returns early for `analyzing` and `waiting`. It should also block on `done` (can't re-run a completed session without explicit new action). But `failed` should allow re-run. So the guard should be:
```typescript
if (appState === 'analyzing' || appState === 'waiting' || appState === 'done') return;
```

This means `"idle"` and `"failed"` states allow starting a new analysis.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/features/workspace/ChatWorkspace.tsx
git commit -m "feat: allow re-running analysis from failed state"
```

---

## Self-Review

**Spec coverage:** All 10 gaps identified in the analysis are covered:
- Task 1: Heartbeat types, insights types, halt_acknowledged types, exit_status types (gaps 1-5)
- Task 2: Heartbeat handler, insights handler, halt_acknowledged handler, reconnect flow, exit_status handling (gaps 1-6)
- Task 3: REST 404/409 differentiation, insights JSON parsing, log timestamps (gaps 7-9)
- Task 4: Failed appState handling in ChatWorkspace (gap 10)

**Placeholder scan:** No TBDs, TODOs, or vague instructions.

**Type consistency:** All new types are defined in Task 1 before they're consumed in Task 2. Task 3 and 4 are independent.
