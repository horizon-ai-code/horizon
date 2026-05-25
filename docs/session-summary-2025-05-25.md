# Session Summary — 2025-05-25

## Sub-Step Decomposition + Prompt Hardening

**Branch:** `feat/substep-decomposition` (11 commits on top of `develop`)
**Total delta:** 980 lines added, 64 removed across 6 files
**Team:** 1 orchestrator + 5 subagents (TDD + two-stage review)

---

## 1. Problem Statement

3B GGUF models (Qwen2.5-Coder-3B, Llama-3.2-3B) with 6144 token context historically produce unreliable refactoring output. Three systemic failure modes were identified from the existing codebase and documented issues:

1. **Architect hallucinations** — invents methods, forgets exception types, produces plans that don't match code structure
2. **Generator non-compliance** — ignores the plan, merges guard clauses, changes exception types, invents methods/fields
3. **Judge false REVISE** — rejects valid refactorings because it has no knowledge of what the plan intended

Root cause: all phases use dense single-call prompts with 5-7 simultaneous rules. 3B models cannot reliably process that complexity in one pass.

---

## 2. Design

Three approaches were evaluated and the **Hybrid (C)** selected:

| Component | Approach |
|-----------|----------|
| **Architect** | Split into 2 sub-calls: Analysis (scope enumeration) + Synthesis (mutation JSON) |
| **Generator** | Add self-review call with retry loop (max 2) + anti-pattern guardrails |
| **Classifier** | Add chain-of-thought step directives + 1 few-shot example |
| **Auditor** | Inject plan context so Judge knows what was intentional |
| **Validator** | No changes (already well-scoped) |

Design spec: `docs/superpowers/specs/2025-05-25-substep-decomposition-design.md`
Implementation plan: `docs/superpowers/plans/2025-05-25-substep-decomposition.md`

---

## 3. Commit History

```
06b9423  feat: add ArchitectAnalysisResponse and CodeReviewResponse schemas
ed12665  feat: restructure classifier prompt with CoT steps and few-shot example
247814a  feat: split architect into analysis + synthesis sub-prompts
c899c6a  feat: add anti-patterns to coder prompt and new coder_review prompt
7369639  feat: add plan context injection instructions to auditor prompt
bf76cf7  feat: add architect_analysis and self_review fields to OrchestrationState
2730c92  feat: split architect into analysis + synthesis sub-calls in phase 2
fd15e99  feat: add generator self-review with retry loop to phase 3
ecf5701  feat: inject plan context into auditor prompt in phase 5
20f3169  test: add 5 new tests for sub-step decomposition + update existing flow test
28c592a  test: add integration test script for real-model WebSocket testing
```

---

## 4. Architecture Changes

### Before (6-phase orchestration)

```
Phase 2: Classifier (1 call) → Architect (1 call, 7 rules)
Phase 3: Generator (1 call) → Validator
Phase 4: Validator (3 checks: syntax, CC, boundary, intent)
Phase 5: Judge (1 call, no plan context)
```

### After

```
Phase 2: Classifier (CoT+few-shot) → Clear → ANALYSIS (new, narrow scope) → Clear → SYNTHESIS (5 rules, uses analysis)
Phase 3: Generator (anti-patterns) → SELF-REVIEW (new, checklist, max 2 retries) → Validator
Phase 4: Validator (unchanged)
Phase 5: Judge (plan context injected)
```

### File Changes

| File | What changed |
|------|-------------|
| `prompts.yaml` | 4 prompts replaced, 2 new prompts |
| `app/modules/orchestrator.py` | +3 state fields, Phase 2 split, Phase 3 self-review, Phase 5 plan context |
| `app/utils/schemas.py` | +2 Pydantic models |
| `app/utils/response_parser.py` | +1 helper method |
| `tests/test_orchestrator_flow.py` | +5 new tests, existing test updated |
| `tests/test_integration.py` | New WebSocket integration test script |

### Prompts Redesigned

| Prompt | Lines | Key improvement |
|--------|-------|-----------------|
| `planner.classifier` | 26 | 4-step CoT reasoning, 1 complete example |
| `planner.architect_analysis` (new) | 22 | Narrow scope: enumerate targets + preserve list only |
| `planner.architect` | 32 | Reduced 7→5 rules, references analysis as input |
| `generator.coder` | 28 | 8 explicit anti-patterns (DO NOTs) with list format |
| `generator.coder_review` (new) | 24 | 5-point structured checklist → PASS/FAIL |
| `judge.auditor` | 30 | Plan context awareness, plan fidelity check added |

---

## 5. Unit Tests

```
46/47 tests pass (1 pre-existing: test_performance requires pytest module)

New tests added to test_orchestrator_flow.py:
  test_architect_split_flow           — analysis → synthesis chain
  test_generator_self_review_pass     — clean code passes review
  test_generator_self_review_fail_retry  — FAIL triggers coder retry
  test_generator_self_review_fail_exhausted — 2 fails → proceed anyway
  test_auditor_gets_plan_context      — Phase 5 prompt contains plan summary

Pyright: 0 errors on all modified files
```

---

## 6. Real-Model Integration Tests

5 test cases run against live server with actual GGUF models (Qwen2.5-Coder-3B, Llama-3.2-3B).

### Results

| Test | Intent | Verdict | Duration | Outer Loops | Self-Reviews | CC |
|------|--------|---------|----------|-------------|-------------|-----|
| flatten_conditional | FLATTEN_CONDITIONAL | ✅ ACCEPT | 43s | 1 | 1 | 0→0 |
| extract_method | EXTRACT_METHOD | ✅ ACCEPT | 74s | 3 | 3 | 1→1 |
| extract_constant | EXTRACT_CONSTANT | ✅ ACCEPT | 47s | 1 | 1 | 1→1 |
| rename_symbol | RENAME_SYMBOL | ❌ ABORT | ~120s | 3 | — | — |
| decompose_conditional | DECOMPOSE_CONDITIONAL | ✅ ACCEPT | 81s | 1 | 1 | 6→5 |

### Analysis Outputs

#### flatten_conditional
Guard clauses generated correctly with all 4 original exception types and messages preserved. Self-review triggered once. Complexity showed 0→0 (bug in validator CC calculation). One clean outer loop.

#### extract_method (worst performer)
Took 9 LLM calls across 3 outer loops with 3 self-review retries. The first 8 generated calls still produced code without the extraction. The final output still didn't match the plan—code was identical to original despite the plan clearly specifying an `ADD_METHOD` + `MODIFY_METHOD`. Self-review gave PASS on every attempt despite the non-compliance. Judge accepted on the 3rd iteration.

#### extract_constant
Constant `CONSTANT_PI` created successfully. However: return types changed from `double` to `void`, and `System.out.println` side-effects were added. Auditor missed these behavioral changes.

#### rename_symbol
All 3 outer loops exhausted. Intent math check (TIER_2_C_INTENT_MATH) always failed. The `verify_rename_symbol` method strips `name`/`identifier` from AST serialization and compares hashes, but the model's restructuring changes AST node structure, causing hash mismatch. Final result: ABORT_STRATEGY.

#### decompose_conditional
Rich structural decomposition: 4 new private helper methods created, complex boolean broken down. However: return type changed from `boolean` to `void`, invented non-existent `setEligible()` method, added instance fields. Auditor accepted despite these behavioral changes.

---

## 7. Issues Found in Real-Model Testing

### Issue A: Self-Review is a False Sense of Security (CRITICAL)
Self-review returned **PASS in every single case** — even when code was clearly wrong:
- `extract_method`: code unchanged from original → PASS
- `decompose_conditional`: return type `boolean→void`, invented `setEligible()` → PASS
- `extract_constant`: return type `double→void`, side-effects added → PASS

**Root cause:** The 3B Qwen model cannot reliably audit its own output. It has the same blind spots as the generator. The checklist is thorough but the model doesn't actually check — it defaults to PASS.

**Decision:** Remove self-review step (not in thesis design, introduces risk without benefit).

### Issue B: Judge Misses Behavioral Changes
Despite the improved auditor prompt with plan context:
- Return type changes not detected (`double→void`, `boolean→void`)
- Unplanned method calls added (`setEligible()`)
- Instance fields added where none existed

**Root cause:** Auditor prompt focuses on "logic drift" (conditional paths) but doesn't explicitly check method signatures or unplanned additions.

**Fix:** Add explicit signature comparison to auditor prompt.

### Issue C: RENAME_SYMBOL Intent Check Too Strict
`verify_rename_symbol` strips names from full AST serialization and compares SHA-256 hashes. Any structural change (restructured assignments, different node types) produces a different hash, even if the rename itself is correct.

**Fix:** Use `get_structural_signature()` instead of full `serialize_node()` — structural signature already ignores variable names and captures only control flow structure.

### Issue D: Complexity Calculation Returns 0
`flatten_conditional` returns CC=0→0 for a class with 6 nested if-statements (expected CC≈7-8).

**Root cause:** The code is a full class (`public class OrderProcessor { ... }`) but the validator's `get_complexity()` wraps it with another `class ASTWrapper { ... }` template. This creates a nested class that Lizard cannot parse or measures incorrectly.

### Issue E: Generator Inconsistency
Despite the anti-pattern guardrails, the generator frequently:
- Produces code that doesn't match the plan
- Changes method signatures (return types, parameters)
- Adds infrastructure/invented methods

**Root cause:** No structural verification of planned elements in the validator.

**Fix:** Add a "verify planned methods exist" check to validator.

---

## 8. Remaining Work

| Priority | Fix | Impact | Status |
|----------|-----|--------|--------|
| P0 | Remove self-review step | Removes false PASS issue | Pending |
| P1 | Add signature comparison to auditor prompt | Catches return type drift | Pending |
| P1 | Fix RENAME_SYMBOL intent check (use structural signature) | Reduces rename false rejections | Pending |
| P2 | Fix CC template wrapping bug | Corrects complexity metrics | Pending |
| P3 | Add "verify planned methods exist" to validator | Catches generator non-compliance early | Pending |

---

## Test Results Archive

All raw integration test outputs saved to `test_results/`:

| File | Content |
|------|---------|
| `test_results/flatten_run1.json` | Full event log for flatten_conditional |
| `test_results/extract_run1.json` | Full event log for extract_method |
| `test_results/const_run1.json` | Full event log for extract_constant |
| `test_results/decompose_run1.json` | Full event log for decompose_conditional |

---

## Files Modified (Final State)

| File | Lines total | Purpose |
|------|-------------|---------|
| `prompts.yaml` | ~180 | All LLM system prompts |
| `app/modules/orchestrator.py` | ~690 | 6-phase orchestration state machine |
| `app/utils/schemas.py` | ~160 | Pydantic response models |
| `app/utils/response_parser.py` | ~120 | JSON/XML extraction utilities |
| `tests/test_orchestrator_flow.py` | ~470 | Unit tests with mocked LLM |
| `tests/test_integration.py` | ~333 | WebSocket integration test script |
