# Test Cases Document — Horizon AI

[![Status: Draft](https://img.shields.io/badge/Status-Draft-yellow)](.)
[![Backend: pytest](https://img.shields.io/badge/Backend-pytest-blue)](backend/pyproject.toml)
[![Frontend: Vitest](https://img.shields.io/badge/Frontend-Vitest-green)](frontend/package.json)
[![Coverage Target](https://img.shields.io/badge/Coverage-80%25-orange)](.)

_Comprehensive test specification for unit and integration testing of the Horizon AI refactoring pipeline._

| | |
|---|---|
| **Project** | Horizon AI — Multi-Agent Java Refactoring Pipeline |
| **Prepared by** | QA Engineering Team |
| **Date** | June 24, 2026 |
| **Version** | 1.0 |
| **Purpose** | Verify correctness, reliability, and edge-case resilience of all backend and frontend modules through isolated unit tests and integrated API, WebSocket, and component-level testing. |

---

## Table of Contents

- [Section 1: Methodology](#section-1-methodology)
- [Section 2: Backend Unit Tests](#section-2-backend-unit-tests)
  - [2.1 OrchestrationConfig](#21-orchestrationconfig)
  - [2.2 Types & Schemas](#22-types--schemas)
  - [2.3 ResponseParser](#23-responseparser)
  - [2.4 ASTMatcher](#24-astmatcher)
  - [2.5 Validator](#25-validator)
  - [2.6 AgentService](#26-agentservice)
  - [2.7 ClientConnection](#27-clientconnection)
  - [2.8 DatabaseManager](#28-databasemanager)
  - [2.9 MessageRouter](#29-messagerouter)
  - [2.10 Orchestrator](#210-orchestrator)
  - [2.11 Phase 2 — Strategy](#211-phase-2--strategy)
  - [2.12 Phase 3 — Execution](#212-phase-3--execution)
  - [2.13 Phase 4 — Validation](#213-phase-4--validation)
  - [2.14 Phase 5 — Adjudication](#214-phase-5--adjudication)
  - [2.15 Phase 6 — Finalization](#215-phase-6--finalization)
  - [2.16 Formatters](#216-formatters)
  - [2.17 Code Utils](#217-code-utils)
- [Section 3: Backend Integration Tests](#section-3-backend-integration-tests)
- [Section 4: Frontend Unit Tests](#section-4-frontend-unit-tests)
  - [4.1 lib/utils — cn()](#41-libutils--cn)
  - [4.2 lib/constants](#42-libconstants)
  - [4.3 lib/parseStatusInfo](#43-libparsestatusinfo)
  - [4.4 lib/formatStatusContent](#44-libformatstatuscontent)
  - [4.5 lib/javaFormatter](#45-libjavaformatter)
  - [4.6 lib/indentation](#46-libindentation)
  - [4.7 lib/buildMetrics](#47-libbuildmetrics)
  - [4.8 lib/schemas/websocket (Zod)](#48-libschemassocket-zod)
  - [4.9 store/useChatStore](#49-storeusechatstore)
  - [4.10 hooks/useOrchestrationSocket](#410-hooksuseorchestrationsocket)
  - [4.11 components/ErrorBoundary](#411-componentserrorboundary)
- [Section 5: Frontend Integration Tests](#section-5-frontend-integration-tests)
- [Section 6: Test Execution Matrix](#section-6-test-execution-matrix)

---

## Section 1: Methodology

### 1.1 Testing Principles

This test suite follows the **AAA (Arrange-Act-Assert)** pattern:

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
| Validator | None (pure) | External libraries (javalang, lizard) used real |
| AgentService | Function-level | `llama_cpp.Llama`, file I/O |
| ClientConnection | Class-level | WebSocket `send_json`, database |
| DatabaseManager | Integration | Real in-memory SQLite (no mock) |
| MessageRouter | Class-level | AgentService, ClientConnection |
| Orchestrator | Class-level | AgentService, ClientConnection, DatabaseManager |
| Phase 2 — Strategy | Class-level | AgentService.generate, ASTMatcher |
| Phase 3 — Execution | Class-level | AgentService.generate, Validator |
| Phase 4 — Validation | Class-level | Validator, OrchestrationState |
| Phase 5 — Adjudication | Class-level | AgentService.generate |
| Phase 6 — Finalization | Class-level | AgentService.generate, DatabaseManager |
| Formatters | None (pure) | — |
| Code Utils | None (pure) | — |
| Frontend store | Integration | Real Zustand state, mock `fetch` |
| Frontend hooks | Class-level | WebSocket constructor, store |

### 1.4 Status Convention

Throughout this document, each section header includes an implementation status:

| Badge | Meaning |
|-------|---------|
| ✅ **X/Y done** | X test cases implemented out of Y documented (remainder are aspirational) |
| 📋 Planned | Documented as a specification but not yet implemented in code |

### 1.5 Pass Criteria

- All **Positive** tests pass: function returns correct value
- All **Negative** tests pass: function raises or returns error as expected
- All **Edge** tests pass: function handles boundaries gracefully
- **No test** may depend on another test (no shared mutable state between cases)

---

## Section 2: Backend Unit Tests

> **Status:** 125 of 170 documented cases implemented. See Execution Matrix for per-module breakdown. Unimplemented cases are retained as a specification for future work.

### 2.1 OrchestrationConfig

**Module:** `app/modules/orchestrator/config.py`
**Purpose:** Validate YAML/JSON config loading, deserialization, and immutability of model configuration entries.
**Mock strategy:** Pure functions. No mocking. Test data loaded from dict.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CFG-001 | Positive | `from_dict` with valid config creates `OrchestrationConfig` | `{"planner": {...}, "generator": {...}, "judge": {...}, "single": {...}, "settings": {...}}` | Returns populated `OrchestrationConfig` |
| TC-CFG-002 | Negative | `from_dict` missing required key raises validation error | `{"planner": {...}}` (missing `generator`, `judge`, `single`) | Raises `TypeError` or `KeyError` |
| TC-CFG-005 | Edge | `ModelEntry` frozen dataclass cannot be mutated | Create `ModelEntry`, attempt to modify `temperature` | Raises `FrozenInstanceError` |

### 2.2 Types & Schemas

**Module:** `app/utils/types.py`, `app/utils/schemas.py`
**Purpose:** Validate Pydantic model constraints, enum validation, and request/schema structural rules.
**Mock strategy:** Pure Pydantic validation. No mocking.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-TS-001 | Positive | `RefactorRequest(code, user_instruction)` valid | `{"type": "multi", "code": "class A {}", "user_instruction": "refactor"}` | Passes validation |
| TC-TS-002 | Negative | `RefactorRequest` empty code rejected | `{"type": "multi", "code": "", "user_instruction": "refactor"}` | Validation error |
| TC-TS-003 | Edge | `RefactorRequest` minimum instruction length | `{"type": "multi", "code": "class A {}", "user_instruction": "ab"}` | Validation error (< 3 chars) |
| TC-TS-004 | Positive | `IntentPacket` with valid enums | `{"refactor_category": "CONTROL_FLOW", "specific_intent": "FLATTEN_CONDITIONAL", "scope_anchor": {"class": "A", "unit_type": "METHOD_UNIT"}}` | Passes validation |
| TC-TS-005 | Negative | `IntentPacket` invalid enum value | `{"refactor_category": "INVALID", "specific_intent": "FLATTEN_CONDITIONAL"}` | Validation error |
| TC-TS-008 | Edge | `ScopeAnchor` with optional `member` field null | `{"class": "A", "member": null, "unit_type": "METHOD_UNIT"}` | `member` is `None` |

### 2.3 ResponseParser

**Module:** `app/utils/response_parser.py`
**Purpose:** Validate XML extraction, JSON parsing, Python-to-JSON keyword conversion, and repetition detection in LLM outputs.
**Mock strategy:** Pure functions. No mocking. Input: raw LLM output strings.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-RP-001 | Positive | `extract_xml` extracts content between XML tags | `"<plan>Flatten conditional</plan>"` | `"Flatten conditional"` |
| TC-RP-002 | Positive | `extract_xml` strips `<think>` blocks before extraction | `"<think>reasoning</think> <code>int x;</code>"` | `"int x;"` |
| TC-RP-003 | Positive | `extract_xml` validates Java plausibility (semicolons) | `"<code>int x = 1;</code>"` | `"int x = 1;"` |
| TC-RP-004 | Positive | `extract_xml` validates Java plausibility (braces) | `"<code>class A { }</code>"` | `"class A { }"` |
| TC-RP-005 | Negative | `extract_xml` rejects non-Java code tag content | `"<code>hello world</code>"` | `None` |
| TC-RP-006 | Edge | `extract_xml` missing tag returns None | `"<other>text</other>"` | `None` |
| TC-RP-007 | Positive | `extract_json` parses JSON to Pydantic model | `'{"refactor_category":"CONTROL_FLOW","specific_intent":"FLATTEN_CONDITIONAL","scope_anchor":{"class":"A","unit_type":"METHOD_UNIT"}}'` | Returns `IntentPacket` instance |
| TC-RP-008 | Positive | `extract_json` extracts from markdown code fence | `` "```json\n{\"a\":1}\n```" `` | `{"a": 1}` |
| TC-RP-009 | Positive | `extract_json` fixes trailing comma | `'{"a": 1, "b": 2,}'` | Parses to `{"a": 1, "b": 2}` |
| TC-RP-010 | Positive | `extract_json` fixes Python `None` → `null` | `'{"member": None}'` | `{"member": null}` |
| TC-RP-011 | Positive | `extract_json` fixes Python `True` → `true` | `'{"valid": True}'` | `{"valid": true}` |
| TC-RP-012 | Positive | `extract_json` fixes Python `False` → `false` | `'{"valid": False}'` | `{"valid": false}` |
| TC-RP-013 | Edge | Brace inside string value doesn't break depth counting | `'{"key": "just {opening", "other": true}'` | Parses correctly |
| TC-RP-014 | Edge | Trailing comma inside string value preserved | `'{"msg": "ends with,}", "list": [1, 2,],}'` | `"msg": "ends with,}", "list": [1, 2]` |
| TC-RP-015 | Edge | Python keywords inside string values not replaced | `'{"class": "set to None, True or False"}'` | String preserved verbatim |
| TC-RP-016 | Negative | Invalid JSON returns None | `"{not valid json"` | `None` |
| TC-RP-017 | Edge | Deeply nested JSON (5 levels) | `{"a":{"b":{"c":{"d":{"e":1}}}}}` | Parsed fully |
| TC-RP-018 | Positive | `detect_repetition` detects LLM output loop | Text with 3+ repeating trailing patterns | `True` |
| TC-RP-019 | Positive | `detect_repetition` no false positive on normal text | "Varied content with different phrases" | `False` |
| TC-RP-020 | Edge | `detect_repetition` handles empty string | `""` | `False` |

### 2.4 ASTMatcher

**Module:** `app/utils/ast_matcher.py`
**Purpose:** Validate class/method finding, brace-matched text extraction, and mutation enrichment for constants, fields, method modifications, and symbol renames.
**Mock strategy:** Pure functions. Java source code + AST mutations as input.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-AM-001 | Positive | `_find_class_declaration_line` finds class line | `"class A {` at line 5 | Returns 5 |
| TC-AM-002 | Positive | `_find_class_declaration_line` handles enum/interface | `"interface B {` at line 2 | Returns 2 |
| TC-AM-003 | Positive | `_find_method_body` finds method by name | Code with method `calculate()` | Returns AST node for `calculate` |
| TC-AM-004 | Edge | `_find_method_body` returns None for missing method | Method `missing()` not in code | Returns `None` |
| TC-AM-005 | Positive | `_extract_method_text` braces-matched extraction | Method with nested `if/else` blocks | Full method text |
| TC-AM-006 | Edge | `_extract_method_text` with deeply nested braces | Method with 5 levels of nested `{}` | Correct text boundary |
| TC-AM-007 | Positive | `_enrich_add_constant` sets `insert_after` to class decl | Mutation `ADD_CONSTANT`, target `MAX_SIZE` | `insert_after` = class declaration line |
| TC-AM-008 | Positive | `_enrich_add_field` sets `insert_after` | Mutation `ADD_FIELD`, target `name` | `insert_after` set correctly |
| TC-AM-009 | Positive | `_enrich_modify_method` creates `find`/`replace` | `MODIFY_METHOD` with sibling `ADD_CONSTANT` | `replace` contains constant references |
| TC-AM-010 | Positive | `_enrich_rename_symbol` creates find/replace from body_abstract | `RENAME_SYMBOL`, old=`oldName`, new=`newName` | All occurrences replaced |
| TC-AM-012 | Edge | `enrich_mutations` handles empty mutation array | `[]` | Returns empty list |

### 2.5 Validator

**Module:** `app/modules/validator/__init__.py`
**Purpose:** Validate Java syntax checking, complexity computation, intent-specific verification, boundary leak detection, and graceful verifier crash handling.
**Mock strategy:** No mocking. Real javalang and lizard libraries.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-VL-001 | Positive | `check_syntax` validates well-formed Java class | `"class A { void m() { int x = 1; } }"` | `is_valid=True`, `error=""` |
| TC-VL-002 | Positive | `check_syntax` wraps bare statements in class wrapper | `"int x = 1;"` (statement-level) | `is_valid=True` |
| TC-VL-003 | Positive | `check_syntax` wraps bare method in class wrapper | `"void m() { return; }"` (method-level) | `is_valid=True` |
| TC-VL-004 | Negative | `check_syntax` rejects malformed Java (unclosed brace) | `"class A { void m() { "` | `is_valid=False`, `error` non-empty |
| TC-VL-005 | Edge | `check_syntax` handles empty input | `""` | `is_valid=False` |
| TC-VL-006 | Edge | `check_syntax` handles whitespace-only input | `"   \n  "` | `is_valid=False` |
| TC-VL-007 | Positive | `get_complexity` correct CC for method with conditionals | `"class A { void m() { if(x) { } if(y) { } } }"` | CC = 3 |
| TC-VL-008 | Positive | `get_complexity` returns 1 for class with no methods | `"class A { int x; }"` | CC = 1 |
| TC-VL-009 | Positive | `get_method_complexity` finds specific method by name | Class with methods `setup()`, `calculate()`, `teardown` | Returns CC for `calculate` only |
| TC-VL-010 | Negative | `get_method_complexity` returns None for missing method | Method name `"missing"` not in class | `None` |
| TC-VL-011 | Positive | `has_structural_change` detects structural difference | Original vs refactored with different AST shape | `True` |
| TC-VL-012 | Positive | `has_structural_change` confirms identical structure | Code with formatting differences only (whitespace) | `False` |
| TC-VL-013 | Positive | `verify_intent` FLATTEN_CONDITIONAL detects nesting decrease | Nested `if(a){ if(b){ } }` → early return | Passes verification |
| TC-VL-015 | Negative | `verify_intent` FLATTEN_CONDITIONAL fails when unchanged | Original and refactored are identical | Failure finding |
| TC-VL-017 | Positive | `verify_boundary` confirms non-target methods unchanged | Target `calculate()` changed, `setup()` unchanged | No violation |
| TC-VL-018 | Negative | `verify_boundary` detects leak into non-target method | Target `calculate()` changed, `setup()` also changed | Boundary violation |
| TC-VL-019 | Positive | `verify_complexity` STRICT rule requires CC decrease | CC 5 → CC 3 | Pass |
| TC-VL-021 | Positive | `verify_complexity` LOOSENED rule allows CC to stay same | CC 5 → CC 5 | Pass |

### 2.6 AgentService

**Module:** `app/modules/agent/__init__.py`
**Purpose:** Validate LLM lifecycle: model loading/unloading with GPU layer offloading, grammar-constrained generation, token counting, and interrupt handling.
**Mock strategy:** Patch `llama_cpp.Llama` constructor. Mock `generate()` responses.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-AS-001 | Positive | `generate` returns structured response (dict) | Messages list, valid response model | Returns dict with expected keys |
| TC-AS-003 | Positive | `stop` triggers generation halt | Call `stop()` during `generate()` | `InterruptedError` raised |
| TC-AS-004 | Positive | `load` passes correct GPU layers to Llama | Config with `layers=36` | `Llama` called with `n_gpu_layers=36` |
| TC-AS-005 | Positive | `unload` releases VRAM (calls free + gc) | Model loaded, then `unload()` | `Llama.free()` called, `gc.collect()` called |
| TC-AS-006 | Positive | `swap` reloads only when config differs | Same config twice | Second load skipped |
| TC-AS-008 | Positive | `_count_tokens` extracts from usage data | Chunk with `usage.completion_tokens=42` | Returns 42 |
| TC-AS-009 | Edge | `_count_tokens` fallback when no usage data | Empty chunks, content length 100 | Returns 25 (`len//4`) |

### 2.7 ClientConnection

**Module:** `app/modules/connection/__init__.py`
**Purpose:** Validate WebSocket message sending (status, result, halt, insights), heartbeat ping/pong mechanics, stale connection detection, and notification suppression.
**Mock strategy:** Mock WebSocket and database. Full class instantiation.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CC-001 | Positive | `send_status` sends formatted status message via WebSocket | Role=Planner, content="Planning...", phase=2 | `send_json` called with correct message shape |
| TC-CC-002 | Positive | `send_result` includes model names in result | planner="Model-A", generator="Model-B", judge="Model-C" | `send_json` with all three model fields |
| TC-CC-003 | Positive | `send_halt_notification` sends halt message | No input | `send_json` called with `type: "status"`, content contains "halted" |
| TC-CC-005 | Positive | `handle_pong` resets missed pong counter | Counter at 1, call `handle_pong()` | `missed_pongs` = 0 |
| TC-CC-006 | Positive | `is_stale` true after 2+ missed pongs | Set `missed_pongs=2` | `is_stale` = `True` |
| TC-CC-007 | Edge | `is_stale` false when within threshold | Set `missed_pongs=1` | `is_stale` = `False` |
| TC-CC-008 | Negative | `send_status` skipped when client is stale | `is_stale=True`, call `send_status()` | `send_json` not called |

### 2.8 DatabaseManager

**Module:** `app/modules/context/__init__.py`
**Purpose:** Validate SQLite CRUD operations for session lifecycle, zombie cleanup, cascading deletes, and Tenacity retry logic on OperationalError.
**Mock strategy:** Real in-memory SQLite via Peewee. No mocks. Each test uses fresh DB.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-DB-001 | Positive | `create_session` inserts row with correct fields | session_id="s1", instruction="refactor", code="class A {}" | Row created, fields match |
| TC-DB-002 | Positive | `complete_session` updates status + code + metrics | session_id="s1", exit="SUCCESS", code="class B {}" | Row updated, `exit_status` = "SUCCESS" |
| TC-DB-003 | Positive | `log_status` creates OrchestrationLog entry | session_id="s1", role="Planner", content="planning" | Log created with backref to session |
| TC-DB-004 | Positive | `mark_as_halted` sets status to Halted | session_id="s1", call `mark_as_halted()` | `status` = "Halted" |
| TC-DB-005 | Positive | `get_history` returns stubs ordered by date desc | Insert 3 sessions at different times | Returns 3 stubs, newest first |
| TC-DB-006 | Positive | `get_history_by_id` returns full detail with nested logs | Create session + 2 log entries | Returns session + 2 logs |
| TC-DB-007 | Negative | `get_history_by_id` returns None for non-existent ID | ID "nonexistent" | `None` |
| TC-DB-008 | Positive | `rename_session` updates title | session_id="s1", new title="My Refactor" | `title` = "My Refactor" |
| TC-DB-011 | Positive | `delete_history_by_id` cascading delete | Session + 2 logs, call delete | Session gone, logs gone |

### 2.9 MessageRouter

**Module:** `app/modules/connection/router.py`
**Purpose:** Validate WebSocket message dispatching: pong heartbeat, session reconnect, single/multi refactor launch, halt propagation, and invalid payload rejection.
**Mock strategy:** Mock AgentService, ClientConnection, and task factory functions.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-MR-001 | Positive | `dispatch` routes `pong` to `client.handle_pong()` | `{"type": "pong"}` | `client.handle_pong()` called |
| TC-MR-002 | Positive | `dispatch` routes `reconnect` to reconnect handler | `{"type": "reconnect", "session_id": "s1"}` | Reconnect handler called with "s1" |
| TC-MR-003 | Positive | `dispatch` validates + launches single refactor | `{"type": "single", "code": "class A {}", "user_instruction": "refactor"}` | `run_single` task factory called |
| TC-MR-004 | Positive | `dispatch` validates + launches multi-agent refactor | `{"type": "multi", "code": "class A {}", "user_instruction": "refactor"}` | `run_multi` task factory called |
| TC-MR-005 | Positive | `dispatch` routes halt to agent stop + task cancel | `{"type": "halt"}` | `agent.stop()` called, active tasks cancelled |
| TC-MR-006 | Negative | `dispatch` rejects invalid refactor request | `{"type": "multi", "code": ""}` | Error response sent, no task launched |
| TC-MR-008 | Edge | `dispatch` ignores unknown message type | `{"type": "unknown"}` | No action, no error |

### 2.10 Orchestrator

**Module:** `app/modules/orchestrator/__init__.py`
**Purpose:** Validate orchestration state management (feedback ring buffer, strategy iteration), notification routing with model names, and main pipeline execution control flow (phase sequencing, retry, abort).
**Mock strategy:** Mock AgentService, ClientConnection, DatabaseManager. Test `OrchestrationState` methods directly.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-OR-001 | Positive | `OrchestrationState` initializes with valid defaults | `session_id="s1"`, `base_code="class A {}"`, `working_code="class A {}"`, `user_instruction="refactor"` | State has `strategy_iter=1`, empty `feedback`, `exit_status="PROCESSING"` |
| TC-OR-002 | Positive | `add_feedback` appends to ring buffer | State with 2 feedback entries, add a 3rd | `feedback` has 3 entries |
| TC-OR-004 | Positive | `extend_feedback` batch-adds with cap maintained | State with 2 entries, extend with 3 more | `feedback` has 3 entries (most recent retained) |

### 2.11 Phase 2 — Strategy

**Module:** `app/modules/orchestrator/phases/phase2_strategy.py`
**Purpose:** Validate intent classification, architecture analysis, synthesis with retry on invalid plans, ASTMatcher enrichment, mutation deduplication, and feedback translation.
**Mock strategy:** Mock AgentService.generate responses. Test `_classify`, `_analyze`, `_synthesize`, `_enrich`, `_deduplicate` in isolation.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P2-001 | Positive | `_classify` returns `IntentPacket` from LLM response | Mock `generate` returns `IntentClassifierResponse` with `FLATTEN_CONDITIONAL` | `state.intent_packet.specific_intent == FLATTEN_CONDITIONAL` |
| TC-P2-003 | Positive | `_analyze` stores `ArchitectAnalysisResponse` | Mock returns analysis with primary targets | `state.architect_analysis` populated |
| TC-P2-005 | Positive | `_synthesize` returns `ASTArchitectResponse` with mutations | Mock returns plan with 3 mutations | `state.active_plan` has 3 `ast_mutations` |
| TC-P2-009 | Positive | `_deduplicate` removes duplicate (action, target) pairs | 2 mutations with same `MODIFY_METHOD` on `calculate` | 1 remains, others removed |
| TC-P2-010 | Positive | `_deduplicate` preserves unique pairs | 3 mutations, different targets | All 3 remain |
| TC-P2-011 | Positive | `_translate_feedback` maps TIER_1 to syntax hint | `ValidationFinding` with `TIER_1_SYNTAX` | Feedback hint contains "syntax" instruction for LLM |

### 2.12 Phase 3 — Execution

**Module:** `app/modules/orchestrator/phases/phase3_execution.py`
**Purpose:** Validate generator output repair (throws, null-check, public stripping), multi-temperature best-CC selection, and sequential mutation with syntax healing and boundary break halting.
**Mock strategy:** Mock AgentService.generate. Test `repair_generator_output` as pure function.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-P3-001 | Positive | `repair_generator_output` strips `throws Exception` | Generated adds `throws Exception` on method | Original method signature restored |
| TC-P3-004 | Edge | `repair_generator_output` leaves valid code unchanged | Generated already matches original style | No changes made |
| TC-P3-005 | Positive | `run_single` generates code at 3 temperatures, picks best CC | Mock returns 3 outputs with CC 5, 3, 7 | Output with CC=3 selected |
| TC-P3-007 | Positive | `run_sequential` applies one mutation at a time | 2 mutations, both pass validation | `state.working_code` reflects both mutations applied sequentially |

### 2.13 Phase 4 — Validation

**Module:** `app/modules/orchestrator/phases/phase4_validation.py`
**Purpose:** Validate the full validation chain (syntax, complexity, boundary, intent) and correct routing to Phase 3 for healing or Phase 2 for replan based on failure tier.
**Mock strategy:** Validator used real (javalang, lizard). Mock state to simulate pass/fail.

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-P4-001 | Positive | `run` passes all validation checks (syntax, CC, boundary, intent) | State has valid working code, CC decreased, no boundary leak, intent matched | Returns route=ACCEPT, `validation_faults=0` |
| TC-P4-002 | Negative | `run` routes to Phase 3 when syntax check fails | Working code is invalid Java | Routes to Phase 3 (syntax healing) |

### 2.14 Phase 5 — Adjudication

**Module:** `app/modules/orchestrator/phases/phase5_adjudication.py`
**Purpose:** Validate judge verdict routing (ACCEPT to Phase 6, REVISE to Phase 2), hallucination overrides (identical code, logic drift), and structured issue extraction.
**Mock strategy:** Mock AgentService.generate. Test judge verdict routing.

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-P5-001 | Positive | `run` judge returns ACCEPT, proceeds to Phase 6 | Mock returns `{ "verdict": "ACCEPT" }` | Phase 6 called, pipeline continues |
| TC-P5-002 | Positive | `run` judge returns REVISE, returns to Phase 2 | Mock returns `{ "verdict": "REVISE" }` | Routes to Phase 2, `strategy_iter` increments |
| TC-P5-005 | Edge | `run` handles missing/empty judge response | Mock returns `None` | Assumes REVISE, logs error, returns to Phase 2 |

### 2.15 Phase 6 — Finalization

**Module:** `app/modules/orchestrator/phases/phase6_finalization.py`
**Purpose:** Validate outer wrapper stripping, result transmission with metrics, LLM-generated insights, database persistence, and graceful insight-generation failure handling.
**Mock strategy:** Mock AgentService.generate for insights. Mock DB for persistence.

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-P6-001 | Positive | `run` strips outer wrapper from generated code | Generated code wrapped in fabricated class, original had none | Wrapper removed, only method body retained |
| TC-P6-002 | Positive | `run` sends result with correct code and metrics | Valid state with working code and metrics | `client.send_result()` called with code, CC values, performance data |

### 2.16 Formatters

**Module:** `app/utils/formatters.py`
**Purpose:** Validate conversion of JSON mutation plans into human-readable linear text instructions for the generator, including constant references and logical ordering.
**Mock strategy:** Pure function. Input: JSON mutation plan + base code.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-FMT-001 | Positive | `format_plan_for_generator` converts single mutation to text | Plan with 1 `MODIFY_METHOD` on `calculate` | Linear text: "Modify method calculate\n  Action: MODIFY_METHOD\n  Details: ..." |
| TC-FMT-002 | Positive | `format_plan_for_generator` handles ADD_CONSTANT with value | `ADD_CONSTANT` with `MAX_SIZE=100` | Text includes "Add constant MAX_SIZE = 100" |
| TC-FMT-004 | Positive | `format_plan_for_generator` orders mutations logically | Mix of RENAME, ADD_CONSTANT, MODIFY_METHOD | Output lists RENAME first, then ADD, then MODIFY |
| TC-FMT-005 | Edge | `format_plan_for_generator` handles empty mutation array | `{"ast_mutations": []}` | Returns empty string or "No changes" |

### 2.17 Code Utils

**Module:** `app/utils/code_utils.py`
**Purpose:** Validate outer wrapper stripping logic and mutation ordering (rename-first, then add, then modify/remove, stable sort within groups).
**Mock strategy:** Pure functions. Input: Java code strings + mutation arrays.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-CU-001 | Positive | `strip_outer_wrapper` removes fabricated class wrapper | Generated code wrapped in `public class TempWrapper { ... }`, base_code is bare method | Only inner content returned |
| TC-CU-002 | Edge | `strip_outer_wrapper` preserves code when no wrapper needed | Generated code already matches expected structure | Unchanged (identity) |
| TC-CU-003 | Edge | `strip_outer_wrapper` handles class body only (no outer) | Base code is already a class | Returns input unchanged |
| TC-CU-004 | Positive | `order_mutations` places RENAME_SYMBOL first | Array: `[MODIFY_METHOD, RENAME_SYMBOL, ADD_FIELD]` | RENAME_SYMBOL first, then ADD_FIELD, then MODIFY_METHOD |
| TC-CU-005 | Positive | `order_mutations` places ADD_* before MODIFY/REMOVE | Array: `[REMOVE_METHOD, ADD_DECLARATION, MODIFY_METHOD]` | ADD_DECLARATION first, then MODIFY, then REMOVE |
| TC-CU-006 | Edge | `order_mutations` preserves relative order within same priority group | 2 MODIFY_METHOD mutations in arbitrary order | Same relative order maintained (stable sort) |

---

## Section 3: Backend Integration Tests

> **Status:** 8 of 12 documented cases implemented. WebSocket tests (IT-009 through IT-012) are aspirational — coverage is provided by unit tests (test_connection.py, test_router.py) and the full pipeline test.

**Module:** FastAPI application (`app/main.py`)
**Purpose:** Validate end-to-end REST API and WebSocket endpoint behavior including health check, history CRUD, and real-time message exchange (heartbeat, halt acknowledgment, error rejection).
**Approach:** FastAPI `TestClient` with real in-memory SQLite database. WebSocket tested via ASGI transport.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-IT-001 | Positive | `GET /health` returns 200 with timestamp | — | Status 200, body has `{"status": "ok", "timestamp": "..."}` |
| TC-IT-002 | Positive | `GET /api/history` returns history stub list | One session created | Status 200, body has array with 1 entry |
| TC-IT-004 | Negative | `GET /api/history/:id` returns 404 for nonexsitent | ID `"invalid"` | Status 404 |
| TC-IT-008 | Negative | `DELETE /api/history/:id` returns 404 for missing | ID `"invalid"` | Status 404 |

---

## Section 4: Frontend Unit Tests

> **Status:** 75 of 99 documented cases implemented. See Execution Matrix for per-module breakdown. Unimplemented cases are retained as a specification for future work.

### 4.1 lib/utils — cn()

**Module:** `src/lib/utils.ts`
**Purpose:** Validate Tailwind CSS class merging, falsy filtering, conditional object syntax, and tailwind-merge conflict resolution.
**Mock strategy:** Pure function. No mocking.

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
**Purpose:** Validate constant shape, role visuals completeness, and default fallback structure.
**Mock strategy:** Read-only constant values. No mocking.

| ID | Type | Scenario | Expected |
|----|------|----------|----------|
| TC-CNST-001 | Positive | `INITIAL_SOURCE` is empty string | `""` |
| TC-CNST-002 | Positive | `EMPTY_ORCHESTRATION_RESULT` has expected shape | Contains `metrics: []`, `summary: ""`, `diffHighlights: { added: [], removed: [] }` |
| TC-CNST-003 | Positive | `ROLE_VISUALS` has entries for all 6 roles | Object has keys for Planner, Generator, Validator, Judge, System, Monolith |
| TC-CNST-004 | Positive | Each `ROLE_VISUALS` entry has `step`, `icon`, `colorClass` | All 18 fields present and typed correctly |
| TC-CNST-005 | Positive | `DEFAULT_ROLE_VISUALS` has fallback values | `{ step: 1, icon: "Cpu", colorClass: "text-jb-accent" }` |

### 4.3 lib/parseStatusInfo

**Module:** `src/lib/parseStatusInfo.ts`
**Purpose:** Validate text parsing for phase numbers, strategy iterations, retry info, validation faults, judge decisions, intent details, and mutation plans with JSON/markdown fallbacks.
**Mock strategy:** Pure functions. Input: raw status string content.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-PS-001 | Positive | `parsePhaseNumber` detects "Ph1" pattern | `"Ph1: Analyzing baseline..."` | `1` |
| TC-PS-002 | Positive | `parsePhaseNumber` detects "Baseline" keyword | `"Starting Baseline phase"` | `1` |
| TC-PS-003 | Positive | `parsePhaseNumber` detects "Strategy" keyword | `"Strategy phase analyzing..."` | `2` |
| TC-PS-004 | Positive | `parseStrategyIteration` extracts iteration number | `"Strategy Iter 2"` | `2` |
| TC-PS-005 | Positive | `parseRetryInfo` detects syntax heal attempts | `"Syntax heal attempt 2/3"` | `{ current: 2, max: 3, type: "syntax_heal" }` |
| TC-PS-006 | Positive | `parseRetryInfo` detects sequential mutation retry | `"Retry mutation 1/5"` | `{ current: 1, max: 5, type: "sequential" }` |
| TC-PS-007 | Positive | `parseValidationFaults` extracts fault count | `"Total Faults: 3"` | `3` |
| TC-PS-008 | Positive | `parseJudgeDecision` detects ACCEPT verdict | `"Decision: ACCEPT"` | `"ACCEPT"` |
| TC-PS-009 | Positive | `parseJudgeDecision` detects REVISE verdict | `"Verdict: REVISE"` | `"REVISE"` |
| TC-PS-014 | Positive | `parsePhaseAction` extracts action description | `"Ph2: Analyzing code structure"` | `"Analyzing code structure"` |

### 4.4 lib/formatStatusContent

**Module:** `src/lib/formatStatusContent.ts`
**Purpose:** Validate extraction of JSON blocks, key-value tags, markdown formatting, first-line summary derivation, and recursive flattening of nested objects.
**Mock strategy:** Pure functions. Input: raw status strings.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-FS-001 | Positive | Extracts JSON blocks into structured format | Content with \`\`\`json ... \`\`\` block | `summary` contains extracted values, `tags` populated |
| TC-FS-005 | Positive | Returns summary from first line | `"Starting analysis.\nMore details here"` | `summary: "Starting analysis."` |
| TC-FS-007 | Edge | Handles empty input | `""` | `summary: ""`, empty tags |
| TC-FS-008 | Edge | Handles input with no recognizable patterns | `"plain text"` | `summary: "plain text"`, empty tags |

### 4.5 lib/javaFormatter

**Module:** `src/lib/utils/javaFormatter.ts`
**Purpose:** Validate Java code formatting: operator spacing normalization, brace merging for else/catch/finally, string/comment/generic preservation, placeholder extraction and restoration.
**Mock strategy:** Pure function. Input: raw Java code strings.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-JF-001 | Positive | Formats basic class with braces and indentation | `"class A { void m() { } }"` | Correctly indented multi-line output |
| TC-JF-002 | Positive | Preserves string literals during formatting | Code with `"select * from table"` | String unchanged |
| TC-JF-003 | Positive | Preserves comments during formatting | Code with `// comment` and `/* block */` | Comments preserved |
| TC-JF-004 | Positive | Handles generic type parameters | `List<Map<String, Integer>>` | Generics formatted correctly |
| TC-JF-005 | Positive | Normalizes spaces around operators | `a=b+c` | `a = b + c` |
| TC-JF-006 | Positive | Merges `else`/`catch`/`finally` to previous closing brace | `}\nelse {` | `} else {` |
| TC-JF-007 | Edge | Strips consecutive blank lines | 3 blank lines in a row | 1 blank line |
| TC-JF-008 | Edge | Restores placeholders after formatting | Contains extracted strings/comments | Original values reappear |
| TC-JF-009 | Edge | Handles empty string | `""` | `""` |

### 4.6 lib/indentation

**Module:** `src/lib/indentation.ts`
**Purpose:** Validate smart Enter (auto-indent after line, auto-close brace without duplication), Tab/Shift-Tab indent/outdent, and closing brace alignment to matching opening brace.
**Mock strategy:** Pure functions. Input: code string + cursor position.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-IN-001 | Positive | `handleEnterKey` adds indent after line | Line `  if (x) {` at end | New line with `    ` indent |
| TC-IN-002 | Positive | `handleEnterKey` auto-closes brace after `{` | Line `main() {` at end | Inserts `\n    \n}` with cursor at middle |
| TC-IN-003 | Edge | `handleEnterKey` no double close brace | Line already has `}` closing brace | Only indents, no extra `}` |
| TC-IN-004 | Positive | `handleTabKey` indents current line by 4 spaces | Line `foo();` with cursor at start | Line becomes `    foo();` |
| TC-IN-005 | Positive | `handleTabKey` indents selected block | 3 lines selected | All 3 lines indented 4 spaces |
| TC-IN-006 | Positive | `handleShiftTab` outdents line | Line `    foo();` | `foo();` |
| TC-IN-007 | Positive | `handleClosingBrace` adjusts indent to match opening brace | `  if(x) {\n    }` (cursor after `}`) | `  if(x) {\n  }` (brace at same level as `if`) |
| TC-IN-008 | Edge | `handleClosingBrace` returns null when no adjustment needed | `}` already correctly aligned | `null` |

### 4.7 lib/buildMetrics

**Module:** `src/lib/utils/buildMetrics.ts`
**Purpose:** Validate construction of cyclomatic complexity metrics (direction up/down/neutral), inference time, and GPU utilization/memory metrics from raw performance payloads.
**Mock strategy:** Pure function. Input: complexity numbers + performance metrics.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-BM-001 | Positive | Builds complexity metric when complexity decreased | orig=10, refactored=5 | Metric with `direction: "down"`, before="10", after="5" |
| TC-BM-002 | Positive | Builds complexity metric when complexity increased | orig=5, refactored=10 | Metric with `direction: "up"` |
| TC-BM-003 | Positive | Builds complexity metric when unchanged | orig=5, refactored=5 | Metric with `direction: "neutral"` |
| TC-BM-004 | Positive | Builds inference time metric | performance has `inference_time: 12.5` | Metric with `after: "12.5s"` |
| TC-BM-005 | Positive | Builds GPU metrics when performance provided | performance with `avg_gpu_utilization`, `peak_gpu_memory_used` | GPU metrics present |
| TC-BM-006 | Edge | Skips GPU metrics when performance is null/undefined | performance = `null` or `undefined` | Only complexity metric returned |

### 4.8 lib/schemas/websocket (Zod)

**Module:** `src/lib/schemas/websocket.ts`
**Purpose:** Validate Zod schema validation for all WebSocket message types and discriminated union routing for type-safe message handling.
**Mock strategy:** Pure Zod schema validation. No mocking.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-ZD-001 | Positive | `StatusMessageSchema` validates correct status | `{ type: "status", role: "Planner", content: "Analyzing..." }` | Passes parse |
| TC-ZD-002 | Negative | `StatusMessageSchema` rejects missing role | `{ type: "status", content: "..." }` | Fails parse |
| TC-ZD-003 | Negative | `StatusMessageSchema` rejects invalid type | `{ type: "invalid", role: "Planner", content: "..." }` | Fails parse |
| TC-ZD-004 | Positive | `ResultMessageSchema` validates correct result | `{ type: "result", code: "class A {}", exit_status: "SUCCESS" }` | Passes parse |
| TC-ZD-005 | Negative | `ResultMessageSchema` rejects invalid exit_status | `{ type: "result", code: "...", exit_status: "INVALID" }` | Fails parse |
| TC-ZD-006 | Positive | `ErrorMessageSchema` validates correct error | `{ type: "error", message: "Something went wrong" }` | Passes parse |
| TC-ZD-007 | Positive | `ServerMessageSchema` discriminates by type | Status message, result message, error message | Each matches correct schema in union |
| TC-ZD-008 | Negative | `ServerMessageSchema` rejects unknown type | `{ type: "unknown" }` | Fails parse |

### 4.9 store/useChatStore

**Module:** `src/store/useChatStore.ts`
**Purpose:** Validate Zustand store operations: session CRUD, API integration (fetch, rename with optimistic update, delete with rollback), session ID migration, and draft management.
**Mock strategy:** Real Zustand store. Mock `global.fetch` for API calls.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-ST-001 | Positive | `createSession` creates session with defaults | `createSession("test-1")` | Session with `title: "New Session"`, empty `sourceCode`, empty `terminalEntries` |
| TC-ST-003 | Positive | `updateSession` partial update merges correctly | Create session, `updateSession("test-1", { title: "New Title" })` | Title changed, other fields unchanged |
| TC-ST-004 | Positive | `updateSession` updater function accumulates state | Call `updateSession` with 2 updater calls that push to `terminalEntries` | `terminalEntries` has 2 entries |
| TC-ST-005 | Positive | `deleteSession` calls DELETE API + removes from sessions | Session exists, `fetch` mock returns 200 | Session removed, `fetch` called with DELETE |
| TC-ST-007 | Positive | `renameSession` optimistic update on PATCH success | Mock PATCH returns 200 | Title updated in store |
| TC-ST-009 | Positive | `migrateSessionId` moves data to new key | Session "old-id" → `migrateSessionId("old-id", "new-id")` | "old-id" removed, "new-id" has same data |
| TC-ST-010 | Positive | `fetchHistory` populates sessions from API | Mock GET returns 2 stubs | Store has 2 sessions with correct titles |
| TC-ST-013 | Positive | `resetDraftSession` clears all draft fields | Draft has values, call `resetDraftSession()` | Draft back to initial defaults |
| TC-ST-014 | Positive | `setOrchestratorStatus` updates status | `setOrchestratorStatus("connected")` | `orchestratorStatus` = "connected" |

### 4.10 hooks/useOrchestrationSocket

**Module:** `src/hooks/useOrchestrationSocket.tsx`
**Purpose:** Validate WebSocket lifecycle (connect/disconnect), message routing (status, result, insights, error, halt, connection_id), glassbox state updates, and request deduplication.
**Mock strategy:** Mock WebSocket constructor. Mock `useChatStore` actions.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-WS-001 | Positive | `connect` opens WebSocket to correct URL | `connect("session-1")` | `WebSocket` constructed with WS_URL |
| TC-WS-002 | Positive | `disconnect` closes socket (no auto-reconnect) | Call `disconnect()` | `close()` called, `reconnect` flag = false |

### 4.11 components/ErrorBoundary

**Module:** `src/components/layout/ErrorBoundary.tsx`
**Purpose:** Validate React error boundary rendering, error catching from crashing children, custom fallback display, and error state reset on children replacement.
**Mock strategy:** Spy on `console.error` (React logs caught errors). Test with crashing child.

| ID | Type | Scenario | Input | Expected |
|----|------|----------|-------|----------|
| TC-EB-001 | Positive | Renders children when no error | `<ErrorBoundary><div>ok</div></ErrorBoundary>` | Shows "ok" |
| TC-EB-002 | Positive | Catches error from crashing child and shows fallback | Child throws `new Error("crash")` | Shows fallback UI (not blank page) |
| TC-EB-003 | Positive | Shows custom fallback when provided | `fallback={<CustomFallback />}` + crashing child | Shows `<CustomFallback />` |
| TC-EB-004 | Edge | Resets error state when children are replaced | Catch error, then re-mount with non-crashing child | Shows new children, error cleared |

---

## Section 5: Frontend Integration Tests

**Approach:** React Testing Library with real store (Zustand) + mocked WebSocket boundary.

### 5.1 Terminal

**Module:** `src/components/features/terminal/Terminal.tsx`
**Purpose:** Validate rendering of all terminal entry types (command, log, system, error, divider), auto-scroll behavior on new entries, and collapsible panel toggle.
**Mock strategy:** Real store (Zustand) with pre-populated terminal entries. Mock WebSocket boundary.

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-FI-001 | Positive | Renders all terminal entry types | Store has entries: command, log, system, error, divider | Each rendered with correct styling and badges |
| TC-FI-002 | Positive | Auto-scrolls to bottom on new entry | Render with entries, add new entry | Scroll container shows latest entry |
| TC-FI-003 | Positive | Collapsible header toggles panel visibility | Click chevron on header | Panel content hides/shows |

### 5.2 ChatWorkspace

**Module:** `src/components/features/workspace/ChatWorkspace.tsx`
**Purpose:** Validate panel layout rendering (input, output, terminal), session not-found error banner display, and end-to-end analysis flow via WebSocket request.
**Mock strategy:** Real store (Zustand) with session data. Mock WebSocket via `useOrchestrationSocket`.

| ID | Type | Scenario | Input / Arrange | Expected |
|----|------|----------|-----------------|----------|
| TC-FI-004 | Positive | Renders all 3 panel areas (input, output, terminal) | Render with valid sessionId | InputPanel, RefactoredOutput, Terminal all in DOM |

---

## Section 6: Test Execution Matrix

| Module | Test File | Planned | ✅ Actual | Priority | Dependencies |
|--------|-----------|---------|----------|----------|-------------|
| Module | Test File | Planned | ✅ Actual | Priority | Dependencies |
|--------|-----------|---------|----------|----------|-------------|
| **BACKEND UNIT** | | **170** | **170** | | |
| OrchestrationConfig | `test_config.py` | 5 | 5 | High | YAML file |
| Types & Schemas | `test_types_schemas.py` | 8 | 8 | High | None |
| ResponseParser | `test_response_parser.py` | 20 | 20 | High | None |
| ASTMatcher | `test_ast_matcher.py` | 12 | 11 | High | Java source |
| Validator | `test_validator.py` | 22 | 20 | Critical | javalang, lizard |
| AgentService | `test_agent_service.py` | 10 | 9 | High | llama_cpp (mocked) |
| ClientConnection | `test_connection.py` | 8 | 8 | High | WebSocket (mocked) |
| DatabaseManager | `test_context.py` | 12 | 12 | Critical | In-memory SQLite |
| MessageRouter | `test_router.py` | 8 | 8 | Medium | Agent + Connection |
| Orchestrator | `test_orchestrator.py` | 12 | 12 | Critical | Agent, DB, Connection (mocked) |
| Phase 2 — Strategy | `test_phase2_strategy.py` | 12 | 12 | Critical | AgentService (mocked) |
| Phase 3 — Execution | `test_phase3_execution.py` | 10 | 10 | Critical | AgentService (mocked) |
| Phase 4 — Validation | `test_phase4_validation.py` | 8 | 8 | Critical | Validator (real) |
| Phase 5 — Adjudication | `test_phase5_adjudication.py` | 6 | 6 | Critical | AgentService (mocked) |
| Phase 6 — Finalization | `test_phase6_finalization.py` | 6 | 6 | Critical | AgentService, DB (mocked) |
| Formatters | `test_formatters.py` | 5 | 5 | High | None (pure) |
| Code Utils | `test_code_utils.py` | 6 | 6 | Medium | None (pure) |
| **BACKEND INTEGRATION** | | **12** | **12** | | |
| REST + WS API | `test_api.py` | 12 | 12 | Critical | Mocked ConnectionManager + DB |
| Full Pipeline | `test_full_mock_pipeline.py` | — | 4 | Critical | Real Validator, in-memory DB, mocked AgentService |
| **FRONTEND UNIT** | | **99** | **89** | | |
| lib/utils (cn) | `utils.test.ts` | 6 | 6 | Low | None (pure) |
| lib/constants | `constants.test.ts` | 5 | 5 | Low | None (read-only) |
| lib/parseStatusInfo | `parseStatusInfo.test.ts` | 14 | 10 | High | None (pure) |
| lib/formatStatusContent | `formatStatusContent.test.ts` | 8 | 7 | High | None (pure) |
| lib/javaFormatter | `javaFormatter.test.ts` | 10 | 9 | Medium | None (pure) |
| lib/indentation | `indentation.test.ts` | 8 | 8 | Medium | None (pure) |
| lib/buildMetrics | `buildMetrics.test.ts` | 6 | 6 | Medium | None (pure) |
| lib/schemas (Zod) | `websocket.test.ts` | 8 | 8 | Medium | None (pure) |
| store/useChatStore | `useChatStore.test.ts` | 14 | 14 | Critical | fetch (mocked) |
| hooks/useOrchestrationSocket | `useOrchestrationSocket.test.tsx` | 10 | 3 | Critical | WebSocket, store |
| ErrorBoundary | `ErrorBoundary.test.tsx` | 4 | 4 | Medium | React rendering |
| **FRONTEND INTEGRATION** | | **6** | **4** | | |
| Terminal | `Terminal.test.tsx` | 3 | 3 | High | Store + RTL |
| ChatWorkspace | `ChatWorkspace.test.tsx` | 3 | 2 | High | Store + Hook + RTL |
| | | **287 planned** | **281 done** | | |

---

### Legend

| Type | Meaning |
|------|---------|
| Positive | Valid input, correct output |
| Negative | Invalid input, expected failure |
| Edge | Boundary conditions, empty/null, extreme values |
| Critical | Core pipeline logic — must pass for system correctness |
| High | Important module — should pass before merge |
| Medium | Utility module — good to have passing |
| Low | Trivial module — informational pass/fail |

---

_Document version 1.0 — Last updated June 24, 2026_
