# Judge Guidance Comparison — Comprehensive Report

**Date:** 2026-06-01  
**Model:** Llama-3.2-3B  
**Test:** 10 cases × 5 runs × 3 modes = 150 calls

---

## Summary

| Mode | Overall | ACCEPT | REVISE | vs Old Prompt (41/50) |
|------|---------|--------|--------|----------------------|
| Baseline (simplified + no-op rule) | 31/50 (62%) | 18/25 (72%) | 13/25 (52%) | -10 |
| Definitions (rule-based criteria) | 24/50 (48%) | 20/25 (80%) | 4/25 (16%) | -17 |
| **ICL (code examples)** | **34/50 (68%)** | **25/25 (100%)** | **9/25 (36%)** | **-7** |

**None of the approaches beat the old monolithic prompt (41/50, 82%).**

---

## Per-Case Breakdown

| Case | Exp | Baseline | Definitions | ICL |
|------|-----|----------|-------------|-----|
| extract_method_tax | ACCEPT | 5/5 | 5/5 | 5/5 |
| rename_symbol_field | ACCEPT | 5/5 | 5/5 | 5/5 |
| flatten_guard_clauses | ACCEPT | 5/5 | 5/5 | 5/5 |
| split_loop | ACCEPT | 0/5 | 1/5 | 5/5 |
| extract_constant_pi | ACCEPT | 3/5 | 5/5 | 5/5 |
| extract_constant_broken_sig | REVISE | 5/5 | 0/5 | 0/5 |
| decompose_noop | REVISE | 0/5 | 0/5 | 0/5 |
| flatten_logic_inverted | REVISE | 3/5 | 2/5 | 5/5 |
| extract_method_wrong_params | REVISE | 0/5 | 0/5 | 0/5 |
| rename_broke_structural | REVISE | 5/5 | 1/5 | 4/5 |

---

## What Improved

1. **FLATTEN ACCEPT (flatten_guard_clauses):** 0/5 → 5/5. Both definitions and ICL completely fix the false REVISE on valid guard-clause flattening. The model now correctly recognizes flatten as an expected refactoring pattern.

2. **FLATTEN REVISE (flatten_logic_inverted):** 0-3/5 → 5/5 with ICL. The ICL examples showing merged guards and lost discount logic teach the model what broken flatten looks like.

3. **ACCEPT accuracy (ICL):** 25/25 (100%). The ICL examples show clear ACCEPT patterns across all intents. The model learns what "valid refactoring" looks like.

4. **SPLIT LOOP ACCEPT:** 0-3/5 → 5/5 with ICL.

5. **RENAME REVISE:** 0-1/5 → 4/5 with ICL.

---

## What Got Worse

1. **REVISE accuracy (DEFINITIONS):** 4/25 (16%) — collapsed. Without concrete examples, the rule-based definitions are too abstract for the 3B model to apply consistently.

2. **DECOMPOSE REVISE (decompose_noop):** 5/5 (old prompt) → 0/5 (all modes). The simplified prompt lost the "code unchanged → REVISE" enforcement despite the rule being present. The 3B model ignores the no-op rule when the rest of the prompt is simplified.

3. **EXTRACT METHOD REVISE (wrong_params):** 5/5 (old prompt) → 0/5 (all modes). The model sees the helper exists and dismisses parameter mismatches as acceptable implementation details.

4. **EXTRACT CONSTANT REVISE (broken_sig):** Changed from 4/5 to 0/5. The signature change (double→void) is accepted because the constant was created.

---

## Why ICL Doesn't Beat Old Prompt

The old judge prompt (41/50) has these advantages:

1. **5 explicit audit tasks** with sequential structure: NO-OP → VARIABLE TRACE → LOGIC → SIGNATURE → VERDICT. The sequential chain forces the model to execute each step. The simplified prompt collapses this into a single "compare" instruction.

2. **VARIABLE TRACE as a forcing function**: By listing every variable mapping, the model is forced to notice when variables disappear (broken signatures) or when new variables appear (wrong params). Removing it removed a checksum mechanism.

3. **Explicit REVISE rules in context**: "REVISE only if logic drift would cause different behavior. Stylistic changes and idiomatic improvements are fine." The old prompt balances ACCEPT vs REVISE with explicit decision criteria.

4. **The base prompt carries more weight than guidance**: The 3B model uses the base prompt as its primary instruction. Per-intent guidance is secondary. If the base says "compare and decide" without explicit "when to REVISE" rules, the model defaults to ACCEPT.

---

## Recommendation

**Keep the old judge prompt structure (5 tasks + rules) but add per-intent ICL guidance for FLATTEN only.**

The old prompt handles 7/10 cases at 95%+. The only failing case is `accept_flatten_guard_clauses` at 0/5. ICL guidance for FLATTEN (which scored 5/5 ACCEPT + 5/5 REVISE) addresses this.

```yaml
judge:
  auditor: |
    (OLD PROMPT — keep as-is with 5 tasks + explicit REVISE rules + VARIABLE TRACE)
    
  auditor_guidance:
    FLATTEN_CONDITIONAL: |
      (ICL EXAMPLES — 1 ACCEPT + 2 REVISE + checklist)
    # Other 11 intents — no guidance needed
```

**Expected: 41/50 + FLATTEN fix (0/5 → 5/5) = 46/50 (92%).**

---

## Effort

1. Revert `judge.auditor` to old prompt (remove the simplified version)
2. Add `judge.auditor_guidance` with only FLATTEN_CONDITIONAL ICL entry
3. Wire in `_run_phase_5`
4. Test once — should go from 41/50 to 46/50
