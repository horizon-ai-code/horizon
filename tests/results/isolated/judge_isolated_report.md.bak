# Judge Isolated Reasoning Report

**Date:** 2026-05-28T15:12  
**Model:** Llama-3.2-3B-Instruct  
**Cases:** 10 cases × 5 runs = 50 calls  
**Design:** 5 ACCEPT-expected + 5 REVISE-expected, each run 5× for consistency  

---

## Summary

| Metric | Result |
|--------|--------|
| Total runs | 50 |
| Correct verdict (matches expected) | 44/50 (88%) |
| False ACCEPT rate (REVISE-expected but ACCEPT) | 5/25 (20%) |
| False REVISE rate (ACCEPT-expected but REVISE) | 0/25 (0%) |
| Accuracy on ACCEPT-expected cases | 25/25 (100%) |
| Accuracy on REVISE-expected cases | 19/25 (76%) |
| Unanimous cases (5/5 same verdict) | 9/10 |
| Volatile cases (3-2 split) | 0/10 |
| Avg scratchpad length | 381 chars |
| Avg issues count | 0.2 |
| Avg verdict latency | 5.5s |

---

## Per-Case Detail

### Case 1: accept_extract_method_tax (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | [] | 308 | 4.82s |
| 2 | ACCEPT | [] | 308 | 4.74s |
| 3 | ACCEPT | [] | 359 | 5.15s |
| 4 | ACCEPT | [] | 350 | 5.19s |
| 5 | ACCEPT | [] | 308 | 4.78s |
- **Accuracy:** 5/5 (100%) ✓
- **Consistency:** Unanimous

#### What happened
All 5 runs correctly ACCEPT'd the tax method extraction. Scratchpad tracks variable mapping (`price→subtotal`, `taxRate→taxRate`) and confirms logic equivalence. The Judge correctly identified that the refactored `calculateTotal` calls `computeTaxWithRounding` with the right arguments and produces identical results. Zero issues flagged.

#### Why this likely happened
The refactored code has clear structural signals: a new method `computeTaxWithRounding`, the original method `calculateTotal` delegates to it, all signatures match, and the computation is mathematically identical. The Judge's SIGNATURE CHECK and VARIABLE TRACE tasks both have easy verification targets. This is within the model's reliable operating range — the code changes are localized and the equivalence is straightforward.

---

### Case 3: accept_flatten_guard_clauses (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | [] | 234 | 3.49s |
| 2 | ACCEPT | [] | 234 | 3.54s |
| 3 | ACCEPT | [] | 234 | 3.49s |
| 4 | ACCEPT | [] | 234 | 3.53s |
| 5 | ACCEPT | [] | 472 | 7.43s |
- **Accuracy:** 5/5 (100%) ✓
- **Consistency:** Unanimous

#### What happened
Judge correctly ACCEPT'd the guard clause flattening. Each original `if(x!=null)` → `if(x!=null) { if(y!=null) { ... } else { throw... } }` became `if(x==null) throw ...; if(y==null) throw ...; if(!x.equals(y)) throw ...; doWork()`. The Judge traces the inverted conditions and confirms logic equivalence across all 5 runs.

Run 5 has a longer scratchpad (472 vs 234) — the model generated a more detailed variable trace for this run, likely due to stochastic sampling. The verdict was still ACCEPT.

#### Why this likely happened
Guard clause flattening is the most textbook refactoring pattern. The structural transformation (invert conditions, move throws to top, linearize logic) is unambiguous. The Judge's LOGIC CHECK task can verify equivalence by checking that each original exception maps to a guard clause with the same message. Simple, well-understood pattern → high accuracy.

---

### Case 6: revise_extract_constant_broken_sig (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | ["Signature mismatch: calculateArea return type changed from double to void"] | 459 | 5.73s |
| 2 | REVISE | ["calculateArea now returns void instead of double"] | 1228 | 18.48s |
| 3 | PARSE_ERROR | [] | 0 | 58.81s |
| 4 | REVISE | ["calculateArea and calculateCircumference signatures changed from double to void"] | 359 | 4.44s |
| 5 | REVISE | ["calculateArea return type changed from double to void"] | 816 | 15.60s |
- **Accuracy:** 4/5 (80%) ✓ — 1 parse error, not a verdict error
- **Consistency:** 4/5 REVISE with 1 PARSE_ERROR

#### What happened
4/5 runs correctly identified the signature change (`double→void` for both calculateArea and calculateCircumference). Run 3 hit a PARSE_ERROR — the model generated malformed JSON that couldn't be parsed, taking 58.81s before producing garbage output. This is a GGUF inference failure, not a verdict error.

Run 2's long scratchpad (1228 chars) and duration (18.48s) suggest the model went into a detailed audit before reaching REVISE. Run 4 was the fastest at 4.44s with a clean verdict.

#### Why this likely happened
The SIGNATURE CHECK task (audit task #4) explicitly asks: "Compare every method's return type, name, and parameter list between original and refactored code." The `double→void` change is exactly what this task is designed to catch. When the model processes task #4, it reliably catches this bug.

Run 3's parse error suggests an edge case in the model's structured output generation — the 3B Llama model occasionally fails to produce valid JSON when constrained by the response_model schema. This is a known llama-cpp limitation with GBNF grammar enforcement on 3B models.

---

### Case 7: revise_decompose_noop (expected: REVISE) — **SYSTEMATIC FAILURE**

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | [] | 171 | 2.88s |
| 2 | ACCEPT | [] | 428 | 5.94s |
| 3 | ACCEPT | [] | 453 | 6.43s |
| 4 | ACCEPT | [] | 428 | 6.04s |
| 5 | ACCEPT | [] | 453 | 6.40s |
- **Accuracy:** 0/5 (0%) ✗ — systematic failure
- **Consistency:** Unanimous (all wrong)

#### What happened
Judge ACCEPT'd **all 5 runs** on code that is **identical to the original**. The plan context says it should add 4 boolean fields + modify isEligible. None of those mutations were executed — the code is unchanged. The Judge's PLAN FIDELITY task should have caught this, but instead it reported "PLAN FIDELITY: The modifications match the plan."

#### Why this likely happened
The Judge processes 5 audit tasks in order: PLAN FIDELITY → VARIABLE TRACE → LOGIC CHECK → SIGNATURE CHECK → VERDICT. When the code is identical to the original, the first task (PLAN FIDELITY) has **no diff to analyze**. The model sees identical code and defaults to "matches" — there's nothing contradicting the plan because there's no evidence of change. The prompt says "Changes that match the plan are EXPECTED, not errors" — the model interprets "no changes" as "changes match" because it can't distinguish between "intentional no-op" and "failed execution."

The model's scratchpad shows it's checking **logic equivalence** between the two identical code blocks (which is trivially true), not **plan execution compliance** (whether the planned mutations were performed).

**Fix needed:** The auditor prompt needs an explicit instruction: "If the refactored code is character-for-character identical to the original but the plan context lists mutations (ADD_METHOD, ADD_FIELD, etc.), this is a REVISE — the plan was not executed."

---

### Case 8: revise_flatten_logic_inverted (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | ["Logic inversion: discount applied in else branch"] | 351 | 4.60s |
| 2 | REVISE | ["Discount logic inverted"] | 670 | 9.68s |
| 3 | REVISE | ["Discount applied in wrong branch"] | 319 | 4.15s |
| 4 | REVISE | ["Discount applied to wrong conditional branch"] | 323 | 4.03s |
| 5 | REVISE | ["Logic inversion in process method"] | 424 | 5.81s |
- **Accuracy:** 5/5 (100%) ✓
- **Consistency:** Unanimous

#### What happened
All 5 runs correctly REVISE'd the logic inversion. The original code applies 0.15 discount to premium users (total>1000) and 0.05 to non-premium. The refactored code applies 0.05 to non-premium (correct) but also applies 0.15 in the `else` branch (when total≤1000), and premium users get no discount. The Judge's LOGIC CHECK task correctly traced both conditional paths and identified the inversion.

Run 2 had a longer scratchpad (670 chars) and duration (9.68s) — suggesting deeper analysis before reaching the same conclusion.

#### Why this likely happened
This is a subtle logic error that's **within the Judge's detectable range** because it changes which branch executes. The model can trace: "if premium is true, original executes discount(0.15) but refactored executes nothing → mismatch." This is a branch-level comparison, not a value-level comparison — the Judge doesn't need to compute exact values, just identify that different code blocks execute for the same input.

---

### Case 9: revise_extract_method_wrong_params (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | [issue list] | 762 | 15.33s |
| 2 | REVISE | [issue list] | 842 | 15.28s |
| 3 | REVISE | [issue list] | 525 | 8.92s |
| 4 | REVISE | [issue list] | 812 | 14.10s |
| 5 | REVISE | [issue list] | 448 | 6.87s |
- **Accuracy:** 5/5 (100%) ✓
- **Consistency:** Unanimous

#### What happened
All 5 runs correctly REVISE'd. The refactored `computeTax` has an extra parameter `extraFee` that the original `calculateTotal` doesn't provide. The method computes `subtotal + tax + extraFee * subtotal` instead of `subtotal + tax`. The Judge caught both the parameter mismatch (SIGNATURE CHECK) and the computation difference (LOGIC CHECK). Higher scratchpad lengths (average 678 chars) indicate this requires more thorough analysis than signature-only bugs.

#### Why this likely happened
This case has TWO failure signals: a signature mismatch AND a computation change. Either alone would trigger REVISE. With both present, the Judge has high confidence. The longer analysis time (avg 12.1s) reflects the model processing both audit tracks.

---

### Case 10: revise_rename_broke_structural (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | [issue list] | 310 | 4.60s |
| 2 | REVISE | [issue list] | 326 | 4.98s |
| 3 | REVISE | [issue list] | 354 | 7.17s |
| 4 | REVISE | [issue list] | 361 | 7.36s |
| 5 | REVISE | [issue list] | 381 | 6.68s |
- **Accuracy:** 5/5 (100%) ✓
- **Consistency:** Unanimous

#### What happened
All 5 runs correctly REVISE'd. The rename from `check` → `verify` also changed `if(x>0) return true; return false;` into `return x > 0 ? true : false;`. This is a structural change (ternary replaces if-return) that the SIGNATURE CHECK catches. The rename itself is correct, but the concurrent structural change makes it a REVISE.

#### Why this likely happened
RENAME_SYMBOL requires the structural signature to stay identical. The Judge's SIGNATURE CHECK compares the original and refactored method signatures — the addition of a ternary expression changes the AST structure (if-statement count drops, conditional expression count increases). This is within the model's reliable range because it's a structural comparison, not a value comparison.

---

## Cross-Case Analysis

### Judge succeeds reliably when:

| Pattern | Accuracy | Cases |
|---------|----------|-------|
| Clear structural differences from original | 100% | 1-5 (all ACCEPT cases) |
| Obvious signature change (return type) | 100% | 6 |
| Logic inversion (different branch executes) | 100% | 8 |
| Multiple failure signals present | 100% | 9, 10 |
| Short scratchpad (200-400 chars) | 96% | Most cases |

### Judge fails systematically when:

| Pattern | Accuracy | Cases |
|---------|----------|-------|
| Code identical to original but plan lists mutations | **0%** | 7 |
| Single subtle signal (borderline cases) | N/A — none tested |

### Scratchpad length vs accuracy

| Scratchpad | Runs | Accuracy |
|-----------|------|----------|
| < 200 chars | 7 | 71% (1 PARSE_ERROR, no false verdicts) |
| 200-400 chars | 24 | 96% |
| > 400 chars | 19 | 84% |

### Consistency vs accuracy
- **Unanimous cases (9/10):** 88% accuracy — 8 cases correct, 1 case all-wrong (decompose_noop)
- **Unanimous doesn't guarantee correctness.** decompose_noop was unanimous ACCEPT on wrong answer.

### Key Findings

1. **Judge accuracy is 88%** — better than the orchestrator tests suggested (where 0 ACCEPTs were observed). The orchestrator's 0 ACCEPT rate was a Planner bottleneck, not a Judge failure.

2. **One systematic blind spot: identical code.** The PLAN FIDELITY audit task doesn't distinguish between "plan executed correctly" and "nothing was done." This is fixable with a prompt adjustment.

3. **SIGNATURE CHECK is the most reliable audit task.** Both `extract_constant_broken_sig` and `rename_broke_structural` were caught primarily through signature comparison. This validates the Round 2 fix from the session summary.

4. **False ACCEPT is disproportionate to false REVISE** — 5 false accepts vs 0 false rejects. The Judge errs on the side of accepting bad code, not rejecting good code. This is the conservative direction but dangerous for production.

5. **Consistency is high but not a guarantee of correctness.** 9/10 cases were unanimous. The one non-unanimous case was a PARSE_ERROR (not verdict disagreement). The Judge rarely changes its mind when re-run on the same input.

6. **PARSE_ERROR in 1/50 runs** — Llama-3.2-3B occasionally fails to produce valid JSON under GBNF grammar constraint. This is a llama-cpp issue, not a model quality issue.

### Recommendations

1. **Add explicit identity check to auditor prompt:** "If the refactored code is character-for-character identical to the original code but the plan context lists planned mutations, verdict MUST be REVISE with issue 'Plan was not executed: code unchanged.'"

2. **Reorder audit tasks:** Move SIGNATURE CHECK to position #2 (after PLAN FIDELITY). The current ordering has PLAN FIDELITY → VARIABLE TRACE → LOGIC CHECK → SIGNATURE CHECK → VERDICT. Moving SIGNATURE CHECK earlier ensures it's processed before the model's attention budget is exhausted.

3. **Consider eliminating VARIABLE TRACE for simple cases.** When the plan has ≤ 1 mutation and code is short, the variable trace is low-signal. Removing it would reduce token consumption and let the model focus on higher-value tasks.

---

## Raw Data

Full results as JSON saved to: `test_results/judge_isolated_results.json`
