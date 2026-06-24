# HORIZON BACKEND — COMPLETE SPECIFICATION

## 1. OVERVIEW

Horizon is an **AI-driven Java code refactoring engine** using a multi-agent Small Language Model (SLM) architecture. Target: consumer GPU (4GB VRAM). Two operation modes:

- **Multi-Agent (pipeline)**: 6-phase orchestration using 3 separate 3B-parameter models (Planner, Generator, Judge)
- **Single Mode**: One-shot refactoring using a single 7B-parameter model

**Stack**: Python 3.10+, FastAPI, WebSocket, SQLite (Peewee ORM), llama-cpp-python (GGUF), javalang, lizard

**Models** (Q4_K_M, GGUF):
| Role | Model | File | Layers | Context |
|------|-------|------|--------|---------|
| Planner | Qwen2.5-Coder-3B | `qwen_coder.gguf` | 36/36 | 6144 |
| Generator | Qwen2.5-Coder-3B | `qwen_coder.gguf` | 36/36 | 6144 |
| Judge | Llama-3.2-3B | `llama_engine.gguf` | 28/28 | 6144 |
| Single | Qwen2.5-Coder-7B | `Qwen2.5-Coder-7B-Instruct-Q4_K_M.gguf` | 20/?? | 4096 |

**Supported Refactoring Intents (12)**:
- CONTROL_FLOW: FLATTEN_CONDITIONAL, DECOMPOSE_CONDITIONAL, CONSOLIDATE_CONDITIONAL, REMOVE_CONTROL_FLAG, REPLACE_LOOP_WITH_PIPELINE, SPLIT_LOOP
- METHOD_MOVEMENT: EXTRACT_METHOD, INLINE_METHOD
- STATE_MANAGEMENT: EXTRACT_VARIABLE, INLINE_VARIABLE, EXTRACT_CONSTANT, RENAME_SYMBOL

---

## 2. ENTRY POINT — `app/main.py` (344 lines)

Module-level singletons for all services. Single `asyncio.Lock` serializes all orchestration.

**Lifespan** (startup/shutdown):
- Connect SQLite, clean zombie sessions (>1hr stuck in "Processing"), delete old halted sessions (>5hr)
- Start `SystemMonitor` (GPU/CPU polling)
- Shutdown: stop monitor, close DB, unload model VRAM

**HTTP Endpoints:**
| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | DB connectivity check |
| `/api/history` | GET | List all session stubs |
| `/api/history/{id}` | GET | Full history detail with logs |
| `/api/history/{id}` | DELETE | Cascade-delete session |
| `/api/history/{id}` | PATCH | Rename session title |

**WebSocket Endpoints:**
| Route | Purpose |
|-------|---------|
| `/ws` | Main: bidirectional refactoring comms |
| `/ws/system` | Read-only: GPU/CPU metrics stream (2s interval) |

**`/ws` Logic:**
1. Accept WS, create `ClientConnection`, start heartbeat (15s ping, 2 missed max)
2. Loop: receive JSON, dispatch via `MessageRouter`
3. Router handles: `pong`, `reconnect`, `single`, `multi`, `halt`
4. On `multi`/`single`: validates input, creates `asyncio.Task`, auto-cleanup via `task.add_done_callback()`
5. Orchestration runs inside `orchestration_lock` with 10min timeout
6. On `halt`: calls `agent_service.stop()` (sets event flag) + cancels all active tasks
7. On disconnect: stop generation, cancel all tasks
8. **Reconnection**: client sends `session_id`, server finds DB record. Completed → sends result + insights. Processing → swaps `orchestrator.current_client` to reattach.

**CORS**: localhost:3000 only. Error tracking: Sentry SDK (env-var DSN). HTTP middleware logs method/path/status/duration.

---

## 3. AGENT MODULE — `app/modules/agent/__init__.py` (267 lines)

**`AgentService`** — SLM lifecycle + inference. Single `asyncio.Lock` serializes all model access.

**Lifecycle:**
| Method | Behavior |
|--------|----------|
| `load(config)` | Creates `Llama` instance with `flash_attn=True`, 120s timeout. Skips if same model already loaded |
| `unload()` | `model.close()` + `del model` + `gc.collect()` + 0.5s async sleep for CUDA unmapping |
| `swap(config)` | Unloads only if filename differs, then loads new model |
| `clear_context()` | Calls `model.reset()` to purge KV cache without unloading weights |

**`generate()`** — core inference:
- Always streams internally (even for non-stream calls) to allow mid-generation halt
- When `response_model` provided: passes `response_format` with JSON schema → GBNF grammar for guaranteed structured output
- Repetition detection: optional callback runs every 10 chunks on accumulated text; if returns True, breaks generation
- `_stop_event` (`asyncio.Event`): set by `stop()`, checked between chunks → raises `InterruptedError` (custom exception, not `CancelledError`)
- Token estimation: uses usage data from response chunks OR fallback `len(content) // 4`

---

## 4. CONNECTION MODULE — `app/modules/connection/`

### `__init__.py` — ClientConnection + ConnectionManager (163 lines)

**`ClientConnection`** — Per-WebSocket session. Heartbeat every 15s, max 2 missed pongs before stale. Methods: `send_status(role, content, phase, models)`, `send_result(final_code, complexity, metrics, exit_status, models)`, `send_insights(insights)`, `send_halt_notification()`, `reset_id()` (new UUID per request).

**`ConnectionManager`** — Gateway between HTTP API and DB. Delegates CRUD to `DatabaseManager`. Factory: `create_websocket_connection(ws)`.

### `router.py` — MessageRouter (86 lines)

Dispatch by `type` field:
- `pong` → `client.handle_pong()`
- `reconnect` → `reconnect_handler(session_id, ws)`
- `single` → validates code>=10, instruction>=3 → creates task
- `multi` → validates via `RefactorRequest` Pydantic (code 10-100K, instr 3-10K) → creates task
- `halt` → `agent_service.stop()` + cancel all tasks

Busy check: if any active task is not done, sends `SYSTEM_BUSY` error.

---

## 5. CONTEXT MODULE — `app/modules/context/__init__.py` (227 lines)

SQLite via Peewee ORM, WAL journal mode, foreign keys enabled. Tenacity retry (3 attempts, 0.5s wait) on `OperationalError`.

### Schema

**`RefactorHistory`** — Primary table:
| Field | Type | Notes |
|-------|------|-------|
| id | UUIDField PK | |
| status | CharField | Processing/Completed/Halted/Zombie |
| exit_status | CharField nullable | SUCCESS/ABORT_STRATEGY/ABORTED/ABORT_SYSTEM |
| title | CharField(255) | First 255 chars of instruction |
| user_instruction | TextField | |
| original_code | TextField | |
| refactored_code | TextField nullable | |
| insights | TextField nullable | JSON string |
| final_intent/plan | TextField nullable | JSON |
| total_outer/inner_loops | IntegerField | |
| original/refactored_complexity | IntegerField nullable | |
| mode | CharField | "multi"/"single" |
| planner/generator/judge_model | CharField nullable | |
| avg/peak_gpu_* | FloatField nullable | 5 metric columns |
| inference_time | FloatField nullable | |
| created_at | DateTimeField | auto |

**`OrchestrationLog`** — Step-by-step logs (FK to RefactorHistory, CASCADE delete):
role, status, content (JSON), phase, outer_loop, inner_loop, created_at.

### DatabaseManager Methods

| Method | Key Logic |
|--------|-----------|
| `create_session` | INSERT with status=Processing, title=instruction[:255] |
| `log_status` | INSERT OrchestrationLog with phase/loop metadata |
| `mark_as_halted` | UPDATE status=Halted, exit_status=ABORTED |
| `complete_session` | UPDATE all final fields, status=Completed |
| `get_history` | SELECT all ORDER BY created_at DESC |
| `get_history_by_id` | SELECT with backref logs |
| `cleanup_zombie_sessions` | UPDATE status=Zombie where Processing > 1hr old |
| `cleanup_halted_sessions` | DELETE Halted > 5hr old |
| `delete_history_by_id` | DELETE by PK |
| `rename_session` | UPDATE title |

---

## 6. ORCHESTRATOR — `app/modules/orchestrator/`

### `config.py` (69 lines)

Frozen dataclasses loaded from `model_config.yaml`:
- **`ModelEntry`**: name, temperature, max_tokens, context_size, layers, filename. Dict-like access (`__getitem__`, `keys()`).
- **`OrchestrationSettings`**: All caps (classifier_max_tokens=500, analysis_max_tokens=1024, judge_max_tokens=1536, dedup_cap=8, feedback_cap=3, strategy_loop_cap=3, syntax_retry_cap=3, mutation_cap=20, truncation_size=10, repeat_penalty=1.2).
- **`OrchestrationConfig`**: planner, generator, judge, single + orchestration settings. `from_yaml()` validates required keys.

### `__init__.py` — Orchestrator + OrchestrationState (313 lines)

**`OrchestrationState`** (Pydantic) — all pipeline state:
session_id, base_code, working_code, user_instruction, intent_packet, active_plan, strategy_iter (1-based, max 3), strategy_iter_incremented (prevents double-increment), syntax_iter, cumulative_feedback (ring buffer cap=3), syntax_error_context, structural_fix_attempts, mutation_queue, mutation_index, sequential_attempts, gen_timings, architect_analysis, current_phase, exit_status, original_complexity. Helpers: `add_feedback()`, `extend_feedback()`.

**`Orchestrator`** — Main pipeline:

`execute_orchestration(client, code, instruction)`:
1. Create `PerformanceTracker`, start
2. Create state, persist session to DB
3. Phase 1: compute baseline CC (lizard), notify models used
4. Main loop (while PROCESSING):
   - Phase 2 → Phase 3 (sequential if first iter + multi-mutation + no syntax error) → Phase 4 → Phase 5 → Phase 6
   - Circuit breaker: strategy_iter > 3 → ABORT_STRATEGY → Phase 6
5. Stop tracker, get metrics, run Phase 6

**Sequential vs Single-shot**: Sequential used when first strategy iteration, no syntax error, plan has >1 mutation. If sequential exhausts mid-way, reset working_code to base_code, fall through to single-shot.

**Phase transitions** (simplified):
- Phase 2 → 3 (always)
- Phase 3 sequential → 4 (all mutations applied) or falls through to single-shot
- Phase 3 single-shot → 4 (best sample found) or → 2 (all failed)
- Phase 4 → 3 (heal syntax/structural) or → 2 (unrecoverable) or → 5 (all pass)
- Phase 5 → 6 (ACCEPT) or → 2 (REVISE)
- Phase 6 → break

**`_notify()`**: Prints terminal, persists DB, sends WS. Uses `self.current_client` (swap-able for reconnect). Skips if stale.

**Error handling**: CancelledError/InterruptedError → mark halted. Generic → print + send to client (truncated 200 chars). Finally: unload model.

**`SKIP_JUDGE`**: When True, Phase 5 auto-transitions to Phase 6.

---

## 7. PHASE MODULES

### Phase 2: Strategy — `phase2_strategy.py` (266 lines)

Pipeline: Classify → Analyze → Synthesize → Enrich → Deduplicate

**`_classify()`**: System prompt `planner.classifier` (12 intent definitions). User: `<code>...</code>\n<instruction>...</instruction>`. Response model `IntentClassifierResponse` (GBNF). Temp=0.1. Intent stored in state.

**`_analyze()`**: System `planner.architect_analysis` + per-intent `analysis_guidance`. Response model `ArchitectAnalysisResponse` (primary_targets, secondary_targets, new_structures_needed, must_preserve). Temp=0.1. On parse failure → soft fail (empty dict).

**`_synthesize()`**: System `planner.architect` + per-intent `synthesis_guidance`. Response model `ASTArchitectResponse` (max 5 mutations). 2 retries (temp=0.2 → 0.5). Mutation cap: truncates to 10 if >20. On both fail → TIER_1_SYNTAX feedback, strategy retry.

**`_enrich()`**: Calls `ASTMatcher.enrich_mutations()` for find_text/replace_text/insert_after.

**`_deduplicate()`**: Dedup by (action, target). Caps at 8.

**`_translate_feedback()`**: Converts FailureTier to human-readable suggestions. INTENT_MATH → specific approach per intent. COMPLEXITY → reduce helpers. BOUNDARY → restrict scope. SYNTAX → check braces.

Context cleared between each sub-phase.

---

### Phase 3: Execution — `phase3_execution.py` (338 lines)

#### `run_single()` — Multi-sample generation:
- System `generator.coder` + per-intent `coder_guidance`
- 2-3 temperature samples: `(retry_temp, 0.3, 0.5)` or `(retry_temp,)` for healing
- `retry_temp`: 0.3 if healing or strategy_iter>1, else 0.1
- Each sample: extract `<code>`, run `repair_generator_output()`, check syntax, compute CC
- Scoring: syntax-fail = (-1000, 0), syntax-OK = (0, -cc_delta)
- Best selected. Success → Phase 4. All fail → syntax_iter++ (max 3), then → Phase 2

#### `run_sequential()` — One mutation at a time:
- Mutations ordered: RENAME → ADD_* → MODIFY/REMOVE
- Each step: prompt with current code + target mutation + previously added context items
- After each step: extract `<code>`, syntax check, boundary check
- 3 retries per step. On exhaustion → reset to base_code, return (falls to single-shot)

#### `repair_generator_output()` (standalone):
Strips defensive additions: extra `throws XxxException`, null checks, extra `public` modifiers.

---

### Phase 4: Validation — `phase4_validation.py` (182 lines)

Sequential checks:

1. **Syntax Check**: `validator.check_syntax()`. Fail + attempt≤3 → Phase 3 heal. Fail + attempt>3 → TIER_1_SYNTAX → Phase 2.
2. **Complexity Check**: Per-intent CC rules (STRICT/LOOSENED/EXTRACT_RULE/SKIP).
3. **Boundary Check**: Structural signatures of non-target methods must match.
4. **Intent-Math Check**: Intent-specific structural verifier (nesting depth, loop count, etc.).

**Recovery**: structural_fix_attempts < 1 → Phase 3 targeted fix. Else → Phase 2 strategy retry with cumulative feedback.

**Edge case**: plan exists but code unchanged → force strategy retry.

---

### Phase 5: Adjudication — `phase5_adjudication.py` (134 lines)

1. Normalize both codes: strip imports, strip outer wrapper
2. Audit prompt: plan context (intent, target, mutations) + original/refactored code
3. System: `judge.auditor` + optional per-intent `auditor_guidance`
4. 2 retries: temp=0.1 max_tokens=1500 → temp=0.3 max_tokens=2048
5. Response model: `StructuralAuditorResponse` (verdict: ACCEPT/REVISE)

**Anti-hallucination**: "IDENTICAL_CODE" overridden to ACCEPT if structural change detected. "LOGIC_DRIFT" overridden to ACCEPT if no structural change.

**Decision**: ACCEPT → SUCCESS → Phase 6. REVISE → TIER_3_JUDGE → Phase 2.

---

### Phase 6: Finalization — `phase6_finalization.py` (107 lines)

1. Strip outer wrapper from working code
2. If NOT SUCCESS: revert to base_code
3. Send result to frontend
4. Generate insights (judge model, `RefactorInsightsResponse`). On failure: fallback message.
5. Send insights to frontend
6. Persist to DB: code, complexity, metrics, intent, plan, loop counts, models, insights

---

### Single Refactor — `single_refactor.py` (77 lines)

Non-pipeline mode using 7B model:
1. Create session (mode="single"), swap model, compute baseline CC
2. Generate: `<code>...\nInstruction: ...`, temp=0.1, max_tokens=4096
3. Extract `<code>` from response, compute refactored CC
4. Generate insights (separate call with context clear)
5. Send result + insights, persist to DB
6. No strategy/validation/adjudication phases

---

## 8. VALIDATOR MODULE — `app/modules/validator/__init__.py` (727 lines)

### ASTWalker

| Method | Description |
|--------|-------------|
| `serialize_node(node)` | Recursive javalang AST → dict (skips position/documentation) |
| `get_structural_signature(node)` | SHA-256 of: node-type skeleton + operators + string literals + invocations |
| `find_nodes(node, type)` | Type-based tree search |

Structural signature components: concatenated node class names, depth markers for if-statements, sorted operators/strings/invocations.

### RefactorVerifier — 12 intent-specific checks:

| Verifier | Logic |
|----------|-------|
| `verify_flatten_conditional` | Max nesting depth decreased |
| `verify_decompose_conditional` | Binary ops decreased OR new variables |
| `verify_consolidate_conditional` | IfStatement/SwitchStatement count decreased |
| `verify_remove_control_flag` | Exit points increased OR boolean flags removed |
| `verify_replace_loop_with_pipeline` | Loop count decreased (+stream keywords heuristic) |
| `verify_split_loop` | Loop count increased |
| `verify_extract_method` | MethodDeclaration count increased |
| `verify_inline_method` | MethodDeclaration count decreased or same |
| `verify_extract_variable` | VariableDeclarator count increased |
| `verify_inline_variable` | VariableDeclarator count decreased or same |
| `verify_extract_constant` | FieldDeclaration count increased OR new uppercase vars |
| `verify_rename_symbol` | Per-method structural signatures preserved |

### Validator

**Syntax checking**: 3 wrapping templates (raw → class → method wrapper), strips import lines first.

**CC Rules** (`CC_RULES` dict):
| Rule | Meaning | Applied To |
|------|---------|------------|
| STRICT | CC must not increase | CONSOLIDATE_CONDITIONAL, REMOVE_CONTROL_FLAG, REPLACE_LOOP_WITH_PIPELINE, EXTRACT_VARIABLE, INLINE_VARIABLE, EXTRACT_CONSTANT, RENAME_SYMBOL |
| LOOSENED | CC can increase by at most 1 | FLATTEN_CONDITIONAL, SPLIT_LOOP |
| EXTRACT_RULE | Check target method CC only | DECOMPOSE_CONDITIONAL, EXTRACT_METHOD |
| SKIP | No CC check | INLINE_METHOD |

**`verify_complexity()`**: lizard CC analysis. EXTRACT_RULE: method-specific CC check. STRICT/LOOSENED: overall CC check.

**`verify_boundary()`**: Compares structural signatures of non-target methods.

**`has_structural_change()`**: SHA-256 signature comparison. Falls back to string comparison on parse failure.

---

## 9. UTILITY MODULES

### `paths.py` (13 lines)

```python
ROOT_DIR = backend/  # Path(__file__).parent.parent.parent
MODELS_DIR = ROOT_DIR / "models"
MODELS_CONFIG_PATH = ROOT_DIR / "model_config.yaml"
PROMPTS_CONFIG_PATH = ROOT_DIR / "prompts.yaml"
DB_DIR = ROOT_DIR / "db"
DB_PATH = DB_DIR / "history.db"
```

### `types.py` (115 lines)

**Enums**: OrchestrationMode (SINGLE/MULTI), Role (Planner/Generator/Judge/Validator/System/Monolith), RefactorCategory (CONTROL_FLOW/METHOD_MOVEMENT/STATE_MANAGEMENT), RefactorIntent (12 values), StructureUnit (CLASS/METHOD/STATEMENT_UNIT), ExitStatus (SUCCESS/ABORT_SYNTAX/ABORT_STRATEGY/ABORT_SEMANTIC/PROCESSING), FailureTier (TIER_1_SYNTAX / TIER_2_A_COMPLEXITY / TIER_2_B_BOUNDARY / TIER_2_C_INTENT_MATH / TIER_3_JUDGE), DeclarationScope (LOCAL/FIELD/STATIC_FINAL), MutationAction (10 actions).

**Pydantic**: `RefactorRequest` (code min 10/max 100K chars, instruction min 3/max 10K), `HaltRequest`.

### `schemas.py` (167 lines)

**API response models**: `LogEntry`, `HistoryStub`, `HistoryDetail`, `DeleteResponse`.

**Orchestration Pydantic models (GBNF grammar targets)**:
| Model | Key Fields |
|-------|------------|
| `IntentPacket` | refactor_category, specific_intent, scope_anchor |
| `IntentClassifierResponse` | classification_scratchpad, intent_packet |
| `ASTMutationDetails` | modifiers, type, scope, parameters, logic_changes, body_abstract, value |
| `ASTMutation` | action, target, details |
| `ASTModificationPlan` | target_class, ast_mutations (max 5) |
| `ASTArchitectResponse` | architect_scratchpad, ast_modification_plan |
| `ArchitectAnalysisResponse` | analysis_scratchpad, primary_targets, secondary_targets, new_structures_needed, must_preserve |
| `StructuralAuditorResponse` | audit_scratchpad, verdict (ACCEPT/REVISE), issues |
| `AuditIssue` | issue_type (IDENTICAL_CODE/LOGIC_DRIFT/SEMANTIC_DRIFT), description (max 100) |
| `RefactorInsightsResponse` | insights: list[{title, details}] |
| `ErrorReport` | message, faulty_node, actual_value, required_value |
| `ValidationFinding` | failure_tier, error_report, recovery_hint |

### `response_parser.py` (259 lines)

**`detect_repetition(text, min_pattern=80, threshold=3)`**: Strips trailing `]}>`, counts occurrences of last 80 chars. Returns True if >= 3.

**`ResponseParser`** — static methods:
| Method | Logic |
|--------|-------|
| `_is_plausible_java(text)` | Must have `{` or `;`, try javalang parse |
| `_iter_string_aware(text)` | Generator tracking string context |
| `_replace_python_keywords(json_str)` | String-aware None→null, True→true, False→false |
| `_extract_json_braces(text)` | Brace-depth counting → outermost JSON |
| `extract_xml(text, tag)` | Strip `<think>`, extract `<tag>`, Java validation for "code" |
| `extract_json(text, model)` | Try ```json blocks, then braces; strip //, trailing commas, Python-isms; validate via Pydantic |
| `extract_json_text(text)` | Raw JSON string extraction |
| `parse_guaranteed(text, tag, model)` | XML → JSON → raw text triage |

### `ast_matcher.py` (219 lines)

Enriches abstract mutation plans with concrete code:

| Mutation Action | Enrichment |
|----------------|------------|
| ADD_CONSTANT | `insert_after` = class declaration |
| ADD_FIELD | `insert_after` = class declaration |
| ADD_DECLARATION | scope=local → insert_after=target; field/static_final → class decl |
| ADD_METHOD | `insert_after` = class declaration |
| SPLIT_BODY | Same as ADD_METHOD |
| MODIFY_METHOD | For EXTRACT_CONSTANT: sibling ADD_CONSTANT value→find_text, target→replace_text |
| RENAME_SYMBOL | find_text=target, replace_text from body_abstract "Rename X to Y" |

Helpers: `_find_class_declaration_line()` (class/enum/interface regex), `_find_method_body()` (javalang + brace-depth), `_find_literal_in_code()` (substring check).

### `code_utils.py` (50 lines)

| Function | Logic |
|----------|-------|
| `strip_outer_wrapper(code, base_code)` | If base has no class but refactored wrapped: extract inner, preserve imports |
| `order_mutations(mutations)` | RENAME=0 → ADD_*/SPLIT_BODY=1 → MODIFY/REMOVE=2 → other=3 |

### `formatters.py` (79 lines)

`format_plan_for_generator(plan, base_code)`: JSON plan → linear numbered instructions with modifiers, returns, params, changes, body, value, find/replace, insert_after + verification footer.

### `halstead.py` (212 lines)

**`HalsteadMetrics`** dataclass: n1, N1, n2, N2, vocabulary, length, volume, difficulty, effort.

**`compute_mi(code, cc)`**: Full MI formula clamped to [0, 171]:
```
MI = 171 - 5.2 * log2(Volume) - 0.23 * CC - 16.2 * log2(LOC)
```

Operators counted: binary ops, ternary, function call, assignment, cast, array subscript, if, for, while, do, return, throw, class, method.

Operands counted: variable names, method names, type names, member references, literals.

### `performance.py` (112 lines)

**`PerformanceTracker`**: Async polling every 0.5s via pynvml (GPU util, memory). `get_current_metrics()` → live snapshot + CPU/RAM via psutil. `get_metrics()` → aggregated (avg/peak GPU util/memory, inference time).

### `system_monitor.py` (15 lines)

**`SystemMonitor`**: Thin wrapper around `PerformanceTracker` for `/ws/system` WebSocket.

---

## 10. CONFIGURATION FILES

### `model_config.yaml` (48 lines)

4 model entries + orchestration settings (all caps/limits). See Section 1.

### `prompts.yaml` (943 lines)

Complete prompt library:
- `planner`: classifier (12 intent definitions), architect_analysis (code analysis), architect (plan synthesis), analysis_guidance (8 intents), synthesis_guidance (all 12)
- `generator`: coder (code gen), coder_guidance (all 12 with examples + anti-patterns)
- `judge`: auditor, auditor_guidance (FLATTEN_CONDITIONAL), insights
- `single`: coder, insights

Each prompt: ROLE, input format, output format (XML `<code>` or JSON schema), per-intent guidelines.

---

## 11. FAILURE ESCALATION MODEL

```
Phase 3: Syntax Error
  └─ retry (max 3 syntax_iter) → Phase 3 (heal)
  └─ exhausted → TIER_1_SYNTAX → Phase 2 (strategy retry)

Phase 4: Structural Issues (CC/Boundary/Intent)
  └─ 1st structural_fix_attempt → Phase 3 (targeted fix)
  └─ 2nd+ → Phase 2 (strategy retry with cumulative feedback)

Phase 5: Judge REVISE
  └─ TIER_3_JUDGE → Phase 2 (strategy retry)

Phase 2: Architect synthesis failure
  └─ 2 retry attempts → TIER_1_SYNTAX → Phase 2 (strategy retry)

Global circuit breaker: strategy_iter > 3 → ABORT_STRATEGY → Phase 6
```

**Feedback ring buffer**: capped at 3, oldest evicted. Fed into architect synthesis prompt as "Previous Attempt Feedback" with translated suggestions.

---

## 12. SEQUENTIAL EXECUTION DETAIL

1. Mutations sorted: RENAME → ADD_* → MODIFY/REMOVE
2. Each applied via separate LLM call with current working_code
3. After each: syntax check + boundary check
4. Previously added items injected into context for MODIFY_* steps
5. 3 retries per step
6. Any step exhausted → abort sequential, fall to single-shot from original

---

## 13. DATA FLOW

```
User (WebSocket)
  │ send JSON {"type":"multi", "code":..., "user_instruction":...}
  ▼
MessageRouter._handle_multi()
  │ RefactorRequest validation → asyncio.Task
  ▼
Orchestrator.execute_orchestration()
  │ OrchestrationState → db.create_session()
  │
  ├─ Phase 1: lizard CC
  ├─ Phase 2: planner LLM → intent + plan
  ├─ Phase 3: generator LLM → refactored code
  ├─ Phase 4: syntax/CC/boundary/intent checks
  ├─ Phase 5: judge LLM → ACCEPT/REVISE
  └─ Phase 6: db.complete_session()
  │
  │ db.log_status() per step → OrchestrationLog
  │ client.send_status() → WebSocket (real-time)
  │ client.send_result() → WebSocket (final)
  │ client.send_insights() → WebSocket (analysis)
  ▼
SQLite (history.db, WAL mode)
```

---

## 14. KEY DESIGN PHILOSOPHY

1. **Small model focus**: 3B-parameter models with explicit per-intent prompts. GBNF grammar for structured output. Multi-sample generation compensates for model unreliability.

2. **Failure recovery**: Every phase has retry logic with escalating strategies. Feedback ring buffer prevents infinite loops.

3. **Defensive output repair**: Generator models add `throws`, null checks, `public`. `repair_generator_output()` surgically removes only additions not in original.

4. **Anti-hallucination**: Judge "IDENTICAL_CODE"/"LOGIC_DRIFT" overridden when structural analysis contradicts.

5. **Resource management**: `asyncio.Lock` serializes model access. Context cleared between phases. GPU metrics tracked per-session.

6. **Reconnection**: Clients reattach mid-session by sending session_id. `current_client` swapped on reconnection.
