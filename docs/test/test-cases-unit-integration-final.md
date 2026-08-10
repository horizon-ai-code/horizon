# Horizon AI — Test Cases (Grouped by Complexity)

[![Status: Final](https://img.shields.io/badge/Status-Final-green)](.)
[![Total Tests](https://img.shields.io/badge/Tests-268-blue)](.)
[![Pass Rate](https://img.shields.io/badge/Pass%20Rate-100%25-brightgreen)](.)

_All 268 test cases from `test-cases.md` grouped by complexity category: Simple, Edge, Complex. Separated into Backend and Frontend sections._

---

## Table of Contents

- [1. Backend](#1-backend)
  - [1.1 Simple (127 tests)](#11-simple-127-tests)
  - [1.2 Edge (36 tests)](#12-edge-36-tests)
  - [1.3 Complex (4 tests)](#13-complex-4-tests)
- [2. Frontend](#2-frontend)
  - [2.1 Simple (79 tests)](#21-simple-79-tests)
  - [2.2 Edge (8 tests)](#22-edge-8-tests)
  - [2.3 Complex (2 tests)](#23-complex-2-tests)

---

## 1. Backend

### 1.1 Simple (127 tests)

Direct input/output, single function call, basic validation, minimal setup.

| ID | Module | Type | Scenario |
|----|--------|------|----------|
| TC-CFG-001 | OrchestrationConfig | Positive | `from_dict` with valid config creates `OrchestrationConfig` |
| TC-CFG-001b | OrchestrationConfig | Positive | `ModelEntry` creation with valid fields |
| TC-CFG-002 | OrchestrationConfig | Negative | `from_dict` missing required keys raises error |
| TC-CFG-003 | OrchestrationConfig | Positive | `from_yaml` with valid YAML parses correctly |
| TC-CFG-004 | OrchestrationConfig | Negative | `from_yaml` with invalid YAML raises error |
| TC-TS-001 | Types & Schemas | Positive | `RefactorRequest` with valid code and instruction |
| TC-TS-002 | Types & Schemas | Negative | `RefactorRequest` empty code rejected |
| TC-TS-004 | Types & Schemas | Positive | `IntentPacket` with valid enums |
| TC-TS-005a | Types & Schemas | Negative | `IntentPacket` invalid category |
| TC-TS-005b | Types & Schemas | Negative | `IntentPacket` invalid intent |
| TC-TS-006 | Types & Schemas | Positive | `HaltRequest` validates correctly |
| TC-RP-001 | ResponseParser | Positive | `extract_xml` extracts content between XML tags |
| TC-RP-002 | ResponseParser | Positive | `extract_xml` strips `<think>` blocks before extraction |
| TC-RP-003 | ResponseParser | Positive | `extract_xml` validates Java plausibility (semicolons) |
| TC-RP-004 | ResponseParser | Positive | `extract_xml` validates Java plausibility (braces) |
| TC-RP-005 | ResponseParser | Negative | `extract_xml` rejects non-Java code tag content |
| TC-RP-007 | ResponseParser | Positive | `extract_json` parses JSON to Pydantic model |
| TC-RP-008 | ResponseParser | Positive | `extract_json` extracts from markdown code fence |
| TC-RP-010 | ResponseParser | Positive | `extract_json` fixes Python `None` → `null` |
| TC-RP-011 | ResponseParser | Positive | `extract_json` fixes Python `True` → `true` |
| TC-RP-012 | ResponseParser | Positive | `extract_json` fixes Python `False` → `false` |
| TC-RP-016 | ResponseParser | Negative | Invalid JSON returns None |
| TC-RP-018 | ResponseParser | Positive | `detect_repetition` detects LLM output loop |
| TC-RP-019 | ResponseParser | Positive | `detect_repetition` no false positive on normal text |
| TC-AM-001 | ASTMatcher | Positive | `_find_class_declaration_line` finds class line |
| TC-AM-002 | ASTMatcher | Positive | `_find_class_declaration_line` handles enum/interface |
| TC-AM-003 | ASTMatcher | Positive | `_find_method_body` finds method by name |
| TC-AM-005 | ASTMatcher | Positive | `_extract_method_text` braces-matched extraction |
| TC-AM-007 | ASTMatcher | Positive | `_enrich_add_constant` sets `insert_after` to class decl |
| TC-AM-008 | ASTMatcher | Positive | `_enrich_add_field` sets `insert_after` |
| TC-AM-009 | ASTMatcher | Positive | `_enrich_modify_method` creates find/replace |
| TC-AM-010 | ASTMatcher | Positive | `_enrich_rename_symbol` creates find/replace |
| TC-AM-011 | ASTMatcher | Positive | `_enrich_dispatches_by_action` routes all action types |
| TC-VL-001 | Validator | Positive | `check_syntax` validates well-formed Java class |
| TC-VL-002 | Validator | Positive | `check_syntax` wraps bare statements in class wrapper |
| TC-VL-003 | Validator | Positive | `check_syntax` wraps bare method in class wrapper |
| TC-VL-004 | Validator | Negative | `check_syntax` rejects malformed (unclosed brace) |
| TC-VL-007 | Validator | Positive | `get_complexity` correct CC for method with conditionals |
| TC-VL-008 | Validator | Positive | `get_complexity` returns 1 for class with no methods |
| TC-VL-009 | Validator | Positive | `get_method_complexity` finds specific method by name |
| TC-VL-010 | Validator | Negative | `get_method_complexity` returns None for missing method |
| TC-VL-011 | Validator | Positive | `has_structural_change` detects difference |
| TC-VL-012 | Validator | Positive | `has_structural_change` confirms identical structure |
| TC-VL-013 | Validator | Positive | `verify_intent` FLATTEN_CONDITIONAL detects decrease |
| TC-VL-014a | Validator | Positive | `verify_intent` EXTRACT_METHOD verification |
| TC-VL-014b | Validator | Positive | `verify_intent` EXTRACT_METHOD detects increase |
| TC-VL-015 | Validator | Negative | `verify_intent` FLATTEN fails when unchanged |
| TC-VL-016a | Validator | Negative | `verify_intent` REMOVE_CONTROL_FLAG unchanged |
| TC-VL-016b | Validator | Negative | `verify_intent` REMOVE_CONTROL_FLAG fails unchanged |
| TC-VL-017 | Validator | Positive | `verify_boundary` confirms non-target methods unchanged |
| TC-VL-018 | Validator | Negative | `verify_boundary` detects leak into non-target method |
| TC-VL-019a | Validator | Positive | `verify_complexity` can be called |
| TC-VL-019b | Validator | Positive | `verify_complexity` decrease passes STRICT |
| TC-VL-020a | Validator | Negative | `verify_complexity` STRICT fails on increase (same code) |
| TC-VL-020b | Validator | Negative | `verify_complexity` STRICT fails on increase (CC 1→2) |
| TC-VL-021 | Validator | Positive | `verify_complexity` with full `IntentPacket` |
| TC-AS-001 | AgentService | Positive | `generate` returns structured response |
| TC-AS-003 | AgentService | Positive | `stop` triggers generation halt |
| TC-AS-004 | AgentService | Positive | `load` passes correct GPU layers to Llama |
| TC-AS-005 | AgentService | Positive | `unload` releases VRAM |
| TC-AS-006 | AgentService | Positive | `swap` reloads only when config differs |
| TC-AS-007 | AgentService | Positive | `truncates_at_max_tokens` enforces token limit |
| TC-AS-008 | AgentService | Positive | `_count_tokens` extracts from usage data |
| TC-AS-010 | AgentService | Positive | `generate` with GBNF grammar constraint |
| TC-CC-001 | ClientConnection | Positive | `send_status` sends formatted status via WebSocket |
| TC-CC-002 | ClientConnection | Positive | `send_result` includes model names |
| TC-CC-003 | ClientConnection | Positive | `send_halt_notification` sends halt message |
| TC-CC-004 | ClientConnection | Positive | `heartbeat` starts background task |
| TC-CC-005 | ClientConnection | Positive | `handle_pong` resets missed pong counter |
| TC-CC-006 | ClientConnection | Positive | `is_stale` true after 2+ missed pongs |
| TC-CC-008 | ClientConnection | Positive | `send_status` proceeds when connection fresh |
| TC-DB-001 | DatabaseManager | Positive | `create_session` inserts row with correct fields |
| TC-DB-002 | DatabaseManager | Positive | `complete_session` updates status + code |
| TC-DB-003 | DatabaseManager | Positive | `log_status` creates OrchestrationLog entry |
| TC-DB-004 | DatabaseManager | Positive | `mark_as_halted` sets status |
| TC-DB-005 | DatabaseManager | Positive | `get_history` returns stubs ordered by date desc |
| TC-DB-006 | DatabaseManager | Positive | `get_history_by_id` returns full detail with logs |
| TC-DB-007 | DatabaseManager | Negative | `get_history_by_id` returns None for missing ID |
| TC-DB-008 | DatabaseManager | Positive | `rename_session` updates title |
| TC-DB-009 | DatabaseManager | Positive | `cleanup_zombie_sessions` marks stale sessions |
| TC-DB-010 | DatabaseManager | Positive | `cleanup_halted_sessions` removes halted |
| TC-DB-011 | DatabaseManager | Positive | `delete_history_by_id` cascading delete |
| TC-MR-001 | MessageRouter | Positive | `dispatch` routes `pong` to `client.handle_pong()` |
| TC-MR-002 | MessageRouter | Positive | `dispatch` routes `reconnect` to reconnect handler |
| TC-MR-003 | MessageRouter | Positive | `dispatch` validates + launches single refactor |
| TC-MR-004 | MessageRouter | Positive | `dispatch` validates + launches multi refactor |
| TC-MR-005 | MessageRouter | Positive | `dispatch` routes halt to agent stop + task cancel |
| TC-MR-006 | MessageRouter | Negative | `dispatch` rejects invalid request, sends error |
| TC-MR-007 | MessageRouter | Negative | `dispatch` rejects malformed JSON |
| TC-OR-001 | Orchestrator | Positive | `OrchestrationState` initializes with defaults |
| TC-OR-002 | Orchestrator | Positive | `add_feedback` appends to ring buffer |
| TC-OR-004 | Orchestrator | Positive | `extend_feedback` batch-adds with cap |
| TC-OR-005 | Orchestrator | Positive | Pipeline sends status notifications |
| TC-OR-006 | Orchestrator | Positive | Status includes model names |
| TC-P2-001 | Phase 2 — Strategy | Positive | `_classify` returns `IntentPacket` from canned LLM response |
| TC-P2-003 | Phase 2 — Strategy | Positive | `_analyze` stores `ArchitectAnalysisResponse` |
| TC-P2-005 | Phase 2 — Strategy | Positive | `_synthesize` returns ASTArchitectResponse |
| TC-P2-008 | Phase 2 — Strategy | Positive | `_synthesize` calls ASTMatcher enrichment |
| TC-P2-008b | Phase 2 — Strategy | Positive | `enrich_dispatches_by_action` routes all action types |
| TC-P2-009 | Phase 2 — Strategy | Positive | `_deduplicate` removes duplicate (action, target) pairs |
| TC-P2-010 | Phase 2 — Strategy | Positive | `_deduplicate` preserves unique pairs |
| TC-P2-011 | Phase 2 — Strategy | Positive | `_translate_feedback` maps TIER_1 to syntax hint |
| TC-P3-001 | Phase 3 — Execution | Positive | `repair_generator_output` strips `throws Exception` |
| TC-P3-002 | Phase 3 — Execution | Positive | `repair_generator_output` strips null check guard |
| TC-P3-003 | Phase 3 — Execution | Positive | `repair_generator_output` strips extra `public` |
| TC-P3-004 | Phase 3 — Execution | Positive | `repair_generator_output` leaves valid code unchanged |
| TC-P4-001 | Phase 4 — Validation | Positive | `run` passes all validation checks |
| TC-P4-002 | Phase 4 — Validation | Negative | `run` routes to Phase 3 when syntax fails |
| TC-P4-004 | Phase 4 — Validation | Positive | `verify_complexity` STRICT passes |
| TC-P4-005 | Phase 4 — Validation | Negative | `verify_complexity` STRICT fails |
| TC-P4-006 | Phase 4 — Validation | Positive | `verify_boundary` passes |
| TC-P4-007 | Phase 4 — Validation | Negative | `verify_boundary` detects leak |
| TC-P5-001 | Phase 5 — Adjudication | Positive | Judge returns ACCEPT, proceeds to Phase 6 |
| TC-P5-002 | Phase 5 — Adjudication | Positive | Judge returns REVISE, returns to Phase 2 |
| TC-P5-006 | Phase 5 — Adjudication | Positive | Structured issues extracted from judge |
| TC-P6-001 | Phase 6 — Finalization | Positive | Strips outer wrapper from generated code |
| TC-P6-002 | Phase 6 — Finalization | Positive | Sends result with correct code and metrics |
| TC-P6-003 | Phase 6 — Finalization | Positive | Generates LLM insights |
| TC-P6-005 | Phase 6 — Finalization | Positive | Persists to database |
| TC-FMT-001 | Formatters | Positive | Single MODIFY_METHOD mutation formatted |
| TC-FMT-002 | Formatters | Positive | ADD_CONSTANT with value included |
| TC-FMT-003 | Formatters | Positive | Constant references included in MODIFY_METHOD |
| TC-FMT-004 | Formatters | Positive | Mutations ordered logically (rename→add→modify) |
| TC-FMT-005 | Formatters | Positive | Empty mutations returns "No mutations" message |
| TC-CU-001 | Code Utils | Positive | `strip_outer_wrapper` removes fabricated class |
| TC-CU-004 | Code Utils | Positive | `order_mutations` places RENAME_SYMBOL first |
| TC-CU-005 | Code Utils | Positive | `order_mutations` places ADD_* before MODIFY/REMOVE |
| TC-IT-001 | API | Positive | `GET /health` returns 200 with timestamp |
| TC-IT-002 | API | Positive | `GET /api/history` returns empty list |
| TC-IT-004 | API | Negative | `GET /api/history/:id` returns 404 for missing |
| TC-IT-006 | API | Negative | `PATCH /api/history/:id` rejects empty title |
| TC-IT-008 | API | Negative | `DELETE /api/history/:id` returns 404 for missing |
| TC-IT-009 | API | Positive | WebSocket `/ws` accepts connection |
| TC-IT-011 | API | Positive | WebSocket halt notification via router |
| TC-PL-RENAME | Full Pipeline | Positive | After pipeline: rename + delete session |

### 1.2 Edge (36 tests)

Boundary conditions, empty/null inputs, unusual inputs, error recovery, retry limits.

| ID | Module | Type | Scenario |
|----|--------|------|----------|
| TC-CFG-005 | OrchestrationConfig | Edge | `ModelEntry` frozen dataclass cannot be mutated |
| TC-TS-003 | Types & Schemas | Edge | `RefactorRequest` minimum instruction length |
| TC-TS-008 | Types & Schemas | Edge | `ScopeAnchor` with `member` field null |
| TC-RP-006 | ResponseParser | Edge | `extract_xml` missing tag returns None |
| TC-RP-009 | ResponseParser | Edge | `extract_json` fixes trailing comma |
| TC-RP-013 | ResponseParser | Edge | Brace inside string value doesn't break depth counting |
| TC-RP-014 | ResponseParser | Edge | Trailing comma inside string value preserved |
| TC-RP-015 | ResponseParser | Edge | Python keywords inside string values not replaced |
| TC-RP-017 | ResponseParser | Edge | Deeply nested JSON (5+ levels) |
| TC-RP-020 | ResponseParser | Edge | `detect_repetition` handles empty string |
| TC-AM-004 | ASTMatcher | Edge | `_find_method_body` returns None for missing method |
| TC-AM-006 | ASTMatcher | Edge | `_extract_method_text` with deeply nested braces |
| TC-AM-012 | ASTMatcher | Edge | `enrich_mutations` handles empty mutation array |
| TC-VL-005 | Validator | Edge | `check_syntax` handles empty input |
| TC-VL-006 | Validator | Edge | `check_syntax` handles whitespace-only |
| TC-AS-002 | AgentService | Edge | `generate` with empty messages list |
| TC-AS-009 | AgentService | Edge | `_count_tokens` fallback when no usage data |
| TC-CC-007 | ClientConnection | Edge | `is_stale` false within threshold |
| TC-DB-012 | DatabaseManager | Edge | Tenacity retry on `OperationalError` |
| TC-MR-008 | MessageRouter | Edge | `dispatch` ignores unknown message type |
| TC-OR-003 | Orchestrator | Edge | `add_feedback` ring buffer capped at 3 |
| TC-OR-007 | Orchestrator | Edge | Status skipped when client is stale |
| TC-P2-002 | Phase 2 — Strategy | Edge | `_classify` handles invalid/unexpected intent |
| TC-P2-004 | Phase 2 — Strategy | Edge | `_analyze` handles bad JSON from LLM |
| TC-P2-007 | Phase 2 — Strategy | Edge | `_synthesize` gives up after max retries |
| TC-P3-006 | Phase 3 — Execution | Edge | `run_single` fallback when all outputs fail |
| TC-P3-009 | Phase 3 — Execution | Edge | `run_sequential` boundary break halts |
| TC-P3-010 | Phase 3 — Execution | Edge | `run_sequential` max heals exceeded |
| TC-P5-003 | Phase 5 — Adjudication | Edge | Hallucination override for identical code |
| TC-P5-005 | Phase 5 — Adjudication | Edge | Missing/empty judge response handled |
| TC-P6-004 | Phase 6 — Finalization | Edge | Insight generation failure handled gracefully |
| TC-FMT-006 | Formatters | Edge | Empty mutations dict handled |
| TC-CU-002 | Code Utils | Edge | `strip_outer_wrapper` preserves code when no wrapper |
| TC-CU-003 | Code Utils | Edge | `strip_outer_wrapper` class body only (no outer) |
| TC-CU-006a | Code Utils | Edge | `order_mutations` preserves relative order within group |
| TC-CU-006b | Code Utils | Edge | `order_mutations` stable sort with 3 same-priority |
| TC-IT-012 | API | Edge | WebSocket malformed JSON rejected |

### 1.3 Complex (4 tests)

Multi-step orchestration, retry coordination, multi-component mock integration.

| ID | Module | Type | Scenario | Complexity Reason |
|----|--------|------|----------|-------------------|
| TC-P2-006 | Phase 2 — Strategy | Positive | `_synthesize` retries on invalid plan | Retry orchestration: first mock returns invalid, second valid — validates retry loop state management |
| TC-P3-005 | Phase 3 — Execution | Positive | `run_single` generates at 3 temps, picks best CC | Multi-temperature generation with 3 mock outputs, CC comparison, and best-result selection |
| TC-P3-007 | Phase 3 — Execution | Positive | `run_sequential` applies mutations one at a time | Sequential mutation iteration with interleaved validation per mutation step |
| TC-P3-008 | Phase 3 — Execution | Positive | `run_sequential` syntax healing on failure | Syntax healing retry loop with counter management and state recovery |
| TC-PL-SUCCESS | Full Pipeline | Positive | Pipeline completes all 6 phases, session persisted | Full multi-phase orchestration, per-phase canned responses, real DB and Validator, exit status verification |
| TC-PL-HALT | Full Pipeline | Negative | User halt during generation | `InterruptedError` propagation through pipeline layers, `AbortingAgentService` exception on 3rd call |
| TC-PL-ABORT | Full Pipeline | Edge | Strategy retry circuit breaker | `BrokenCodeAgentService` producing invalid Java every iteration, `exit_status == ABORT_STRATEGY`, `strategy_iter > 3` |

---

## 2. Frontend

### 2.1 Simple (79 tests)

Direct input/output, single function call, basic validation, minimal setup.

| ID | Module | Type | Scenario |
|----|--------|------|----------|
| TC-CN-001 | lib/utils | Positive | Merges multiple class name strings |
| TC-CN-002 | lib/utils | Positive | Filters falsy values |
| TC-CN-003 | lib/utils | Positive | Handles conditional object syntax |
| TC-CN-004 | lib/utils | Positive | Resolves Tailwind conflicts via twMerge |
| TC-CN-006 | lib/utils | Positive | Handles array arguments |
| TC-CNST-001 | lib/constants | Positive | `INITIAL_SOURCE` is empty string |
| TC-CNST-002 | lib/constants | Positive | `EMPTY_ORCHESTRATION_RESULT` has expected shape |
| TC-CNST-003 | lib/constants | Positive | `ROLE_VISUALS` has entries for all 6 roles |
| TC-CNST-004 | lib/constants | Positive | Each `ROLE_VISUALS` entry has `step`, `icon`, `colorClass` |
| TC-CNST-004b | lib/constants | Positive | Planner role has step 1 and blue color |
| TC-CNST-005 | lib/constants | Positive | `DEFAULT_ROLE_VISUALS` has fallback values |
| TC-PS-001 | lib/parseStatusInfo | Positive | `parsePhaseNumber` detects "Ph1" pattern |
| TC-PS-002 | lib/parseStatusInfo | Positive | `parsePhaseNumber` detects "Baseline" keyword |
| TC-PS-003 | lib/parseStatusInfo | Positive | `parsePhaseNumber` detects "Strategy" keyword |
| TC-PS-004 | lib/parseStatusInfo | Positive | `parseStrategyIteration` extracts iteration number |
| TC-PS-005 | lib/parseStatusInfo | Positive | `parseRetryInfo` detects syntax heal attempt |
| TC-PS-006 | lib/parseStatusInfo | Positive | `parseRetryInfo` detects sequential mutation retry |
| TC-PS-007 | lib/parseStatusInfo | Positive | `parseValidationFaults` extracts fault count |
| TC-PS-008 | lib/parseStatusInfo | Positive | `parseJudgeDecision` detects ACCEPT verdict |
| TC-PS-009 | lib/parseStatusInfo | Positive | `parseJudgeDecision` detects REVISE verdict |
| TC-PS-014 | lib/parseStatusInfo | Positive | `parsePhaseAction` extracts action description |
| TC-FS-001 | lib/formatStatusContent | Positive | Extracts JSON blocks into structured format |
| TC-FS-002 | lib/formatStatusContent | Positive | Handles standalone JSON object |
| TC-FS-003 | lib/formatStatusContent | Positive | Extracts Key:Value tags from markdown |
| TC-FS-004 | lib/formatStatusContent | Positive | Handles markdown list input |
| TC-FS-005 | lib/formatStatusContent | Positive | Returns summary from first line |
| TC-FS-006 | lib/formatStatusContent | Positive | Returns structured output with expected properties |
| TC-FS-008 | lib/formatStatusContent | Edge | Handles plain text input |
| TC-JF-001 | lib/javaFormatter | Positive | Formats basic class with braces and indentation |
| TC-JF-002 | lib/javaFormatter | Positive | Preserves string literals during formatting |
| TC-JF-003 | lib/javaFormatter | Positive | Preserves comments during formatting |
| TC-JF-004 | lib/javaFormatter | Positive | Handles generic type parameters |
| TC-JF-005 | lib/javaFormatter | Positive | Normalizes spaces around operators |
| TC-JF-006 | lib/javaFormatter | Positive | Merges else/catch/finally to previous closing brace |
| TC-JF-010 | lib/javaFormatter | Positive | Handles long method with mixed constructs |
| TC-IN-001 | lib/indentation | Positive | `handleEnterKey` adds indent after line ending with `{` |
| TC-IN-002 | lib/indentation | Positive | `handleEnterKey` auto-closes brace after `{` |
| TC-IN-004 | lib/indentation | Positive | `handleTabKey` indents line by 4 spaces |
| TC-IN-006 | lib/indentation | Positive | `handleShiftTab` outdents line |
| TC-IN-007 | lib/indentation | Positive | `handleClosingBrace` adjusts indent to match opening |
| TC-BM-001 | lib/buildMetrics | Positive | Complexity metric when decreased |
| TC-BM-002 | lib/buildMetrics | Positive | Complexity metric when increased |
| TC-BM-003 | lib/buildMetrics | Positive | Complexity metric when unchanged |
| TC-BM-004 | lib/buildMetrics | Positive | Inference time metric built |
| TC-BM-005 | lib/buildMetrics | Positive | GPU metrics built when performance provided |
| TC-ZD-001 | lib/schemas/websocket | Positive | `StatusMessageSchema` validates correct status |
| TC-ZD-002 | lib/schemas/websocket | Negative | `StatusMessageSchema` rejects missing role |
| TC-ZD-003 | lib/schemas/websocket | Negative | `StatusMessageSchema` rejects invalid type |
| TC-ZD-004 | lib/schemas/websocket | Positive | `ResultMessageSchema` validates correct result |
| TC-ZD-005 | lib/schemas/websocket | Negative | `ResultMessageSchema` rejects invalid exit_status |
| TC-ZD-006 | lib/schemas/websocket | Positive | `ErrorMessageSchema` validates correct error |
| TC-ZD-007 | lib/schemas/websocket | Positive | `ServerMessageSchema` discriminates status/result/error |
| TC-ZD-008 | lib/schemas/websocket | Negative | `ServerMessageSchema` rejects unknown type |
| TC-ST-001 | store/useChatStore | Positive | `createSession` creates session with defaults |
| TC-ST-002 | store/useChatStore | Positive | `createSession` with initial prompt |
| TC-ST-003 | store/useChatStore | Positive | `updateSession` partial update merges |
| TC-ST-004 | store/useChatStore | Positive | `updateSession` updater function accumulates |
| TC-ST-005 | store/useChatStore | Positive | `deleteSession` calls DELETE API + removes |
| TC-ST-007 | store/useChatStore | Positive | `renameSession` optimistic update on PATCH success |
| TC-ST-009 | store/useChatStore | Positive | `migrateSessionId` moves data to new key |
| TC-ST-010 | store/useChatStore | Positive | `fetchHistory` populates sessions from API |
| TC-ST-011 | store/useChatStore | Positive | `fetchHistory` sets error flag on API failure |
| TC-ST-012 | store/useChatStore | Positive | `fetchSessionDetails` maps logs |
| TC-ST-013 | store/useChatStore | Positive | `resetDraftSession` clears all draft fields |
| TC-ST-014 | store/useChatStore | Positive | `setOrchestratorStatus` updates status |
| TC-ST-014b | store/useChatStore | Positive | `hasInitialLoaded` tracks initial load state |
| TC-WS-001 | hooks/useOrchestrationSocket | Positive | `useOrchestrationSocket` returns connection status |
| TC-WS-001b | hooks/useOrchestrationSocket | Positive | Hook exposes required methods |
| TC-WS-002 | hooks/useOrchestrationSocket | Positive | `disconnect` changes connection status |
| TC-EB-001 | components/ErrorBoundary | Positive | Renders children when no error |
| TC-EB-002 | components/ErrorBoundary | Positive | Catches error from crashing child |
| TC-EB-003 | components/ErrorBoundary | Positive | Shows custom fallback when provided |
| TC-FI-001 | Terminal | Positive | Renders boot header |
| TC-FI-002 | Terminal | Positive | Renders terminal entry types |
| TC-FI-003 | Terminal | Positive | Collapsible header visible |
| TC-FI-004a | ChatWorkspace | Positive | Renders with valid session ID |
| TC-FI-004b | ChatWorkspace | Positive | Renders with null session ID |

### 2.2 Edge (8 tests)

Boundary conditions, empty/null inputs, unusual inputs.

| ID | Module | Type | Scenario |
|----|--------|------|----------|
| TC-CN-005 | lib/utils | Edge | Returns empty string for no args |
| TC-PS-010 | lib/parseStatusInfo | Edge | `parseIntentDetail` unmatched text returns undefined |
| TC-PS-011 | lib/parseStatusInfo | Edge | `parseMutationPlan` unmatched text returns undefined |
| TC-FS-007 | lib/formatStatusContent | Edge | Handles empty input |
| TC-JF-007 | lib/javaFormatter | Edge | Strips consecutive blank lines |
| TC-JF-009 | lib/javaFormatter | Edge | Handles empty string |
| TC-IN-003 | lib/indentation | Edge | `handleEnterKey` no double close brace |
| TC-IN-008 | lib/indentation | Edge | `handleClosingBrace` returns null when correctly aligned |
| TC-BM-006 | lib/buildMetrics | Edge | GPU metrics skipped when performance is null |
| TC-EB-004 | components/ErrorBoundary | Edge | Resets error state when children replaced |

### 2.3 Complex (2 tests)

Multi-step orchestration with state rollback and API failure recovery.

| ID | Module | Type | Scenario | Complexity Reason |
|----|--------|------|----------|-------------------|
| TC-ST-006 | store/useChatStore | Edge | `deleteSession` rollback on API failure | State backup, API call, mock failure, and state restoration — multi-step transactional pattern |
| TC-ST-008 | store/useChatStore | Edge | `renameSession` rollback on API failure | Optimistic update, API failure detection, title reversion to original — mirror of delete rollback |

---

## Summary

| Category | Backend Unit | Backend Integration | Frontend Unit | Frontend Integration | **Total** |
|----------|:-----------:|:------------------:|:-------------:|:--------------------:|:---------:|
| Simple   | 127         | 8                  | 72            | 5                   | **212**   |
| Edge     | 36          | 1                  | 10            | 0                   | **47**    |
| Complex  | 4           | 3                  | 2             | 0                   | **9**     |
| _Total_  | _167_       | _12_               | _84_          | _5_                 | **268**   |

_All categorization decisions follow the criteria: **Simple** = direct input/output, single function call; **Edge** = boundary conditions, empty/null, error recovery; **Complex** = multi-step orchestration, retry logic, multi-mock coordination._
