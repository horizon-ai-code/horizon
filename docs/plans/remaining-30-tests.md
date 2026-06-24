# Remaining 30 Tests — Execution Plan

**Current: 257 done. Target: 287. Gap: 30.**

## Batch W1: Backend Integration — WebSocket (6 tests, ~20 min)

| TC-ID | File | What | Approach |
|-------|------|------|----------|
| IT-005 | `test_api.py` | PATCH rename session | Create session, PATCH title → 200, GET verify |
| IT-007 | `test_api.py` | DELETE then verify gone | Create session, DELETE, GET returns 404 |
| IT-009 | `test_api.py` | WS connect receives connection_id | Real `client.websocket_connect("/ws")`, `receive_json(timeout=3)` returns `connection_id` |
| IT-010 | `test_api.py` | WS heartbeat ping arrives | Connect, `receive_json(timeout=18)` returns `type: "ping"` |
| IT-011 | `test_api.py` | WS halt acknowledged | Connect, send halt, receive status with "halted" |
| IT-012 | `test_api.py` | WS malformed JSON rejected | Connect, send `not json`, receive error |

**Risk:** WS timeout tests (IT-010 needs 18s wait) — use `timeout=20` on receive.

## Batch W2: Backend Unit — Validation + Config (3 tests, ~10 min)

| TC-ID | File | What | Approach |
|-------|------|------|----------|
| CFG-004 | `test_config.py` | `from_yaml` invalid YAML raises | Create temp file with `": bad yaml [", call `from_yaml`, expect exception |
| VL-019 | `test_validator.py` | CC STRICT rule pass | Real code with CC 5→3 using `verify_complexity` with `FLATTEN_CONDITIONAL` intent, assert finding is None |
| VL-020 | `test_validator.py` | CC STRICT rule fail | Real code with CC 3→5, assert finding is not None |

## Batch W3: Backend Unit — Phase 3/4 edges (4 tests, ~15 min)

| TC-ID | File | What | Approach |
|-------|------|------|----------|
| P3-006 | `test_phase3_execution.py` | `run_single` fallback on all fail | All 3 temps produce syntax errors → best-effort returned |
| P4-004 | `test_phase4_validation.py` | CC check passes STRICT | `verify_complexity` returns `(None, 5, 3)` → route accept |
| P4-005 | `test_phase4_validation.py` | CC check fails STRICT | `verify_complexity` returns finding → fault added |
| P4-008 | `test_phase4_validation.py` | Multi-failure reports all | Syntax + CC + boundary all fail → all in `state.checks` |

## Batch W4: Backend Unit — Orchestrator execute (2 tests, ~15 min)

| TC-ID | File | What | Approach |
|-------|------|------|----------|
| OR-008 | `test_orchestrator.py` | Fully mocked pipeline 6 phases | Create Orchestrator with mock agent/db/validator, call `execute_orchestration`, verify phases called in order |
| OR-012 | `test_orchestrator.py` | _notify creates DB log per phase | Full mocked pipeline, verify `db.log_status` called once per phase |

## Batch W5: Frontend — Hook message handlers (7 tests, ~25 min)

| TC-ID | File | What | Approach |
|-------|------|------|----------|
| WS-003 | `useOrchestrationSocket.test.tsx` | Status → glassbox update | Store `glassboxState`, mock WS receive status, verify currentPhase changed |
| WS-004 | Same | Result → refactored output | Receive result message, check store refactoredOutput |
| WS-005 | Same | Insights → summary | Receive insights, check summary |
| WS-006 | Same | Error → terminal entry | Receive error, check terminalEntries has new entry |
| WS-007 | Same | Halt ack → idle | Receive halt_acknowledged, appState = "idle" |
| WS-009 | Same | Connection ID → migration | Receive connection_id, verify migrateSessionId called |
| WS-010 | Same | Dedup by commandId | Same commandId sent twice, send called once |

**Risk:** These require the hook to maintain internal WS reference. Use `renderHook` inside `act()` and access `result.current` methods. Mock `WebSocket` constructor with `MockWebSocket` that has `receive()` helper.

## Batch W6: Frontend — Remaining edge cases (8 tests, ~20 min)

| TC-ID | File | What | Approach |
|-------|------|------|----------|
| PS-011 | `parseStatusInfo.test.ts` | Intent detail markdown fallback | `"**Category:** FLATTEN_CONDITIONAL"` → returns object |
| PS-012 | Same | Mutation plan from JSON | `'"ast_mutations": [{"action":"MODIFY"}]'` → returns array |
| PS-013 | Same | Mutation plan markdown fallback | `"- **MODIFY_METHOD** on \`calculate\`"` → returns array |
| FS-003 | `formatStatusContent.test.ts` | Key:Value tag extraction | `"**Category:** CONTROL_FLOW"` → tags populated |
| FS-004 | Same | Bullet-tag extraction | `"- **Intent:** FLATTEN_CONDITIONAL"` → tags parsed |
| FS-006 | Same | Nested JSON flatten | 3-level nested object → leaf values accessible |
| FI-005 | `ChatWorkspace.test.tsx` | Error banner on missing session | Session not in store → error banner in DOM |
| FI-006 | Same | Start analysis sends request | Click submit → `sendRefactorRequest` called |

---

**Execution order:** W1 → W2 → W3 → W4 → W5 → W6 → `ruff check --fix` → `python -m pytest tests/` → `npm test` → update doc → commit

**Estimated time:** ~1.5-2 hours total.
