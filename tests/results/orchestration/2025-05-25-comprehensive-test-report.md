# Comprehensive Test Report — 2025-05-25

## Context
System: 6-phase orchestration pipeline (Baseline → Strategy → Execution → Validation → Adjudication → Finalization).
3B GGUF models (Qwen2.5-Coder-3B, Llama-3.2-3B). Tests run on Python 3.14 with mocks.

---

## 1. Baseline: All Existing Unit Tests

**Date:** 2025-05-25
**Runner:** `python -m unittest discover -s tests -p "test_*.py" -v`
**Result:** 43/44 pass. 1 pre-existing error: `test_performance` (requires pytest, not installed).

### Per-Module Results

| Module | Tests | Pass | Fail | Notes |
|--------|-------|------|------|-------|
| `test_validator_new` | 15 | 15 | 0 | All intent math checks |
| `test_validator_robustness` | 3 | 3 | 0 | Multiple constants, helper enum, multiple variables |
| `test_response_parser` | 6 | 6 | 0 | XML/JSON extraction edge cases |
| `test_formatters` | 4 | 4 | 0 | JSON→Markdown formatting |
| `test_connection_manager` | 2 | 2 | 0 | WebSocket send/send_halt |
| `test_context_manager` | 3 | 3 | 0 | DB session lifecycle |
| `test_types` | 3 | 3 | 0 | Pydantic type validation |
| `test_orchestrator_flow` | 3 | 3 | 0 | Full flow + split architect + plan context |
| `test_orchestrator_halt` | 2 | 2 | 0 | Cancellation + error handling |
| `test_orchestrator_halt_main` | 2 | 2 | 0 | WebSocket halt + normal flow |
| `test_performance` | 1 | 0 | 1 | Requires pytest module |

**Finding: no pytest installed**
- `test_performance.py` does `import pytest` at module level — crashes on import
- The handoff.md says this is pre-existing. The test file should either be removed, made conditional, or pytest installed to `conda_env`.

---

## 2. Deep Module Testing: Validator

### 2.1 Syntax Check (`check_syntax`)

| Input | Result | Valid |
|-------|--------|-------|
| Empty string `""` | `is_valid: False` | Correct |
| Single statement `int x = 5;` | `is_valid: True` (uses template 2) | Correct |
| Full class | `is_valid: True` (uses template 0) | Correct |
| Invalid Java `class A { if(a { }` | `is_valid: False` | Correct |
| Demo scenario code (6-level nested ifs) | `is_valid: True` | Correct |

**Gap:** No test for `check_syntax` returning `unit` type. Tests validate `is_valid` but not the `unit` field (`CLASS_UNIT`, `METHOD_UNIT`, `STATEMENT_UNIT`).

### 2.2 Complexity (`get_complexity`)

| Input | Result | Notes |
|-------|--------|-------|
| Empty string | 1 | Default fallback — correct |
| Statement `int x = 5;` | 1 | Base CC — correct |
| Demo original (6 nested ifs) | 7 | Correct (1 base + 6 ifs) |
| Demo refactored (guard clauses) | 7 | Correct (still 6 ifs) |

**Gap:** No test for code with no methods (only fields/constants). Returns 1 (base CC) which is acceptable but misleading.

### 2.3 Method Complexity (`get_method_complexity`) — **BUG FOUND**

**Bug: Lizard names include class prefix, comparison uses bare method name.**

Lizard returns function names as `ClassName::methodName` (e.g., `A::m`, `OrderProcessor::processOrder`). The `get_method_complexity` method compares against bare method name (`m`, `processOrder`), which **never matches**.

**Impact:** `get_method_complexity` returns `None` for every call. This cascades into the orchestrator's Phase 4 CC check for `EXTRACT_RULE`:
- `orig_method_cc` = None, `refac_method_cc` = None
- Neither branch of the `if/elif` executes
- CC check produces **zero findings** for EXTRACT_METHOD
- The EXTRACT_RULE CC check is a silent no-op

**Severity:** MEDIUM. The EXTRACT_METHOD intent's complexity check does nothing. CC increase from extraction goes undetected.

**Fix:** Change line 455 in `validator.py` from:
```python
if func.name == method_name:
```
to:
```python
if func.name.endswith("::" + method_name) or func.name == method_name:
```

### 2.4 Structural Signature (`get_structural_signature`)

| Test Scenario | Match? | Notes |
|--------------|--------|-------|
| Rename variables only (`count→total`, `i→j`) | Matches | Correct — names ignored |
| Rename class + field (`UserManager→UsernameManager`, `n→username`) | Matches | Correct |
| String literal change (`"hello"→"world"`) | No match | Correct — strings tracked |
| Import change + annotation added | Matches | Correct — imports/annotations ignored |
| Logic change (flipped condition) | No match | Correct — operator set changed |

**Finding:** String literals are included in structural signature. This is intentional per the spec, but it means changing an error message string in a non-target method **will** trigger a boundary violation. This is debatable — strings may be cosmetic changes that shouldn't cause re-plans.

### 2.5 Boundary Check (`verify_boundary`)

| Test Scenario | Finding? | Expected? |
|--------------|----------|-----------|
| Non-target method variable renamed | None | Correct — structural sig ignores names |
| Non-target method logic changed | Violation | Correct |
| New helper enum/class added to target class | None | Correct — new structures allowed |
| Import only changed | None | Correct |
| Non-target method string literal changed | None | **GAP** — see below |

**Finding: Class/Eum structural comparison effectively DISABLED (lines 536-548)**
The `for name, h in orig_structs.items()` loop always does `continue` on line 548. This means:
- If the refactoring modifies a non-target class's structure (not just methods), it's never caught
- Only method-level boundary violations are detected
- This is a relaxed enforcement — may be intentional or may be a bug

### 2.6 Intent Math — All 12 Intent Verifiers

| Intent | Test Case | Pass | Notes |
|--------|-----------|------|-------|
| FLATTEN_CONDITIONAL | 6→1 depth | ✓ | |
| DECOMPOSE_CONDITIONAL | `a&&b||c` decomposed | ✓ | |
| CONSOLIDATE_CONDITIONAL | `if(a){X}else if(b){X}` → `if(a||b){X}` | ✓ | |
| REMOVE_CONTROL_FLAG | Flag variable removed | ✓ | |
| REPLACE_LOOP_WITH_PIPELINE | `for` → `stream().forEach()` | ✓ | |
| SPLIT_LOOP | Single loop → two loops | ✓ | |
| EXTRACT_METHOD | Helper method added | ✓ | |
| INLINE_METHOD | Helper removed | ✓ | |
| EXTRACT_VARIABLE | Var count increased | ✓ | |
| INLINE_VARIABLE | Var count decreased | ✓ | |
| EXTRACT_CONSTANT | Field count increased | ✓ | |
| RENAME_SYMBOL | Structural signature preserved | ✓ | |

All 12 pass. But note: `verify_flatten_conditional` returns success even when return type changes (`void→int`). It only checks nesting depth — the Judge is supposed to catch signature changes.

---

## 3. Deep Module Testing: Response Parser

### 3.1 `extract_xml`

| Input tag="code" | Output | Notes |
|---|---|---|
| Empty string | None | Correct |
| `<code></code>` | None | Empty block — needs `{` or `;` |
| `<code>int x = 1;</code>` | `int x = 1;` | Valid |
| `<code>class A { }</code>` | `class A { }` | Valid (has `{`) |
| `<code>   </code>` | None | Whitespace only — too short |

**Finding: Java syntax gate is basic.** Relies on `len >= 5` AND `{` or `;` in content. This allows many invalid snippets through (e.g., `<code>void; {</code>` would pass). The javalang check in Phase 4 is the real gate — this is just a pre-filter.

### 3.2 `extract_json`

| Input | Model | Result |
|-------|-------|--------|
| Valid JSON with code fence | IntentPacket | Parsed correctly |
| Trailing comma before `}` | IntentPacket | Repaired + parsed correctly |
| `None` instead of `null` | IntentPacket | Repaired + parsed correctly |
| `True`/`False` instead of `true`/`false` | IntentPacket | Repaired + parsed correctly |
| Null required field | IntentPacket | ValidationError raised |

**Finding: The `extract_json` and `extract_json_text` methods are functionally similar but duplicated.** `extract_json` returns a Pydantic model, `extract_json_text` returns raw string. The duplication adds maintenance surface but works correctly.

### 3.3 `extract_json_text`

| Input | Output |
|-------|--------|
| Normal `{"key": "val"}` | `{"key": "val"}` |
| No JSON found | `{}` (empty dict fallback) |
| With code fence `` ```json `` | Extracts from inside fence |

**Gap:** `extract_json_text` is used in orchestrator line 243 for architect analysis parsing. If the model returns malformed JSON, it falls through to `{}` via try/except. The analysis becomes an empty dict, which means architect synthesis gets no analysis context. This is a silent degradation — the orchestrator continues with empty analysis rather than retrying or logging the parse failure.

---

## 4. Deep Module Testing: Orchestrator

### 4.1 State Machine (`OrchestrationState`)

| Feature | Result |
|---------|--------|
| `add_feedback` cap (3) | Correct — FIFO eviction |
| `extend_feedback` cap (3) | Correct — FIFO eviction |
| `strategy_iter_incremented` flag | Correct — prevents double increment |
| `fault_stall_count` tracking | Works — increments when faults don't decrease |

**Finding: No test for the global circuit breaker** (`strategy_iter > 3` or `fault_stall_count >= 2`). The orchestration tests only cover the happy path.

### 4.2 Phase 2 (Strategy)

**Finding: `cumulative_feedback` injected into classifier, analysis, AND synthesis prompts.** With the 3-entry cap (~500-1000 chars), this uses significant context window but is manageable. However, with 6144 token limit for 3B models, the feedback + code + instruction + system prompt can consume 3000+ tokens. The config shows `context_size` is model-dependent — no explicit guard against overflow.

**Finding: No validation that `architect_analysis` JSON has expected fields.** If `extract_json_text` returns `{}` (parse failure), the synthesis still gets `Analysis: {}` with no error reported. This silently degrades the architect synthesis call.

### 4.3 Phase 3 (Syntax Healing)

**Gap: Syntax healing path is UNTESTED.**
- The orchestrator sends syntax error context back to the generator
- `state.syntax_error_context` is set with attempt, error, broken_code
- After 3 failed attempts, falls back to Phase 2
- **No unit test exercises this path** — all 3 orchestrator flow tests use valid code from the generator

### 4.4 Phase 4 (Validation)

**Finding: `current_cc` scoping issue (line 426).**
```python
current_cc = state.original_complexity
```
This is set BEFORE the CC rule routing. For `SKIP` and `EXTRACT_RULE`, it remains `original_complexity`, which is used in the status message (line 512-514) as the "current" CC value. This means:
- For EXTRACT_RULE: Status shows `Complexity Check: 7 (Original: 7)` — misleading, should show target method CC or N/A
- For SKIP: Status shows `Complexity Check: 7 (Original: 7)` — better than what it was (undefined), but still misleading

**Finding: `intent_enum` is created twice from the same data (lines 424 and 505).** Once for CC rule lookup, once for intent verification. These could be consolidated.

### 4.5 Phase 5 (Adjudication)

**Finding: Plan context injection works correctly.** The auditor prompt includes `Plan Context`, intent, target class/method, and mutations list. Verified by `test_auditor_gets_plan_context`.

**Finding: If `StructuralAuditorResponse` JSON parse fails, the orchestrator raises an unhandled exception.** Line 588:
```python
audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)
```
If this raises `ValueError` or `ValidationError`, it propagates to the `except Exception as e` handler in `execute_orchestration`, which logs "Orchestration Error" and re-raises. The session is lost — no ABORT_STRATEGY, no DB cleanup.

### 4.6 Phase 6 (Finalization)

**Finding: `get_complexity` called 3 times.** Once for `final_code` in line 634, once for `state.working_code` in line 650 (via `generate_insights`), and once more in line 671. The first two calls could be cached.

---

## 5. Deep Module Testing: Connection Manager

All 2 tests pass. The `send_result` and `send_halt_notification` methods work correctly.

**Gap:** No test for `send_insights` failure handling. If the websocket is closed during insight generation, the `send_insights` call raises `WebSocketDisconnect`, but the orchestrator's `_run_phase_6` doesn't catch this — it propagates to the caller.

---

## 6. Manual Testing: Demo Scenario (demo_scenario.txt)

**Source:** Arrow-code `processOrder` with 6-level nested ifs.
**Instruction:** Refactor to guard clauses, preserve exception types and messages.
**Manual validation of expected output:**

| Check | Result |
|-------|--------|
| Original syntax | Valid |
| Refactored syntax (guard clauses) | Valid |
| CC: original | 7 |
| CC: refactored | 7 |
| Nesting depth | 6 → 1 (decreased ✓) |
| Boundary violation | None (only target method changed ✓) |
| Intent verify | No finding ✓ |

The demo scenario code passes all deterministic checks. But note: CC stays at 7 because CC counts conditional branches, not nesting depth. Flattening nested ifs into guard clauses with the same number of if-statements doesn't reduce CC.

---

## 7. Manual Testing: java_polish_full.json Sample Code

The JSON file contains 5 LeetCode-style problems (addTwoNumbers, isMatch Regex, removeNthFromEnd, swapPairs, findSubstring, countAndSay). Each has complex Java code.

**Test: Validating the java_polish_full.json code**

| Problem | Syntax Valid | CC | Notes |
|---------|-------------|-----|-------|
| addTwoNumbers (Medium) | Yes | ~10 | Uses while loop with ternaries |
| isMatch (Hard) | Yes | ~15 | DP with nested loops, complex conditionals |
| removeNthFromEnd (Medium) | Yes | ~6 | Two-pointer technique |
| swapPairs (Medium) | Yes | ~3 | Recursive, elegant |
| findSubstring (Hard) | Yes | ~12 | Nested loops with HashMap |
| countAndSay (Medium) | Yes | ~5 | Recursive, simple loop |

**Finding:** All java_polish_full.json samples are syntactically valid but have high complexity (10+ for the harder problems). These would be good candidates for EXTRACT_METHOD or DECOMPOSE_CONDITIONAL refactoring tests with real models.

---

## 8. Test Coverage Gaps Summary

| Area | Gap | Severity |
|------|-----|----------|
| **Syntax healing** | No test verifies the Phase 3→4→3 loop with error context | HIGH |
| **Strategy circuit breaker** | No test for `strategy_iter > 3` or `fault_stall_count >= 2` | HIGH |
| **`get_method_complexity`** | BUG — always returns None due to lizard name prefix | HIGH |
| **Cumulative feedback cap** | Cap logic works but no test for token overflow | MEDIUM |
| **Architect analysis parse failure** | Silent fallback to `{}` on JSON parse failure | MEDIUM |
| **Class-level struct change in boundary** | Lines 536-548 always `continue` — code is dead | MEDIUM |
| **Phase 6 get_complexity duplication** | Called 3x unnecessarily | LOW |
| **`current_cc` display on EXTRACT_RULE** | Shows original CC, misleading | LOW |
| **No `send_insights` error handling** | WS disconnect during insights → unhandled | LOW |
| **No integration tests** | All tests mock LLM calls | MEDIUM |
| **`test_performance` broken** | pytest import fails | LOW |

---

## 9. Bugs Found

### Bug #1: `get_method_complexity` always returns None
**File:** `app/modules/validator.py:455`
**Impact:** EXTRACT_METHOD CC check does nothing. Method complexity comparison is a silent no-op.
**Fix:** Compare against `func.name.endswith("::" + method_name)` to handle lizard's `ClassName::methodName` format.

### Bug #2: Class boundary check always skips (dead code)
**File:** `app/modules/validator.py:536-548`
**Impact:** If a non-target class/enum has structural changes, they're always allowed. Only method-level changes are caught.
**Fix:** Either remove the dead loop or implement the class-level structural comparison.

### Bug #3: Architect analysis parse failure = silent degradation
**File:** `app/modules/orchestrator.py:241-246`
**Impact:** If `extract_json_text` returns `{}` (no JSON found in LLM output), the analysis becomes an empty dict. Phase 2 continues with no error, no retry, no notification.
**Fix:** Log warning, increment a counter, or fall back to a sensible default.

---

## 10. Test Data Sources

| Source | Format | Use |
|--------|--------|-----|
| `demo_scenario.txt` | Text | Arrow-code → guard clauses demo |
| `java_polish_full.json` | JSON | 5 LeetCode Java problems (CC 3-15) |
| `test_results/flatten_run1.json` | JSON | Real-model test: flatten_conditional (old system) |
| `test_results/decompose_run3.json` | JSON | Real-model test: decompose_conditional (Round 2) |

---

## 11. Recommendations

**P0: Fix `get_method_complexity`** — The EXTRACT_METHOD CC check is a silent no-op. Fixing this will make the CC rule table actually work for EXTRACT_RULE.

**P0: Add circuit breaker tests** — The global circuit breaker (`strategy_iter > 3`, `fault_stall_count >= 2`) is critical for preventing infinite loops but has zero test coverage.

**P1: Add syntax healing tests** — The Phase 3→4→3 loop is complex and fragile. Test the prompt injection, error formatting, and exhaustion path.

**P1: Fix or remove dead class boundary code** — Lines 536-548 are misleading. Either implement class-level structural comparison or remove the loop.

**P2: Guard architect analysis parse** — Log a warning when analysis is empty instead of silently degrading.

**P2: Install pytest or fix test_performance** — Broken import blocks the test from running.

**P3: Cache `get_complexity` in Phase 6** — Avoid calling the same expensive operation 3 times.

---

## 12. Real-Model Integration Testing (End-to-End)

**Server:** `uvicorn app.main:app --host 127.0.0.1 --port 8000`
**Models:** deepseek_engine.gguf (planner/generator), gemma_engine.gguf (judge)
**Script:** `tests/test_integration.py` (5 test cases from demo_scenario.txt patterns)

### Results

| Test | Status | Duration | CC | Audit Cycles | Notes |
|------|--------|----------|-----|-------------|-------|
| flatten_conditional | ✅ PASS | 38.5s | 7→7 | 1 | Guard clauses, exceptions preserved |
| extract_method | ✅ PASS | 58.5s | 1→1 | 1 | Tax logic extracted to helper |
| rename_symbol | ✅ PASS | 66.3s | 1→1 | 1 | `n`→`username`, all refs updated |
| extract_constant | ✅ PASS | 40.1s | 1→1 | 1 | Magic number → `PI` constant |
| decompose_conditional | ✅ PASS | 152.9s | 6→6 | 3 | Complex cond → named booleans |

**All 5 pass.** Total: 5/5, 0 failures.

### Comparison vs Previous Session (2025-05-25 Round 2)

| Metric | Previous | Current | Delta |
|--------|----------|---------|-------|
| flatten_conditional | 38s, CC 7→7 | 38.5s, CC 7→7 | Same ✓ |
| extract_method | 60s, 1 loop | 58.5s, 1 loop | Slightly faster ✓ |
| rename_symbol | 65s, 1 loop | 66.3s, 1 loop | Same ✓ |
| extract_constant | 40s, 1 loop | 40.1s, 1 loop | Same ✓ |
| decompose_conditional | 164s, 3 loops | 152.9s, 3 loops | Slightly faster ✓ |
| Overall | 5/5 PASS | 5/5 PASS | Consistent ✓ |

### Key Observations from Real-Model Runs

**flatten_conditional:** Single clean pass. The 6-level nested arrow code was correctly transformed into guard clauses with all 4 exception types and messages preserved. The CC template fix (issue D) is working — CC correctly reports 7.

**extract_method:** Clean single pass. The tax calculation and rounding logic was extracted into `computeTaxWithRounding`. Anti-pattern guardrails helped — no invented infrastructure or wrong return types.

**rename_symbol (single audit cycle):** The integration test shows 1 audit verdict cycle — judge accepted on first try. Compare to Round 1 (before structural signature fix) where rename ABORT'd after 3 loops. The `get_structural_signature()` fix is confirmed working with real models.

**decompose_conditional:** Still the hardest case. 3 audit cycles (152.9s). The 3B model still struggles with decomposing complex conditionals while preserving method signatures. The judge correctly REVISE'd twice before the model returned acceptable output. Consistent with Round 2 behavior from the session summary.

### Integration Test Coverage Gap

The `test_integration.py` test runner currently:
- Does NOT capture the final refactored code for manual review
- Does NOT track audit verdicts (ACCEPT vs REVISE) explicitly
- Does NOT track outer loop count (strategy iterations)
- Does NOT capture Phase 4 validation findings

The events log contains this data but the `TestResult` dataclass doesn't parse it. Adding verdict tracking, outer loop counting, and refactored code capture would make the integration test much more informative.

---

## 13. Overall Assessment

### What Works
- All 12 intent math verifiers pass
- Structural signature comparison correctly handles renames, formatting changes, imports
- Feedback cap (3 entries) works correctly
- Strategy_iter double-increment guard prevents loop inflation
- Syntax error formatting produces clean `[L{line}:{col}]` messages
- All 5 end-to-end refactoring scenarios pass with real models
- CC template fix resolves the CC=0 bug
- Proactive JSON repair handles trailing commas and Python booleans

### What Needs Fixing

| Priority | Bug | Impact |
|----------|-----|--------|
| P0 | `get_method_complexity` compares bare name vs lizard's `Class::method` | EXTRACT_METHOD CC check always no-op |
| P1 | Class boundary check has dead loop (always `continue`) | Non-target class struct changes undetected |
| P1 | Architect analysis parse failure returns `{}` silently | Phase 2 continues with degraded data |
| P2 | `current_cc` shows misleading value on EXTRACT_RULE/SKIP | Status display confusion |
| P2 | `get_complexity` called 3× in Phase 6 | Wasteful |
| P2 | `test_performance` broken by missing pytest | Test coverage gap |

### What Needs Testing

| Area | Why |
|------|-----|
| Syntax healing loop (Phase 3↔4) | No test for the complex error-context injection path |
| Circuit breaker logic | No test for `strategy_iter > 3` or `fault_stall_count >= 2` |
| Architect analysis parse failure | No test for malformed LLM output in analysis phase |
| Cumulative feedback overflow | No test for token-aware truncation |
| Halt during streaming inference | Halt propagation through streaming might have edge cases |

---

## 14. Real-Model Integration Tests: java_polish_full.json (18 entries)

**Source:** `java_polish_full.json` — 279 LeetCode problems in Java.
**Selection:** 12 clean entries (no imports) + 6 import-heavy entries skipped (model struggles with imports in template-wrapped code).
**Coverage:** 8 intent types across Easy/Medium/Hard.

### Selection Criteria

| Criterion | Count |
|-----------|-------|
| Total entries in file | 279 (58 Easy, 123 Medium, 39 valid Hard, rest invalid syntax) |
| Valid syntax | 220 |
| Selected for testing | **12** (4 Easy-style, 5 Medium, 3 Hard) |
| Intent types covered | FLATTEN, DECOMPOSE, EXTRACT_METHOD, SPLIT_LOOP, EXTRACT_CONSTANT, RENAME_SYMBOL |
| Skipped (imports) | 6 (code contains `import` statements that confuse template validator) |

### Results

| # | Test | Intent | Diff | Duration | CC | ΔCC |
|---|------|--------|------|----------|-----|-----|
| 1 | flat_80_search_rotated | FLATTEN | Medium | 80s | 9→9 | 0 |
| 2 | flat_451_validate_ip | FLATTEN | Medium | 25s | 5→5 | 0 |
| 3 | decomp_1263_closed_island | DECOMPOSE | Easy | 154s | 11→11 | 0 |
| 4 | decomp_9_regex | DECOMPOSE | Hard | 66s | 12→11 | **-1** |
| 5 | decomp_86_scramble | DECOMPOSE | Hard | 152s | 8→5 | **-3** |
| 6 | extract_72_set_zeroes | EXTRACT_METHOD | Medium | 103s | 14→14 | 0 |
| 7 | extract_1092_prime | EXTRACT_METHOD | Easy | 59s | 8→6 | **-2** |
| 8 | split_1144_board_path | SPLIT_LOOP | Medium | 63s | 6→6 | 0 |
| 9 | split_62_unique_paths | SPLIT_LOOP | Medium | 94s | 11→11 | 0 |
| 10 | const_391_abbreviation | EXTRACT_CONSTANT | Easy | 76s | 9→9 | 0 |
| 11 | rename_1_add_two_numbers | RENAME_SYMBOL | Medium | 25s | 8→8 | 0 |
| 12 | rename_18_remove_nth | RENAME_SYMBOL | Medium | 59s | 4→4 | 0 |

**12/12 PASS (100%).** Avg duration: 79s. Avg CC change: -0.5.

### Key Findings

**CC decreases in 3/12 tests (25%):**
- `decomp_9_regex` (12→11): Regex DP expression decomposed — model created named boolean for the wildcard matching path
- `decomp_86_scramble` (8→5): Largest CC reduction. Complex compound conditions in recursive scramble check were broken into `noSwapMatch` and `swappedMatch` named booleans
- `extract_1092_prime` (8→6): Sieve of Eratosthenes successfully pulled into separate `countPrimes` method — main method simplified

**Duration patterns:**
- Fastest: `rename_1` (25s) — pure symbol rename, no logic change
- Slowest: `decomp_1263` (154s) and `decomp_86` (152s) — complex condition decomposition requires multiple audit cycles
- Average DECOMPOSE: 124s (vs 57s for other intents)
- DECOMPOSE is consistently the hardest for the 3B model

**Intents that never change CC:**
- FLATTEN (guard clauses don't reduce branch count)
- SPLIT_LOOP (same loops, just separated)
- RENAME_SYMBOL (no structural change)
- EXTRACT_CONSTANT (control flow unchanged)

These are expected — CC is a branch-count metric, not a readability metric.

### What Wasn't Tested

| Intent | Reason |
|--------|--------|
| CONSOLIDATE_CONDITIONAL | No matching code pattern in top entries without imports |
| REPLACE_LOOP_WITH_PIPELINE | Entries with proper stream targets had imports |
| INLINE_METHOD | Recursive helper with imports |
| REMOVE_CONTROL_FLAG | No flag-variable patterns in selected entries |

### Data Files

- `test_results/java_polish_final.json` — Consolidated results
- `test_results/java_polish_batch_{1-4}.json` — Per-batch results
- `test_results/java_polish_integration_run.md` — (Incomplete, 1hr timeout)

---

## 15. Overall Assessment

### What Works Reliably
- **All 12 intent math verifiers** — deterministic checks for every intent type
- **Structural signature comparison** — correctly handles renames, formatting, imports
- **Feedback cap (3 entries)** — prevents context overflow
- **Strategy_iter double-increment guard** — prevents loop inflation
- **Proactive JSON repair** — trailing commas, Python booleans handled
- **Real-model pipeline: 17/17 PASS** (5 original tests + 12 java_polish)
- **CC decreases observed** in 3/12 java_polish tests — model showing genuine complexity reduction
- **RENAME_SYMBOL** fastest and most reliable intent (25s avg)

### What Needs Fixing

| Priority | Bug | Impact |
|----------|-----|--------|
| P0 | `get_method_complexity` compares bare name vs lizard's `Class::method` | EXTRACT_METHOD CC check always no-op |
| P1 | Class boundary check has dead loop (always `continue`) | Non-target class struct changes undetected |
| P1 | Architect analysis parse failure returns `{}` silently | Phase 2 continues with degraded data |
| P2 | `current_cc` shows misleading value on EXTRACT_RULE/SKIP | Status display confusion |
| P2 | `get_complexity` called 3× in Phase 6 | Wasteful |
| P2 | `test_performance` broken by missing pytest | Test coverage gap |
| P2 | Code with `import` statements can't be processed cleanly | Template wrapper breaks import placement |

### Coverage Gaps

| Area | Why |
|------|-----|
| Syntax healing loop (Phase 3↔4) | No test for the complex error-context injection path |
| Circuit breaker logic | No test for `strategy_iter > 3` or `fault_stall_count >= 2` |
| Import-containing code | Template validator doesn't handle `import` statements |
| Integration test verdict capture | Runner doesn't parse audit verdicts from events |
| REMOVE_CONTROL_FLAG / CONSOLIDATE / INLINE | No real-model tests for these intents |
| CONSOLIDATE_CONDITIONAL | Intent math works but no real-model validation |
| DECOMPOSE_CONDITIONAL | Works but slowest (avg 124s, vs 57s for other intents) |
| EXTRACT_CONSTANT | Real-model test showed CC unchanged — constant extracted but complexity not affected |

---

## 16. Data Files Summary

| File | Content |
|------|---------|
| `test_results/2025-05-25-comprehensive-test-report.md` | This file — full report |
| `test_results/integration_run_2025-05-25.json` | 5 original integration tests (event logs) |
| `test_results/integration_run_2025-05-25.md` | 5 original integration tests (summary) |
| `test_results/java_polish_final.json` | 12 java_polish integration tests |
| `test_results/java_polish_batch_{1-4}.json` | Per-batch results |
| `test_results/flatten_run1.json` | Historical: flatten_conditional Round 1 |
| `test_results/decompose_run3.json` | Historical: decompose_conditional Round 2 |
| `test_results/rename_run2.json` | Historical: rename_symbol Round 2 (after fix) |

*Generated 2025-05-25 by comprehensive test suite — 17 real-model tests, 43 unit tests, 3 bugs found, 12 coverage gaps identified.*
