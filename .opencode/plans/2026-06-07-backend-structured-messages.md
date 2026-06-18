# Backend Structured Glassbox Messages — Implementation Spec

## Overview

Currently the backend sends a single `status` message type with a `content: string` field containing markdown-formatted text. The frontend parses this text with regex to extract structured data (intent, mutations, faults, verdict). This is fragile and limits what the UI can display.

This spec defines **9 new message types** that emit structured data alongside (or instead of) the existing markdown content. The existing `status` message continues to work — new messages are additive.

**Backend constraint:** All new messages are OPTIONAL. The frontend falls back to text parsing if they don't arrive.

**Principle:** One message type per semantic event. Don't overload `status` with structured data.

---

## Priority 0 — High Impact, Low Effort

### P0-1: `phase_started`

Emit when a new orchestration phase begins.

```json
{
  "type": "phase_started",
  "phase": 2,
  "name": "Strategy",
  "agent": "Planner",
  "strategy_iteration": 1,
  "max_strategy_iterations": 3,
  "timestamp": "2026-06-07T12:00:01.123Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phase` | `int` (1-6) | Yes | Phase number |
| `name` | `string` | Yes | One of: `Baseline`, `Strategy`, `Execution`, `Validation`, `Adjudication`, `Finalization` |
| `agent` | `string` | Yes | Primary agent: `Planner`, `Generator`, `Validator`, `Judge`, `System` |
| `strategy_iteration` | `int` | Yes | Starts at 1, increments on retry |
| `max_strategy_iterations` | `int` | Yes | Always 3 |
| `timestamp` | `string` (ISO 8601) | Yes | Server timestamp |

**When to emit:** At the start of each phase transition (1→2, 2→3, etc.) and on retry loops (back from Phase 4 to Phase 2).

### P0-2: `phase_completed`

Emit when a phase finishes (success, failure, or retry loop-back).

```json
{
  "type": "phase_completed",
  "phase": 2,
  "name": "Strategy",
  "duration_ms": 3400,
  "status": "success",
  "timestamp": "2026-06-07T12:00:04.523Z"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | `string` | Yes | `success`, `retrying`, `failed` |
| `duration_ms` | `int` | Yes | Wall-clock milliseconds for this phase |

**When to emit:** When a phase completes. On retry, emit with `status: "retrying"` before the next `phase_started`.

### P0-3: `mutation_plan`

Emit once after the Planner designs the mutation plan (during Phase 2).

```json
{
  "type": "mutation_plan",
  "target_class": "OrderProcessor",
  "mutations": [
    {
      "action": "ADD_METHOD",
      "target": "validateIfHighValue(Order o)",
      "description": "Extract high-value check into dedicated method",
      "status": "pending"
    },
    {
      "action": "MODIFY_METHOD",
      "target": "process(Order o)",
      "description": "Replace conditional with call to new method",
      "status": "pending"
    }
  ]
}
```

**Mutation object fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `action` | `string` | Yes | One of: `ADD_METHOD`, `MODIFY_METHOD`, `DELETE_METHOD`, `EXTRACT_METHOD`, `INLINE_METHOD`, `EXTRACT_VARIABLE`, `INLINE_VARIABLE`, `EXTRACT_CONSTANT`, `RENAME_SYMBOL`, `FLATTEN_CONDITIONAL`, `DECOMPOSE_CONDITIONAL`, `CONSOLIDATE_CONDITIONAL`, `REMOVE_CONTROL_FLAG`, `REPLACE_LOOP_WITH_PIPELINE`, `SPLIT_LOOP` |
| `target` | `string` | Yes | Method signature or code target |
| `description` | `string` | No | Human-readable explanation of the change |
| `status` | `string` | Yes | One of: `pending`, `in_progress`, `completed`, `failed` |

### P0-4: `mutation_status`

Emit for each mutation lifecycle event during Phase 3.

```json
{
  "type": "mutation_status",
  "action": "ADD_METHOD",
  "target": "validateIfHighValue(Order o)",
  "attempt": 2,
  "max_attempts": 3,
  "status": "retrying",
  "error": "Boundary violation — modified code outside target scope"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attempt` | `int` | Yes | Current retry attempt (1-based) |
| `max_attempts` | `int` | Yes | Max retries before abort |
| `error` | `string` | No | Error message when `retrying` or `failed` |

**Status values:**

| Status | Meaning |
|--------|---------|
| `in_progress` | Starting this mutation |
| `completed` | Mutation applied successfully |
| `retrying` | Failed, retrying (increment `attempt`) |
| `failed` | Gave up after `max_attempts` |

---

## Priority 1 — Medium Impact, Medium Effort

### P1-1: `validation_result`

Emit once per validation cycle during Phase 4.

```json
{
  "type": "validation_result",
  "strategy_iteration": 1,
  "checks": [
    {
      "tier": "TIER_1_SYNTAX",
      "name": "Syntax Check",
      "passed": true,
      "details": null
    },
    {
      "tier": "TIER_2_A_COMPLEXITY",
      "name": "Complexity Check",
      "passed": false,
      "details": "CC of target method 'process' increased from 3 to 5",
      "before_value": 3,
      "after_value": 5
    }
  ],
  "total_passed": 3,
  "total_failed": 1
}
```

**Check object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tier` | `string` | Yes | `TIER_1_SYNTAX`, `TIER_2_A_COMPLEXITY`, `TIER_2_B_BOUNDARY`, `TIER_2_C_INTENT_MATH`, `TIER_3_JUDGE` |
| `name` | `string` | Yes | Human-readable check name |
| `passed` | `bool` | Yes | Pass/fail |
| `details` | `string` | No | Detailed message on failure |
| `before_value` | `number` | No | Metric before (complexity) |
| `after_value` | `number` | No | Metric after (complexity) |

### P1-2: `intent_classified`

Emit once when the Planner classifies the user's intent.

```json
{
  "type": "intent_classified",
  "category": "METHOD_MOVEMENT",
  "intent": "EXTRACT_METHOD",
  "target_unit": "METHOD_UNIT",
  "target_class": "OrderProcessor",
  "target_member": "process",
  "confidence": 0.92
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category` | `string` | Yes | `CONTROL_FLOW`, `METHOD_MOVEMENT`, `STATE_MANAGEMENT` |
| `intent` | `string` | Yes | One of 12 intent enum values |
| `confidence` | `float` | No | 0.0 - 1.0 (omit if not available) |

### P1-3: `audit_result`

Emit once when the Judge completes adjudication (Phase 5).

```json
{
  "type": "audit_result",
  "verdict": "REVISE",
  "issues": [
    {
      "issue_type": "LOGIC_DRIFT",
      "description": "Variable order is now reassigned in the extracted method",
      "severity": "high"
    }
  ],
  "attempt": 1,
  "max_attempts": 2
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `verdict` | `string` | Yes | `ACCEPT` or `REVISE` |
| `attempt` | `int` | Yes | Current audit attempt (1-based) |
| `max_attempts` | `int` | Yes | Max attempts before override |

**Issue object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `issue_type` | `string` | Yes | `IDENTICAL_CODE`, `LOGIC_DRIFT`, `SEMANTIC_DRIFT` |
| `severity` | `string` | No | `low`, `medium`, `high` |

---

## Priority 2 — Lower Effort, Nice to Have

### P2-1: `generator_progress`

Emit periodically during Phase 3 while generating.

```json
{
  "type": "generator_progress",
  "mutations_completed": 1,
  "mutations_total": 2,
  "temperature": 0.3,
  "sample_index": 1,
  "total_samples": 3
}
```

### P2-2: `architecture_analysis`

Emit during Phase 2 when the analysis step completes.

```json
{
  "type": "architecture_analysis",
  "primary_targets": [
    {"name": "backtrack", "kind": "method"}
  ],
  "secondary_targets": [],
  "new_structures": [
    {"name": "tryNext", "kind": "method", "purpose": "Private helper for backtrack"}
  ],
  "must_preserve": [
    {"name": "OrderProcessor", "kind": "class"}
  ]
}
```

### P2-3: `phase_timing_summary`

Emit once after Phase 6 completes.

```json
{
  "type": "phase_timing_summary",
  "total_duration_ms": 23450,
  "phases": [
    {"phase": 1, "duration_ms": 120},
    {"phase": 2, "duration_ms": 3400},
    {"phase": 3, "duration_ms": 8900},
    {"phase": 4, "duration_ms": 500},
    {"phase": 5, "duration_ms": 1800},
    {"phase": 6, "duration_ms": 100}
  ]
}
```

---

## Backend Implementation Guide

### Where to emit each message

```
PHASE 1 (Baseline):
  → phase_started {phase:1, agent:"Validator"}
  → phase_completed {phase:1, status:"success", duration_ms}

PHASE 2 (Strategy):
  → phase_started {phase:2, agent:"Planner"}
  → intent_classified {category, intent, ...}
  → architecture_analysis {primary_targets, ...}
  → mutation_plan {mutations: [...]}
  → phase_completed {phase:2, status:"success", duration_ms}

PHASE 3 (Execution):
  → phase_started {phase:3, agent:"Generator"}
  → mutation_status {status:"in_progress", action, target}
  → mutation_status {status:"completed", ...}  (or "retrying")
  → generator_progress {mutations_completed:N, mutations_total:M}
  → phase_completed {phase:3, status:"success", duration_ms}

PHASE 4 (Validation):
  → phase_started {phase:4, agent:"Validator"}
  → validation_result {checks: [...]}
  → IF retry needed: phase_completed {status:"retrying"}
  → ELSE: phase_completed {status:"success"} → phase_started {phase:5}

PHASE 5 (Adjudication):
  → phase_started {phase:5, agent:"Judge"}
  → audit_result {verdict, issues, attempt}
  → IF REVISE: phase_completed {status:"retrying"}
  → ELSE: phase_completed {status:"success"} → phase_started {phase:6}

PHASE 6 (Finalization):
  → phase_started {phase:6, agent:"System"}
  → phase_completed {status:"success"}
  → phase_timing_summary {phases: [...]}
```

### Existing messages to keep

Do NOT remove or modify existing `status`, `result`, or `insights` messages. New messages are additive.

### Backward compatibility

If a backend version doesn't emit these new message types, the frontend falls back to parsing the existing `status.content` field with regex. Zero breakage.

---

## Frontend Consumption

Each new message type maps to:

| Message | Frontend handler | State update | Component |
|---------|-----------------|--------------|-----------|
| `phase_started` | New callback | `glassboxState.currentPhase`, `strategyIteration` | `GlassboxBar` phase dots |
| `phase_completed` | New callback | `glassboxState.phaseTimings` | Phase timing tooltip |
| `mutation_plan` | New callback | `glassboxState.currentDetail.mutations` | `StatusDetailPanel` mutation list |
| `mutation_status` | New callback | Updates mutation in `currentDetail` | Live mutation checklist |
| `validation_result` | New callback | `glassboxState.validationFaultCount`, `findings` | `StatusDetailPanel` checks |
| `intent_classified` | New callback | `glassboxState.currentDetail.intent` | `StatusDetailPanel` intent card |
| `audit_result` | New callback | `glassboxState.judgeDecision` | `StatusDetailPanel` verdict |
| `architecture_analysis` | New callback | `glassboxState.currentDetail` | `StatusDetailPanel` targets |
| `generator_progress` | New callback | Progress state | Progress bar in detail panel |
| `phase_timing_summary` | New callback | `glassboxState.phaseTimings` | Timing breakdown in terminal |

All handlers follow the same pattern:
1. Add to `ServerMessage` union type in `src/types/websocket.ts`
2. Add `handleXxx` callback in `src/hooks/useOrchestrationSocket.tsx`
3. Add ref + effect sync
4. Add `case "xxx":` in the `ws.onmessage` switch
5. Store in `glassboxState` or dedicated state
6. Render in component
