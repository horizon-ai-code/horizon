# Structured Glassbox Protocol — Design Spec

## Goal

Replace opaque text-parsed status messages with structured WebSocket message types that enable rich real-time glassbox visualizations with zero content parsing.

## Guiding Principles

- **Backward compatible**: Old clients ignore new fields. New clients fall back to text parsing when structured fields are absent.
- **No breaking changes**: All existing message types (`status`, `result`, `insights`) keep their current shape. New data is additive.
- **Progressive enhancement**: Each new message type independently improves the glassbox. Implement in any order.

---

## 1. Phase Events

Two new server→client message types for tracking pipeline progression with accurate timing.

### `phase_started`

```json
{
  "type": "phase_started",
  "phase": 2,
  "name": "Strategy",
  "agent": "Planner",
  "strategy_iteration": 1,
  "timestamp": "2026-06-07T12:00:01.123Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `phase` | `int` (1-6) | Phase number |
| `name` | `string` | Human-readable phase name (`Baseline`, `Strategy`, `Execution`, `Validation`, `Adjudication`, `Finalization`) |
| `agent` | `string` | Primary agent for this phase |
| `strategy_iteration` | `int` | Current outer strategy loop iteration (1-3) |
| `timestamp` | `string` (ISO) | Server timestamp |

### `phase_completed`

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

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `success`, `retrying`, `failed` |
| `duration_ms` | `int` | Wall-clock milliseconds for this phase |

**Frontend behavior:**
- Phase bar shows exact elapsed time per phase on completion
- Failed/retrying phases flash red/yellow
- Strategy iteration counter increments on retry

---

## 2. Intent Classification

Replaces the markdown block in Planner status messages with structured data.

### `intent_classified`

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

| Field | Type | Description |
|-------|------|-------------|
| `category` | `string` | `CONTROL_FLOW`, `METHOD_MOVEMENT`, `STATE_MANAGEMENT` |
| `intent` | `string` | One of 12 intent enums |
| `confidence` | `float` (0-1) | Model confidence score |

**Frontend behavior:**
- Display as a structured card:
  ```
  [Category: METHOD_MOVEMENT] [Intent: EXTRACT_METHOD]
  [Target: OrderProcessor.process] [Confidence: 92%]
  ```
- Confidence < 0.7 shown in amber (uncertain classification)

---

## 3. Mutation Plan

Replaces the mutation plan markdown block.

### `mutation_plan`

```json
{
  "type": "mutation_plan",
  "target_class": "OrderProcessor",
  "mutations": [
    {
      "action": "ADD_METHOD",
      "target": "validateIfHighValue(Order o)",
      "description": "Add new method that extracts the high-value check logic",
      "status": "pending"
    },
    {
      "action": "MODIFY_METHOD",
      "target": "process(Order o)",
      "description": "Replace conditional block with call to new method",
      "status": "pending"
    }
  ],
  "estimated_mutation_count": 2
}
```

**Mutation object:**

| Field | Type | Description |
|-------|------|-------------|
| `action` | `string` | `ADD_METHOD`, `MODIFY_METHOD`, `DELETE_METHOD`, `EXTRACT_METHOD`, `INLINE_METHOD` |
| `target` | `string` | Method signature or code target |
| `description` | `string` \| `null` | Human-readable explanation |
| `status` | `string` | `pending` → `in_progress` → `completed` → `failed` |

**Frontend behavior:**
- Render a live mutation checklist with status badges
- Checkmark animation when a mutation completes
- Red X + retry badge when one fails
- Progress bar: `[███░░░░░] 2/8 mutations`

---

## 4. Mutation Status (Live Updates)

Sent during Phase 3 (Execution) to report each mutation's progress in real time.

### `mutation_status`

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

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | `in_progress`, `completed`, `retrying`, `failed` |
| `attempt` | `int` | Current retry attempt |
| `max_attempts` | `int` | Maximum retries before abort |
| `error` | `string` \| `null` | Error message if retrying/failed |

**Frontend behavior:**
- Animate a pulsing badge on the current mutation in the checklist
- Show `Retry 2/3` inline when retrying
- Slide error text into a collapsible detail row

---

## 5. Generator Progress

Sent periodically during generation to report overall progress.

### `generator_progress`

```json
{
  "type": "generator_progress",
  "mutations_completed": 1,
  "mutations_total": 2,
  "current_mutation": "MODIFY_METHOD on process(Order o)",
  "temperature": 0.3,
  "sample_index": 1,
  "total_samples": 3
}
```

**Frontend behavior:**
- Progress bar: `[████░░░░] Mutations: 1/2`
- Temperature badge: `Temp 0.3` when multi-sampling
- Elapsed time counter for the Generator phase

---

## 6. Validation Results

Replaces the validation findings markdown block with structured data.

### `validation_result`

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
      "before": 3,
      "after": 5
    },
    {
      "tier": "TIER_2_B_BOUNDARY",
      "name": "Boundary Check",
      "passed": true,
      "details": null
    },
    {
      "tier": "TIER_2_C_INTENT_MATH",
      "name": "Intent Match",
      "passed": true,
      "details": null
    }
  ],
  "total_passed": 3,
  "total_failed": 1,
  "fault_count": 1
}
```

**Frontend behavior:**
- Per-check pass/fail badges with green/red dots
- Animate each check appearing in sequence (skeleton loader while waiting)
- Expandable detail for failed checks
- Summary bar: `✅ 3/4 checks passed · 1 fault`
- Regression indicators for complexity changes

---

## 7. Judge Audit Result

Replaces the audit verdict markdown with structured data when Phase 5 completes.

### `audit_result`

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
  "confidence": 0.65,
  "attempt": 1,
  "max_attempts": 2
}
```

| Field | Type | Description |
|-------|------|-------------|
| `verdict` | `string` | `ACCEPT` or `REVISE` |
| `confidence` | `float` (0-1) | Judge model confidence |
| `attempt` | `int` | Current judge attempt |
| `issues` | `array` | List of issues if REVISE |

**Issue severity:** `low`, `medium`, `high` — controls color and animation intensity.

**Frontend behavior:**
- Animated large verdict badge with particle effect on ACCEPT
- Issue cards with severity-colored left border for REVISE
- "Attempt 1/2" badge when retrying

---

## 8. Architecture Analysis

Replaces the JSON analysis block with structured data early in Phase 2.

### `architecture_analysis`

```json
{
  "type": "architecture_analysis",
  "analysis_scratchpad": "Reasoning about the code structure...",
  "primary_targets": [
    {"name": "backtrack", "type": "method"}
  ],
  "secondary_targets": [],
  "new_structures_needed": [
    {"name": "tryNext", "type": "method", "purpose": "Private helper for backtrack"}
  ],
  "must_preserve": [
    {"name": "OrderProcessor", "type": "class"}
  ]
}
```

**Frontend behavior:**
- Target cards grouped by role (primary / secondary / new / preserve)
- Each card shows the name, type, and purpose
- Scratchpad shown as expandable "model's reasoning" section

---

## 9. Phase Timing Summary

Sent once after Phase 6 completes. Gives the frontend a complete timing breakdown.

### `phase_timing_summary`

```json
{
  "type": "phase_timing_summary",
  "total_duration_ms": 23450,
  "phases": [
    {"phase": 1, "name": "Baseline", "duration_ms": 120},
    {"phase": 2, "name": "Strategy", "duration_ms": 3400},
    {"phase": 3, "name": "Execution", "duration_ms": 8900},
    {"phase": 4, "name": "Validation", "duration_ms": 500},
    {"phase": 5, "name": "Adjudication", "duration_ms": 1800},
    {"phase": 6, "name": "Finalization", "duration_ms": 100}
  ]
}
```

**Frontend behavior:**
- Horizontal bar chart showing relative phase duration
- Total timer in the terminal header
- Slow phases highlighted in amber/red

---

## Implementation Priority

| Priority | Messages | Effort | Impact |
|----------|----------|--------|--------|
| P0 | `phase_started`, `phase_completed` | Low | Enables accurate phase timing + progress bar |
| P0 | `mutation_plan` + `mutation_status` | Low | Live mutation checklist — biggest glassbox win |
| P1 | `validation_result` | Medium | Replace text fault parsing with structured pass/fail |
| P1 | `intent_classified` | Low | Structured intent card instead of markdown regex |
| P1 | `audit_result` | Medium | Structured judge verdict with severity |
| P2 | `generator_progress` | Low | Progress bar + temperature display |
| P2 | `architecture_analysis` | Low | Structured target display |
| P3 | `phase_timing_summary` | Low | Post-run timing breakdown |

## Frontend Integration Strategy

Each new message type follows the same pattern:

1. **Add TypeScript type** in `src/types/websocket.ts`
2. **Add to `ServerMessage` union** in `src/types/websocket.ts`
3. **Add handler callback** in `src/hooks/useOrchestrationSocket.tsx`
4. **Store data in `GlassboxState.currentDetail`** or new context state
5. **Render in `StatusDetailPanel.tsx`** or `GlassboxBar.tsx`

Fallback: if a new message type never arrives (old backend), the existing text-parsing code in `handleStatus` continues to work. No UI breaks.

## UI Mockup — Expanded Glassbox With Full Protocol

```
TERMINAL [◉ Planner]  Phase 2 · 3.4s  [Strategy 1/3]

┌─────────────────────────────────────────────────┐
│ [Category: METHOD_MOVEMENT]  [EXTRACT_METHOD]   │
│ [Target: OrderProcessor.process]  [92%]         │
│                                                 │
│ Mutations:                                      │
│ ┌──────────────────────────────────────────┐    │
│ │ ✅ ADD_METHOD on validateIfHighValue    │    │
│ │ ◉ MODIFY_METHOD on process              │    │  ← pulsing
│ └──────────────────────────────────────────┘    │
│                                                 │
│ Checks:  ✅✅✅❌  3/4 passed · 1 fault        │
│  ✗ Complexity: CC 3 → 5 (increase)             │
└─────────────────────────────────────────────────┘
```
