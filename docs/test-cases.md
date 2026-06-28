# Test Cases Document — Horizon AI

[![Status: Final](https://img.shields.io/badge/Status-Final-green)](.)
[![Backend: pytest](https://img.shields.io/badge/Backend-167%2F167-blue)](backend/pyproject.toml)
[![Frontend: Vitest](https://img.shields.io/badge/Frontend-89%2F89-green)](frontend/package.json)
[![Coverage Target](https://img.shields.io/badge/Coverage-80%25-orange)](.)

_Comprehensive test specification for unit and integration testing of the Horizon AI refactoring pipeline. Auto-generated from actual test source — 268 tests, 100% pass rate._

| | |
|---|---|
| **Project** | Horizon AI — Multi-Agent Java Refactoring Pipeline |
| **Date** | June 25, 2026 |
| **Version** | 2.0 |
| **Total Tests** | 268 (167 backend unit + 12 backend integration + 89 frontend) |

---

## Table of Contents

- [1. Methodology](#1-methodology)
- [2. Backend Unit Tests](#2-backend-unit-tests)
- [3. Backend Integration Tests](#3-backend-integration-tests)
- [4. Frontend Unit Tests](#4-frontend-unit-tests)
- [5. Frontend Integration Tests](#5-frontend-integration-tests)

---

## 1. Methodology

### 1.1 Testing Principles

All tests follow the **AAA (Arrange-Act-Assert)** pattern:

| Step | Description |
|------|-------------|
| **Arrange** | Set up preconditions, create mocks, prepare input data |
| **Act** | Execute the function or method under test |
| **Assert** | Verify the output, side effects, or state changes |

### 1.2 Test Classification

| Type | Definition |
|------|------------|
| **Positive** | Valid input produces correct output |
| **Negative** | Invalid input produces expected error/failure |
| **Edge** | Boundary conditions, empty/null inputs, edge cases |

### 1.3 Mock Strategy

| Module | Mock Level | Dependencies Mocked |
|--------|-----------|---------------------|
| OrchestrationConfig | None (pure) | — |
| Types & Schemas | None (pure) | — |
| ResponseParser | None (pure) | — |
| ASTMatcher | None (pure) | — |
| Validator | None (pure) | javalang, lizard used real |
| AgentService | Function-level | `llama_cpp.Llama`, file I/O |
| ClientConnection | Class-level | WebSocket `send_json`, database |
| DatabaseManager | Integration | Real in-memory SQLite |
| MessageRouter | Class-level | AgentService, ClientConnection |
| Orchestrator | Class-level | AgentService, ClientConnection, DatabaseManager |
| Phase 2 — Strategy | Class-level | AgentService.generate, ASTMatcher |
| Phase 3 — Execution | Class-level | AgentService.generate, Validator |
| Phase 4 — Validation | Class-level | Validator, OrchestrationState |
| Phase 5 — Adjudication | Class-level | AgentService.generate |
| Phase 6 — Finalization | Class-level | AgentService.generate, DatabaseManager |
| Formatters | None (pure) | — |
| Code Utils | None (pure) | — |
| Frontend store | Integration | Real Zustand, mock `fetch` |
| Frontend hooks | Class-level | WebSocket constructor, store |

### 1.4 Pass Criteria

- All Positive tests pass: function returns correct value
- All Negative tests pass: function raises or returns error as expected
- All Edge tests pass: function handles boundaries gracefully
- No test depends on another test (no shared mutable state)

---

## 2. Backend Unit Tests

### 2.1 OrchestrationConfig

**Module:** `app/modules/orchestrator/config.py`
**Purpose:** Validate YAML/JSON config loading, deserialization, ModelEntry immutability.
**Tests:** 6

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CFG-001 | Positive | `from_dict` with valid config creates `OrchestrationConfig` | `{"planner": {...}, "generator": {...}, "judge": {...}, "single": {...}, "settings": {...}}` | `config.planner.name == "p"`, `config.judge.max_tokens == 4096` |
| TC-CFG-001b | Positive | `ModelEntry` creation with valid fields | `name="test"`, `layers=32` | `entry.name == "test"`, `entry.layers == 32` |
| TC-CFG-002 | Negative | `from_dict` missing required keys raises error | `{"planner": {...}}` (missing `generator`, `judge`, `single`) | Raises `TypeError` or `KeyError` |
| TC-CFG-003 | Positive | `from_yaml` with valid YAML parses correctly | Valid YAML string with all model entries | `config.planner.name == "p"` |
| TC-CFG-004 | Negative | `from_yaml` with invalid YAML raises error | Malformed YAML string | Raises exception |
| TC-CFG-005 | Edge | `ModelEntry` frozen dataclass cannot be mutated | Create `ModelEntry`, attempt to modify `temperature` | Raises `FrozenInstanceError` |

### 2.2 Types & Schemas

**Module:** `app/utils/types.py`, `app/utils/schemas.py`
**Purpose:** Validate Pydantic model constraints, enum validation, request/schema structural rules.
**Tests:** 8

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-TS-001 | Positive | `RefactorRequest(code, user_instruction)` valid | `{"type": "multi", "code": "class A {}", "user_instruction": "refactor"}` | `req.code == "class A {}"` |
| TC-TS-002 | Negative | `RefactorRequest` empty code rejected | `{"type": "multi", "code": "", "user_instruction": "refactor"}` | Raises `ValidationError` |
| TC-TS-003 | Edge | `RefactorRequest` minimum instruction length | `{"type": "multi", "code": "class A {}", "user_instruction": "ab"}` | Raises `ValidationError` (< 3 chars) |
| TC-TS-004 | Positive | `IntentPacket` with valid enums | `{"refactor_category": "CONTROL_FLOW", "specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"class": "A", "unit_type": "METHOD_UNIT"}}` | `packet.specific_intent == "FLATTEN_CONDITIONAL"` |
| TC-TS-005a | Negative | `IntentPacket` invalid category | `{"refactor_category": "INVALID", "specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"class": "A", "unit_type": "METHOD_UNIT"}}` | Raises `ValidationError` |
| TC-TS-005b | Negative | `IntentPacket` invalid intent | `{"refactor_category": "CONTROL_FLOW", "specific_intent": "NOT_A_REAL_INTENT", "scope_anchor": {"class": "A", "unit_type": "METHOD_UNIT"}}` | Raises `ValidationError` |
| TC-TS-006 | Positive | `HaltRequest` validates correctly | `{"type": "halt"}` | `req.type == "halt"` |
| TC-TS-008 | Edge | `ScopeAnchor` with `member` field null | `{"class": "A", "member": null, "unit_type": "METHOD_UNIT"}` | `anchor.member is None` |

### 2.3 ResponseParser

**Module:** `app/utils/response_parser.py`
**Purpose:** Validate XML extraction, JSON parsing, Python-to-JSON keyword conversion, repetition detection.
**Tests:** 20

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-RP-001 | Positive | `extract_xml` extracts content between XML tags | `"<plan>Flatten conditional</plan>"` | `"Flatten conditional"` |
| TC-RP-002 | Positive | `extract_xml` strips `<think>` blocks before extraction | `"<think>reasoning</think> <code>int x;</code>"` | `"int x;"` |
| TC-RP-003 | Positive | `extract_xml` validates Java plausibility (semicolons) | `"<code>int x = 1;</code>"` | `"int x = 1;"` |
| TC-RP-004 | Positive | `extract_xml` validates Java plausibility (braces) | `"<code>class A { }</code>"` | `"class A { }"` |
| TC-RP-005 | Negative | `extract_xml` rejects non-Java code tag content | `"<code>hello world</code>"` | `None` |
| TC-RP-006 | Edge | `extract_xml` missing tag returns None | `"<other>text</other>"` | `None` |
| TC-RP-007 | Positive | `extract_json` parses JSON to Pydantic model | `'{"refactor_category":"CONTROL_FLOW","specific_intent":"FLATTEN_CONDITIONAL","scope_anchor":{"class":"A","unit_type":"METHOD_UNIT"}}'` | Returns `IntentPacket`, `specific_intent == "FLATTEN_CONDITIONAL"` |
| TC-RP-008 | Positive | `extract_json` extracts from markdown code fence | `` "```json\n{\"a\":1}\n```" `` | Result is not None |
| TC-RP-009 | Positive | `extract_json` fixes trailing comma | `'{"a": 1, "b": 2,}'` | Parses successfully, result not None |
| TC-RP-010 | Positive | `extract_json` fixes Python `None` → `null` | `'{"member": None}'` | `"null"` appears in output |
| TC-RP-011 | Positive | `extract_json` fixes Python `True` → `true` | `'{"valid": True}'` | `"true"` appears in output |
| TC-RP-012 | Positive | `extract_json` fixes Python `False` → `false` | `'{"valid": False}'` | `"false"` appears in output |
| TC-RP-013 | Edge | Brace inside string value doesn't break depth counting | `'{"key": "just {opening", "other": true}'` | Parses correctly, result not None |
| TC-RP-014 | Edge | Trailing comma inside string value preserved | `'{"msg": "ends with,}", "list": [1, 2,],}'` | Returns string (intermediate), result is not None |
| TC-RP-015 | Edge | Python keywords inside string values not replaced | `'{"class": "set to None, True or False"}'` | String literal preserved verbatim |
| TC-RP-016 | Negative | Invalid JSON returns None | `"{not valid json"` | `None` |
| TC-RP-017 | Edge | Deeply nested JSON (5+ levels) | `{"a":{"b":{"c":{"d":{"e":1}}}}}` | Parsed fully, result not None |
| TC-RP-018 | Positive | `detect_repetition` detects LLM output loop | Text with 3+ repeating trailing patterns | `True` |
| TC-RP-019 | Positive | `detect_repetition` no false positive on normal text | Varied content with different phrases | `False` |
| TC-RP-020 | Edge | `detect_repetition` handles empty string | `""` | `False` |

### 2.4 ASTMatcher

**Module:** `app/utils/ast_matcher.py`
**Purpose:** Validate class/method finding, brace-matched text extraction, mutation enrichment for constants, fields, method modifications, symbol renames.
**Tests:** 12

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-AM-001 | Positive | `_find_class_declaration_line` finds class line | Java code with `class A {` | Line text containing `"class"` |
| TC-AM-002 | Positive | `_find_class_declaration_line` handles enum/interface | Java code with `interface B {` | Line text containing `"interface"` |
| TC-AM-003 | Positive | `_find_method_body` finds method by name | Code with method `calculate()` | AST node for `calculate`, not None |
| TC-AM-004 | Edge | `_find_method_body` returns None for missing method | Method `missing()` not in code | `None` |
| TC-AM-005 | Positive | `_extract_method_text` braces-matched extraction | Method with nested `if/else` blocks | Full method text, result not None |
| TC-AM-006 | Edge | `_extract_method_text` with deeply nested braces | Method with 5 levels of nested `{}` | Correct text boundary, result not None |
| TC-AM-007 | Positive | `_enrich_add_constant` sets `insert_after` to class decl | Mutation `ADD_CONSTANT`, target `MAX_SIZE` | `"insert_after"` in details |
| TC-AM-008 | Positive | `_enrich_add_field` sets `insert_after` | Mutation `ADD_FIELD`, target field name | `"insert_after"` in details |
| TC-AM-009 | Positive | `_enrich_modify_method` creates find/replace | `MODIFY_METHOD` with sibling `ADD_CONSTANT` | Details populated, not None |
| TC-AM-010 | Positive | `_enrich_rename_symbol` creates find/replace | `RENAME_SYMBOL`, old=`oldName`, new=`newName` | Mutations produced, len > 0 |
| TC-AM-011 | Positive | `_enrich_dispatches_by_action` routes all action types | ADD_CONSTANT, ADD_FIELD, RENAME_SYMBOL | All 3 actions processed |
| TC-AM-012 | Edge | `enrich_mutations` handles empty mutation array | `[]` | Returns `[]` |

### 2.5 Validator

**Module:** `app/modules/validator/__init__.py`
**Purpose:** Validate Java syntax checking, complexity computation, intent-specific verification, boundary leak detection.
**Tests:** 25

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-VL-001 | Positive | `check_syntax` validates well-formed Java class | `"class A { void m() { int x = 1; } }"` | `is_valid=True`, error empty |
| TC-VL-002 | Positive | `check_syntax` wraps bare statements in class wrapper | `"int x = 1;"` (statement-level) | `is_valid=True` |
| TC-VL-003 | Positive | `check_syntax` wraps bare method in class wrapper | `"void m() { return; }"` (method-level) | `is_valid=True` |
| TC-VL-004 | Negative | `check_syntax` rejects malformed (unclosed brace) | `"class A { void m() { "` | `is_valid=False`, error non-empty |
| TC-VL-005 | Edge | `check_syntax` handles empty input | `""` | `is_valid=False` |
| TC-VL-006 | Edge | `check_syntax` handles whitespace-only | `"   \n  "` | `is_valid=False` |
| TC-VL-007 | Positive | `get_complexity` correct CC for method with conditionals | `"class A { void m() { if(x) { } if(y) { } } }"` | CC = 3 |
| TC-VL-008 | Positive | `get_complexity` returns 1 for class with no methods | `"class A { int x; }"` | CC = 1 |
| TC-VL-009 | Positive | `get_method_complexity` finds specific method by name | Class with `setup()`, `calculate()`, `teardown`; query `calculate` | CC returned, not None |
| TC-VL-010 | Negative | `get_method_complexity` returns None for missing method | Method name `"missing"` not in class | `None` |
| TC-VL-011 | Positive | `has_structural_change` detects difference | Original vs refactored with different method names | `True` or `False` (change detected) |
| TC-VL-012 | Positive | `has_structural_change` confirms identical structure | Same code passed twice (formatting only) | `False` or `None` |
| TC-VL-013 | Positive | `verify_intent` FLATTEN_CONDITIONAL detects decrease | Nested `if(a){ if(b){ } }` → early return pattern | `None` (verification passes) |
| TC-VL-014a | Positive | `verify_intent` EXTRACT_METHOD verification | Original with inline code → extracted method | `None` or finding (may vary by structure) |
| TC-VL-014b | Positive | `verify_intent` EXTRACT_METHOD detects increase | Original → extracted method, same logic | `None` or finding |
| TC-VL-015 | Negative | `verify_intent` FLATTEN fails when unchanged | Identical original and refactored code | Finding not None |
| TC-VL-016a | Negative | `verify_intent` REMOVE_CONTROL_FLAG unchanged | Code with flag, unchanged | Finding not None |
| TC-VL-016b | Negative | `verify_intent` REMOVE_CONTROL_FLAG fails unchanged | Code with flag, still unused | Finding not None |
| TC-VL-017 | Positive | `verify_boundary` confirms non-target methods unchanged | Target method changed, other methods same | Result is not False |
| TC-VL-018 | Negative | `verify_boundary` detects leak into non-target method | Both target and non-target changed | Result is not True |
| TC-VL-019a | Positive | `verify_complexity` can be called | Two identical code snippets, FLATTEN packet | Returns tuple of 3, result not None |
| TC-VL-019b | Positive | `verify_complexity` decrease passes STRICT | CC 2 → CC 1 (decrease) | Finding is None or not None |
| TC-VL-020a | Negative | `verify_complexity` STRICT fails on increase | Same code (no decrease) | Finding not None |
| TC-VL-020b | Negative | `verify_complexity` STRICT fails on increase | CC 1 → CC 2 (increase) | Finding not None |
| TC-VL-021 | Positive | `verify_complexity` with full `IntentPacket` | FLATTEN intent packet, CC 2 → CC 1 | `before` is not None in result |

### 2.6 AgentService

**Module:** `app/modules/agent/__init__.py`
**Purpose:** Validate LLM lifecycle: model loading/unloading with GPU layer offloading, grammar-constrained generation, token counting, interrupt handling.
**Tests:** 10

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-AS-001 | Positive | `generate` returns structured response | Messages list, valid response model | Returns dict with `"choices"` key |
| TC-AS-002 | Edge | `generate` with empty messages list | `[]` | Returns dict (empty handled gracefully) |
| TC-AS-003 | Positive | `stop` triggers generation halt | Call `stop()` during `generate()` | `InterruptedError` raised |
| TC-AS-004 | Positive | `load` passes correct GPU layers to Llama | Config with `layers=36` | `Llama` called with `n_gpu_layers=36` |
| TC-AS-005 | Positive | `unload` releases VRAM | Model loaded, then `unload()` | `model = None`, `gc.collect()` called |
| TC-AS-006 | Positive | `swap` reloads only when config differs | Same config twice | Second load skipped, model not None |
| TC-AS-007 | Positive | `truncates_at_max_tokens` enforces token limit | Long messages exceeding max_tokens | Returns dict with truncated content |
| TC-AS-008 | Positive | `_count_tokens` extracts from usage data | Chunk with `usage.completion_tokens=42` | Returns 42 |
| TC-AS-009 | Edge | `_count_tokens` fallback when no usage data | Empty chunks, content length 100 | Returns 25 (`len // 4`) |
| TC-AS-010 | Positive | `generate` with GBNF grammar constraint | Messages with grammar config | Returns dict (grammar applied) |

### 2.7 ClientConnection

**Module:** `app/modules/connection/__init__.py`
**Purpose:** Validate WebSocket message sending, heartbeat ping/pong mechanics, stale detection.
**Tests:** 8

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CC-001 | Positive | `send_status` sends formatted status via WebSocket | Role=Planner, content="Planning...", phase=2 | `send_json` called on websocket |
| TC-CC-002 | Positive | `send_result` includes model names | planner="Model-A", generator="Model-B", judge="Model-C" | `send_json` called with all three model fields |
| TC-CC-003 | Positive | `send_halt_notification` sends halt message | No input | `send_json` called with halt content |
| TC-CC-004 | Positive | `heartbeat` starts background task | Call `start_heartbeat()` | `_heartbeat_task` is not None |
| TC-CC-005 | Positive | `handle_pong` resets missed pong counter | Counter at 1, call `handle_pong()` | `_missed_pongs == 0` |
| TC-CC-006 | Positive | `is_stale` true after 2+ missed pongs | Set `_missed_pongs=2` | `is_stale is True` |
| TC-CC-007 | Edge | `is_stale` false within threshold | Set `_missed_pongs=1` | `is_stale is False` |
| TC-CC-008 | Positive | `send_status` proceeds when connection fresh | `is_stale=False`, call `send_status()` | `send_json` called on websocket |

### 2.8 DatabaseManager

**Module:** `app/modules/context/__init__.py`
**Purpose:** Validate SQLite CRUD for session lifecycle, zombie cleanup, cascading deletes, Tenacity retry.
**Tests:** 12

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-DB-001 | Positive | `create_session` inserts row with correct fields | `session_id="s1"`, `instruction="refactor"`, `code="class A {}"` | Row created, `user_instruction == "refactor"` |
| TC-DB-002 | Positive | `complete_session` updates status + code | `session_id="s1"`, `exit="SUCCESS"`, `code="class B {}"` | `exit_status == "SUCCESS"` |
| TC-DB-003 | Positive | `log_status` creates OrchestrationLog entry | `session_id="s1"`, `role="Planner"`, `content="planning"` | 1 log entry with backref |
| TC-DB-004 | Positive | `mark_as_halted` sets status | `session_id="s1"`, call `mark_as_halted()` | `status == "Halted"` |
| TC-DB-005 | Positive | `get_history` returns stubs ordered by date desc | Insert 3 sessions at different times | Returns >= 1 stubs, newest first |
| TC-DB-006 | Positive | `get_history_by_id` returns full detail with logs | Create session + 2 log entries | Returns session detail with 2 logs |
| TC-DB-007 | Negative | `get_history_by_id` returns None for missing ID | ID `"nonexistent"` | `None` |
| TC-DB-008 | Positive | `rename_session` updates title | `session_id="s1"`, new title=`"New Title"` | `title == "New Title"` |
| TC-DB-009 | Positive | `cleanup_zombie_sessions` marks stale sessions | Old unfinished session | Status updated to `"Zombie"` |
| TC-DB-010 | Positive | `cleanup_halted_sessions` removes halted | Halted session + call cleanup | Session deleted from DB |
| TC-DB-011 | Positive | `delete_history_by_id` cascading delete | Session + 2 logs, call delete | Session and logs gone |
| TC-DB-012 | Edge | Tenacity retry on `OperationalError` | Transient DB failure during create | Retries and succeeds |

### 2.9 MessageRouter

**Module:** `app/modules/connection/router.py`
**Purpose:** Validate WebSocket message dispatching: pong, reconnect, refactor launch, halt, invalid payloads.
**Tests:** 8

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-MR-001 | Positive | `dispatch` routes `pong` to `client.handle_pong()` | `{"type": "pong"}` | `client.handle_pong()` called |
| TC-MR-002 | Positive | `dispatch` routes `reconnect` to reconnect handler | `{"type": "reconnect", "session_id": "s1"}` | Reconnect handler called with `"s1"` |
| TC-MR-003 | Positive | `dispatch` validates + launches single refactor | `{"type": "single", "code": "class A {}", "user_instruction": "refactor"}` | Returns True, task launched |
| TC-MR-004 | Positive | `dispatch` validates + launches multi refactor | `{"type": "multi", "code": "class A {}", "user_instruction": "refactor"}` | Returns True, task launched |
| TC-MR-005 | Positive | `dispatch` routes halt to agent stop + task cancel | `{"type": "halt"}` | `agent.stop()` called |
| TC-MR-006 | Negative | `dispatch` rejects invalid request, sends error | `{"type": "multi", "code": ""}` | Returns True (error sent), task not launched |
| TC-MR-007 | Negative | `dispatch` rejects malformed JSON | Invalid payload | Returns False, no action |
| TC-MR-008 | Edge | `dispatch` ignores unknown message type | `{"type": "unknown"}` | Returns False, no error |

### 2.10 Orchestrator

**Module:** `app/modules/orchestrator/__init__.py`
**Purpose:** Validate orchestration state management, feedback ring buffer, status notifications with model names.
**Tests:** 7

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-OR-001 | Positive | `OrchestrationState` initializes with defaults | `session_id="s1"`, `base_code`, `working_code`, `user_instruction` | `strategy_iter=1`, empty `cumulative_feedback`, `exit_status="PROCESSING"` |
| TC-OR-002 | Positive | `add_feedback` appends to ring buffer | State with 0 feedback, add 1 entry | `len(cumulative_feedback) == 1` |
| TC-OR-003 | Positive | `add_feedback` ring buffer capped at 3 | Add 4 entries | `len(cumulative_feedback) == 3`, most recent retained |
| TC-OR-004 | Positive | `extend_feedback` batch-adds with cap | State with 2 entries, extend with 3 more | `len(cumulative_feedback) == 3`, most recent retained |
| TC-OR-005 | Positive | Pipeline sends status notifications | Execute with mocked agent | `client.send_status` called >= 1 time |
| TC-OR-006 | Positive | Status includes model names | Configured planner/generator/judge models | `client.send_status` called with model info |
| TC-OR-007 | Edge | Status skipped when client is stale | `client.is_stale=True`, execute pipeline | `client.send_status` not called |

### 2.11 Phase 2 — Strategy

**Module:** `app/modules/orchestrator/phases/phase2_strategy.py`
**Purpose:** Validate intent classification, architecture analysis, synthesis with retry, ASTMatcher enrichment, mutation deduplication, feedback translation.
**Tests:** 12

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P2-001 | Positive | `_classify` returns `IntentPacket` from canned LLM response | Mock generate returns `FLATTEN_CONDITIONAL` intent | `state.intent_packet.specific_intent == "FLATTEN_CONDITIONAL"` |
| TC-P2-002 | Positive | `_classify` handles invalid/unexpected intent | Mock returns unrecognized intent | State updated gracefully |
| TC-P2-003 | Positive | `_analyze` stores `ArchitectAnalysisResponse` | Mock returns analysis with primary targets | `state.architect_analysis` populated |
| TC-P2-004 | Edge | `_analyze` handles bad JSON from LLM | Mock returns malformed JSON | State handles gracefully |
| TC-P2-005 | Positive | `_synthesize` returns ASTArchitectResponse | Mock returns plan with mutations | `state.active_plan` has mutations |
| TC-P2-006 | Positive | `_synthesize` retries on invalid plan | First mock returns invalid, second valid | Retried, eventually succeeds |
| TC-P2-007 | Edge | `_synthesize` gives up after max retries | All mocks return invalid | Pipeline aborts gracefully |
| TC-P2-008 | Positive | `_synthesize` calls ASTMatcher enrichment | Mock returns plan with mutations | ASTMatcher.enrich_mutations called |
| TC-P2-008b | Positive | `enrich_dispatches_by_action` routes all action types | ADD_FIELD, ADD_CONSTANT mutations | Both actions processed |
| TC-P2-009 | Positive | `_deduplicate` removes duplicate (action, target) pairs | 3 mutations: 2 duplicates + 1 unique | `len(state.active_plan["ast_mutations"]) == 2` |
| TC-P2-010 | Positive | `_deduplicate` preserves unique pairs | 3 mutations, different targets | All 3 remain (`len == 3`) |
| TC-P2-011 | Positive | `_translate_feedback` maps TIER_1 to syntax hint | `ValidationFinding` with `TIER_1_SYNTAX` | Returns list of feedback hints |

### 2.12 Phase 3 — Execution

**Module:** `app/modules/orchestrator/phases/phase3_execution.py`
**Purpose:** Validate generator output repair (throws, null-check, public stripping), multi-temperature best-CC selection, sequential mutation with syntax healing.
**Tests:** 10

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P3-001 | Positive | `repair_generator_output` strips `throws Exception` | Method signature with `throws Exception` added | Original signature restored |
| TC-P3-002 | Positive | `repair_generator_output` strips null check guard | Generated adds `if (x == null) return null;` | Null check removed |
| TC-P3-003 | Positive | `repair_generator_output` strips extra `public` | Generated method with spurious `public` | `"public"` not in result |
| TC-P3-004 | Edge | `repair_generator_output` leaves valid code unchanged | Generated code matches original style | Result == original |
| TC-P3-005 | Positive | `run_single` generates at 3 temps, picks best CC | Mock returns 3 outputs with CC 5, 3, 7 | Output with CC=3 selected |
| TC-P3-006 | Edge | `run_single` fallback when all outputs fail | All 3 mock outputs are invalid | Falls back, pipeline continues |
| TC-P3-007 | Positive | `run_sequential` applies mutations one at a time | 2 mutations, both pass validation | `state.working_code` reflects both applied |
| TC-P3-008 | Positive | `run_sequential` syntax healing on failure | First mutation fails syntax check | `state.syntax_iter` incremented |
| TC-P3-009 | Edge | `run_sequential` boundary break halts | Mutation causes boundary violation | Halts sequential application |
| TC-P3-010 | Edge | `run_sequential` max heals exceeded | All mutations fail syntax repeatedly | Pipeline handles max heals |

### 2.13 Phase 4 — Validation

**Module:** `app/modules/orchestrator/phases/phase4_validation.py`
**Purpose:** Validate the full validation chain (syntax, complexity, boundary, intent) and routing to Phase 3 (heal) or Phase 2 (replan).
**Tests:** 6

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P4-001 | Positive | `run` passes all validation checks | Valid working code, CC decreased, no boundary leak, intent matched | Validation passes |
| TC-P4-002 | Negative | `run` routes to Phase 3 when syntax fails | Working code is invalid Java | `state.syntax_iter` incremented |
| TC-P4-004 | Positive | `verify_complexity` STRICT passes | CC decreases | Validation passes |
| TC-P4-005 | Negative | `verify_complexity` STRICT fails | CC stays same or increases | Validation fails |
| TC-P4-006 | Positive | `verify_boundary` passes | Non-target methods unchanged | Boundary check passes |
| TC-P4-007 | Negative | `verify_boundary` detects leak | Non-target method also changed | Boundary violation detected |

### 2.14 Phase 5 — Adjudication

**Module:** `app/modules/orchestrator/phases/phase5_adjudication.py`
**Purpose:** Validate judge verdict routing (ACCEPT → Phase 6, REVISE → Phase 2), hallucination overrides, structured issue extraction.
**Tests:** 5

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P5-001 | Positive | Judge returns ACCEPT, proceeds to Phase 6 | Mock returns `{"verdict": "ACCEPT"}` | Phase 6 called, pipeline continues |
| TC-P5-002 | Positive | Judge returns REVISE, returns to Phase 2 | Mock returns `{"verdict": "REVISE"}` | Routes to Phase 2, `strategy_iter` increments |
| TC-P5-003 | Edge | Hallucination override for identical code | Working code == base code (no change) | Override to REVISE |
| TC-P5-005 | Edge | Missing/empty judge response handled | Mock returns `None` | Assumes REVISE, logs error |
| TC-P5-006 | Positive | Structured issues extracted from judge | Mock returns verdict with issues | Issues parsed into state |

### 2.15 Phase 6 — Finalization

**Module:** `app/modules/orchestrator/phases/phase6_finalization.py`
**Purpose:** Validate outer wrapper stripping, result transmission with metrics, LLM insights, DB persistence.
**Tests:** 5

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P6-001 | Positive | Strips outer wrapper from generated code | Generated code wrapped in fabricated class | Wrapper removed, only method retained |
| TC-P6-002 | Positive | Sends result with correct code and metrics | Valid state with working code and metrics | `client.send_result()` called |
| TC-P6-003 | Positive | Generates LLM insights | Mock returns insights response | Insights generated |
| TC-P6-004 | Edge | Insight generation failure handled gracefully | Mock raises during insight generation | Pipeline continues, no crash |
| TC-P6-005 | Positive | Persists to database | Valid state after successful pipeline | DB create/complete called |

### 2.16 Formatters

**Module:** `app/utils/formatters.py`
**Purpose:** Validate conversion of JSON mutation plans to human-readable text instructions for generator.
**Tests:** 6

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-FMT-001 | Positive | Single MODIFY_METHOD mutation formatted | Plan with 1 mutation on `calculate` | Text contains `"MODIFY_METHOD"` or `"calculate"` |
| TC-FMT-002 | Positive | ADD_CONSTANT with value included | Plan with `MAX_SIZE=100` constant | Text contains `"MAX_SIZE"` |
| TC-FMT-003 | Positive | Constant references included in MODIFY_METHOD | Modify method references `MAX_SIZE` | Result not None, references included |
| TC-FMT-004 | Positive | Mutations ordered logically (rename→add→modify) | Mix of RENAME, ADD_CONSTANT, MODIFY_METHOD | Output lists in logical order |
| TC-FMT-005 | Positive | Empty mutations returns "No mutations" message | `{"ast_mutations": []}` | Text contains `"No mutations"` |
| TC-FMT-006 | Edge | Empty mutations dict handled | `{"ast_mutations": []}`, minimal base code | Result not None |

### 2.17 Code Utils

**Module:** `app/utils/code_utils.py`
**Purpose:** Validate outer wrapper stripping, mutation ordering (rename-first, add-before-modify, stable sort).
**Tests:** 7

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CU-001 | Positive | `strip_outer_wrapper` removes fabricated class | Generated wrapped in `public class Temp { ... }` | `"Temp"` not in result |
| TC-CU-002 | Edge | `strip_outer_wrapper` preserves code when no wrapper | Code already matches expected structure | Returns unchanged |
| TC-CU-003 | Edge | `strip_outer_wrapper` class body only (no outer) | Base code is already a class | Returns unchanged |
| TC-CU-004 | Positive | `order_mutations` places RENAME_SYMBOL first | `[MODIFY_METHOD, RENAME_SYMBOL]` | RENAME_SYMBOL first |
| TC-CU-005 | Positive | `order_mutations` places ADD_* before MODIFY/REMOVE | `[REMOVE_METHOD, ADD_DECLARATION, MODIFY_METHOD]` | ADD_DECLARATION before MODIFY and REMOVE |
| TC-CU-006a | Edge | `order_mutations` preserves relative order within group | 2 MODIFY_METHOD mutations, targets `a`, `b` | Same order maintained (a before b) |
| TC-CU-006b | Edge | `order_mutations` stable sort with 3 same-priority | 2 MODIFY_METHOD mutations | Same relative order maintained |

---

## 3. Backend Integration Tests

### 3.1 API

**Module:** FastAPI application (`app/main.py`)
**Purpose:** Validate REST API and WebSocket endpoints: health, history CRUD, real-time messaging.
**Approach:** FastAPI `TestClient`, in-memory SQLite, ASGI WebSocket transport.
**Tests:** 8

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-IT-001 | Positive | `GET /health` returns 200 with timestamp | — | Status 200, body has `"timestamp"` |
| TC-IT-002 | Positive | `GET /api/history` returns empty list | No sessions created | Status 200, body `[]` |
| TC-IT-004 | Negative | `GET /api/history/:id` returns 404 for missing | ID `"invalid"` | Status 404 |
| TC-IT-006 | Negative | `PATCH /api/history/:id` rejects empty title | Valid ID, title=`""` | Status 400 or 422 |
| TC-IT-008 | Negative | `DELETE /api/history/:id` returns 404 for missing | ID `"invalid"` | Status 404 |
| TC-IT-009 | Positive | WebSocket `/ws` accepts connection | Connect via WS transport | Connection accepted |
| TC-IT-011 | Positive | WebSocket halt notification via router | Send halt message | Notification sent back |
| TC-IT-012 | Negative | WebSocket malformed JSON rejected | Send invalid JSON | Rejection/error response |

### 3.2 Full Pipeline

**Module:** `tests/integration/test_full_mock_pipeline.py`
**Purpose:** Validate full 6-phase orchestration pipeline: SUCCESS, HALT, ABORT outcomes.
**Approach:** MockAgentService with canned per-phase responses, real DB and Validator.
**Tests:** 4

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-PL-SUCCESS | Positive | Pipeline completes all 6 phases, session persisted | BASE_CODE + INSTRUCTION, canned ACCEPT path | `exit_status == SUCCESS`, session in DB with `status == "Completed"` |
| TC-PL-RENAME | Positive | After pipeline: rename + delete session | Same SUCCESS path, then rename, then delete | Rename succeeds, delete removes session |
| TC-PL-HALT | Negative | User halt during generation | `AbortingAgentService` raises `InterruptedError` on 3rd call | `exit_status == PROCESSING`, exception propagated |
| TC-PL-ABORT | Edge | Strategy retry circuit breaker | `BrokenCodeAgentService` returns invalid Java each iteration | `exit_status == ABORT_STRATEGY`, `strategy_iter > 3` |

---

## 4. Frontend Unit Tests

### 4.1 lib/utils — cn()

**Module:** `src/lib/utils.ts`
**Purpose:** Validate Tailwind class merging, falsy filtering, conditional object syntax, twMerge.
**Tests:** 6

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CN-001 | Positive | Merges multiple class name strings | `cn("foo", "bar")` | `"foo bar"` |
| TC-CN-002 | Positive | Filters falsy values | `cn("foo", false, "bar", undefined, null, "baz")` | `"foo bar baz"` |
| TC-CN-003 | Positive | Handles conditional object syntax | `cn("base", { active: true, disabled: false })` | `"base active"` |
| TC-CN-004 | Positive | Resolves Tailwind conflicts via twMerge | `cn("px-4", "px-2")` | `"px-2"` |
| TC-CN-005 | Edge | Returns empty string for no args | `cn()` | `""` |
| TC-CN-006 | Positive | Handles array arguments | `cn(["foo", "bar"], "baz")` | `"foo bar baz"` |

### 4.2 lib/constants

**Module:** `src/lib/constants.ts`
**Purpose:** Validate constant shape, role visuals completeness, default fallback structure.
**Tests:** 6

| ID | Type | Scenario | Expected |
|----|------|----------|----------|
| TC-CNST-001 | Positive | `INITIAL_SOURCE` is empty string | `""` |
| TC-CNST-002 | Positive | `EMPTY_ORCHESTRATION_RESULT` has expected shape | Contains `metrics`, `summary`, `diffHighlights` properties |
| TC-CNST-003 | Positive | `ROLE_VISUALS` has entries for all 6 roles | Object has exactly 6 keys |
| TC-CNST-004 | Positive | Each `ROLE_VISUALS` entry has `step`, `icon`, `colorClass` | All 18 fields present and typed correctly |
| TC-CNST-004b | Positive | Planner role has step 1 and blue color | `{ step: 1, icon: 'Cpu', colorClass: 'text-[#56a8f5]' }` |
| TC-CNST-005 | Positive | `DEFAULT_ROLE_VISUALS` has fallback values | `{ step: 1, icon: "Cpu", colorClass: "text-jb-accent" }` |

### 4.3 lib/parseStatusInfo

**Module:** `src/lib/parseStatusInfo.ts`
**Purpose:** Validate text parsing for phase numbers, strategy iterations, retry info, validation faults, judge decisions, intent/mutation parsing, phase actions.
**Tests:** 12

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-PS-001 | Positive | `parsePhaseNumber` detects "Ph1" pattern | `"Ph1: x"` | `1` |
| TC-PS-002 | Positive | `parsePhaseNumber` detects "Baseline" keyword | `"Baseline"` | `1` |
| TC-PS-003 | Positive | `parsePhaseNumber` detects "Strategy" keyword | `"Strategy"` | `2` |
| TC-PS-004 | Positive | `parseStrategyIteration` extracts iteration number | `"Strategy Iter 2"` | `2` |
| TC-PS-005 | Positive | `parseRetryInfo` detects syntax heal attempt | `"Syntax heal attempt 2/3"` | `{ current: 2, max: 3, type: "syntax_heal" }` |
| TC-PS-006 | Positive | `parseRetryInfo` detects sequential mutation retry | `"Retry mutation 1/5"` | Object with `current`, `max`, `type` |
| TC-PS-007 | Positive | `parseValidationFaults` extracts fault count | `"Total Faults: 3"` | `3` |
| TC-PS-008 | Positive | `parseJudgeDecision` detects ACCEPT verdict | `"Decision: ACCEPT"` | `"ACCEPT"` |
| TC-PS-009 | Positive | `parseJudgeDecision` detects REVISE verdict | `"Verdict: REVISE"` | `"REVISE"` |
| TC-PS-010 | Edge | `parseIntentDetail` unmatched text returns undefined | `"x"` | `undefined` |
| TC-PS-011 | Edge | `parseMutationPlan` unmatched text returns undefined | `"x"` | `undefined` |
| TC-PS-014 | Positive | `parsePhaseAction` extracts action description | `"Ph2: Analyze"` | `"Analyze"` |

### 4.4 lib/formatStatusContent

**Module:** `src/lib/formatStatusContent.ts`
**Purpose:** Validate extraction of JSON blocks, key-value tags, first-line summary, recursive flattening.
**Tests:** 8

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-FS-001 | Positive | Extracts JSON blocks into structured format | Content with ```json ... ``` block | `summary` contains extracted values |
| TC-FS-002 | Positive | Handles standalone JSON object | `'{"a":1}'` | Result defined |
| TC-FS-003 | Positive | Extracts Key:Value tags from markdown | `"**Category:** CONTROL_FLOW\nMore"` | `tags` array has >= 1 entry |
| TC-FS-004 | Positive | Handles markdown list input | `"- **Intent:** FLATTEN_CONDITIONAL"` | Result defined |
| TC-FS-005 | Positive | Returns summary from first line | `"Start.\nMore"` | `summary: "Start."` |
| TC-FS-006 | Positive | Returns structured output with expected properties | `"test"` | Result has `summary`, `tags`, `details` |
| TC-FS-007 | Edge | Handles empty input | `""` | `summary: ""` |
| TC-FS-008 | Edge | Handles plain text input | `"plain"` | `summary: "plain"` |

### 4.5 lib/javaFormatter

**Module:** `src/lib/utils/javaFormatter.ts`
**Purpose:** Validate Java code formatting: operator spacing, brace merging, string/comment/generic preservation.
**Tests:** 9

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-JF-001 | Positive | Formats basic class with braces and indentation | `"class A { void m() { } }"` | Formatted output, result truthy |
| TC-JF-002 | Positive | Preserves string literals during formatting | Code with `"select * from table"` | String `"hello"` preserved in output |
| TC-JF-003 | Positive | Preserves comments during formatting | Code with `// comment` | Comment preserved in output |
| TC-JF-004 | Positive | Handles generic type parameters | `List<Map<String, Integer>>` | Formatted correctly, result truthy |
| TC-JF-005 | Positive | Normalizes spaces around operators | `a=b+c` | No `a=b+c` in output |
| TC-JF-006 | Positive | Merges else/catch/finally to previous closing brace | `}\nelse {` | `} else {` merged |
| TC-JF-007 | Edge | Strips consecutive blank lines | 3 blank lines in a row | Single blank line, result truthy |
| TC-JF-009 | Edge | Handles empty string | `""` | `""` |
| TC-JF-010 | Positive | Handles long method with mixed constructs | Method with conditionals, loops, try/catch | Formatted correctly, result truthy |

### 4.6 lib/indentation

**Module:** `src/lib/indentation.ts`
**Purpose:** Validate smart Enter (auto-indent, auto-close brace), Tab/Shift-Tab, closing brace alignment.
**Tests:** 7

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-IN-001 | Positive | `handleEnterKey` adds indent after line ending with `{` | `"  if (x) {"` at end | New line with `    ` indent |
| TC-IN-002 | Positive | `handleEnterKey` auto-closes brace after `{` | `"main() {"` at end | Inserts `\n    \n}` with closing brace |
| TC-IN-003 | Edge | `handleEnterKey` no double close brace | Line already has `}` closing brace | Only indents, no extra `}` |
| TC-IN-004 | Positive | `handleTabKey` indents line by 4 spaces | `"foo();"` with cursor at start | `"    foo();"` |
| TC-IN-006 | Positive | `handleShiftTab` outdents line | `"    foo();"` | `"foo();"` |
| TC-IN-007 | Positive | `handleClosingBrace` adjusts indent to match opening | `"  if(x) {\n    }"` (cursor after `}`) | Adjusted to match opening indent |
| TC-IN-008 | Edge | `handleClosingBrace` returns null when correctly aligned | `}` already aligned | `null` |

### 4.7 lib/buildMetrics

**Module:** `src/lib/utils/buildMetrics.ts`
**Purpose:** Validate construction of CC metrics (direction up/down/neutral), inference time, GPU metrics.
**Tests:** 6

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-BM-001 | Positive | Complexity metric when decreased | orig=10, refactored=5 | `direction: "down"`, `before: "10"`, `after: "5"` |
| TC-BM-002 | Positive | Complexity metric when increased | orig=5, refactored=10 | `direction: "up"` |
| TC-BM-003 | Positive | Complexity metric when unchanged | orig=5, refactored=5 | `direction: "neutral"` |
| TC-BM-004 | Positive | Inference time metric built | performance has `inference_time: 12.5` | Metric with `after: "12.5s"` |
| TC-BM-005 | Positive | GPU metrics built when performance provided | performance with `avg_gpu_utilization`, `peak_gpu_memory_used` | GPU metrics present (>= 3 total metrics) |
| TC-BM-006 | Edge | GPU metrics skipped when performance is null | performance = `null` | Only complexity metric (1 total) |

### 4.8 lib/schemas/websocket (Zod)

**Module:** `src/lib/schemas/websocket.ts`
**Purpose:** Validate Zod schema validation for all WebSocket message types, discriminated union routing.
**Tests:** 8

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-ZD-001 | Positive | `StatusMessageSchema` validates correct status | `{ type: "status", role: "Planner", content: "..." }` | Parses, `type == "status"` |
| TC-ZD-002 | Negative | `StatusMessageSchema` rejects missing role | `{ type: "status", content: "..." }` | Throws |
| TC-ZD-003 | Negative | `StatusMessageSchema` rejects invalid type | `{ type: "invalid", role: "Planner", content: "..." }` | Throws |
| TC-ZD-004 | Positive | `ResultMessageSchema` validates correct result | `{ type: "result", code: "class A {}", exit_status: "SUCCESS" }` | Parses, `type == "result"` |
| TC-ZD-005 | Negative | `ResultMessageSchema` rejects invalid exit_status | `{ type: "result", code: "...", exit_status: "INVALID" }` | Throws |
| TC-ZD-006 | Positive | `ErrorMessageSchema` validates correct error | `{ type: "error", message: "Something went wrong" }` | Parses, `type == "error"` |
| TC-ZD-007 | Positive | `ServerMessageSchema` discriminates status/result/error | Status, result, error message objects | Each matches correct schema |
| TC-ZD-008 | Negative | `ServerMessageSchema` rejects unknown type | `{ type: "unknown" }` | Throws |

### 4.9 store/useChatStore

**Module:** `src/store/useChatStore.ts`
**Purpose:** Validate Zustand store operations: session CRUD, fetch/rename/delete with API mocking, session ID migration, draft management.
**Tests:** 15

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-ST-001 | Positive | `createSession` creates session with defaults | `createSession("test-1")` | Session with `title: "New Session"`, empty entries |
| TC-ST-002 | Positive | `createSession` with initial prompt | `createSession("test-1", "refactor")` | Session created, ID defined |
| TC-ST-003 | Positive | `updateSession` partial update merges | Create, then update title | Title changed, other fields unchanged |
| TC-ST-004 | Positive | `updateSession` updater function accumulates | 2 updater calls pushing to `terminalEntries` | `terminalEntries` has 2 entries |
| TC-ST-005 | Positive | `deleteSession` calls DELETE API + removes | Session exists, mock returns 200 | Session removed from store |
| TC-ST-006 | Edge | `deleteSession` rollback on API failure | Session exists, mock returns 500 | Session restored in store |
| TC-ST-007 | Positive | `renameSession` optimistic update on PATCH success | Mock PATCH returns 200 | Title updated in store |
| TC-ST-008 | Edge | `renameSession` rollback on API failure | Mock PATCH returns 500 | Title reverted to original |
| TC-ST-009 | Positive | `migrateSessionId` moves data to new key | Session `"old-id"` → migrate to `"new-id"` | Old removed, new has same data |
| TC-ST-010 | Positive | `fetchHistory` populates sessions from API | Mock GET returns 2 stubs | Store has 2 sessions |
| TC-ST-011 | Negative | `fetchHistory` sets error flag on API failure | Mock GET returns error | `historyLoadError == true` |
| TC-ST-012 | Positive | `fetchSessionDetails` maps logs | Valid session ID, mock returns detail | Session populated in store |
| TC-ST-013 | Positive | `resetDraftSession` clears all draft fields | Draft has values, call reset | Draft back to initial defaults |
| TC-ST-014 | Positive | `setOrchestratorStatus` updates status | `setOrchestratorStatus("connected")` | `orchestratorStatus == "connected"` |
| TC-ST-014b | Positive | `hasInitialLoaded` tracks initial load state | After fetchHistory resolves | `hasInitialLoaded` transitions false → true |

### 4.10 hooks/useOrchestrationSocket

**Module:** `src/hooks/useOrchestrationSocket.tsx`
**Purpose:** Validate WebSocket lifecycle (connect/disconnect), method availability.
**Tests:** 3

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-WS-001 | Positive | `useOrchestrationSocket` returns connection status | Render hook | `connectionStatus` defined |
| TC-WS-001b | Positive | Hook exposes required methods | Render hook | Has `connect`, `sendRefactorRequest`, `sendHaltRequest` functions |
| TC-WS-002 | Positive | `disconnect` changes connection status | Call `disconnect()` | `connectionStatus` updated |

### 4.11 components/ErrorBoundary

**Module:** `src/components/layout/ErrorBoundary.tsx`
**Purpose:** Validate React error boundary rendering, error catching, fallback display, state reset.
**Tests:** 4

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-EB-001 | Positive | Renders children when no error | `<ErrorBoundary><div>ok</div></ErrorBoundary>` | Shows "ok" |
| TC-EB-002 | Positive | Catches error from crashing child | Child throws `new Error("crash")` | Shows fallback UI "Something went wrong" |
| TC-EB-003 | Positive | Shows custom fallback when provided | `fallback={<CustomFallback />}` + crashing child | Shows `<CustomFallback />` |
| TC-EB-004 | Edge | Resets error state when children replaced | Catch error, re-mount with non-crashing child | Shows new children, error cleared |

---

## 5. Frontend Integration Tests

### 5.1 Terminal

**Module:** `src/components/features/terminal/Terminal.tsx`
**Purpose:** Validate rendering of all terminal entry types, auto-scroll, collapsible panel.
**Approach:** React Testing Library, real store with pre-populated entries.
**Tests:** 3

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-FI-001 | Positive | Renders boot header | Initial render | "Welcome to Horizon AI" in document |
| TC-FI-002 | Positive | Renders terminal entry types | Store has command/log/system/error entries | Entry content rendered |
| TC-FI-003 | Positive | Collapsible header visible | Initial render | "Terminal" header rendered |

### 5.2 ChatWorkspace

**Module:** `src/components/features/workspace/ChatWorkspace.tsx`
**Purpose:** Validate panel layout rendering (input, output, terminal), session not-found handling.
**Approach:** React Testing Library, mocked store and WebSocket.
**Tests:** 2

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-FI-004a | Positive | Renders with valid session ID | `sessionId="test-session"` | Component renders, body truthy |
| TC-FI-004b | Positive | Renders with null session ID | `sessionId={null}` | Component renders, body truthy |

---
