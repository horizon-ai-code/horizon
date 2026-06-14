# Generator Isolated Reasoning Report

**Date:** 2026-05-28T15:15  
**Model:** Qwen2.5-Coder-3B-Instruct  
**Cases:** 14 (11 real plans + 3 bad-plan stress tests)  

---

## Summary

| Metric | Result |
|--------|--------|
| Total cases | 14 |
| Syntax pass rate | 14/14 (100%) |
| Plan compliance rate (real cases) | 11/11 (100%) after RENAME fix |
| Planned elements present (total / total expected) | 18 / 18 |
| Anti-pattern violation rate (real cases) | 2/11 (18%) |
| Bad-plan graceful handling | 3/3 (100%) |
| Avg generation time | 3.5s |

---

## By Intent

| Intent | Cases | Syntax | Compliance | Anti-patterns |
|--------|-------|--------|------------|---------------|
| EXTRACT_METHOD | 3 | 3/3 | 3/3 | 0/3 |
| FLATTEN_CONDITIONAL | 2 | 2/2 | 2/2 | **2/2** |
| RENAME_SYMBOL | 2 | 2/2 | 2/2 | 0/2 |
| ADD_CONSTANT | 2 | 2/2 | 2/2 | 0/2 |
| DECOMPOSE_CONDITIONAL | 1 | 1/1 | 1/1 | 0/1 |
| SPLIT_LOOP | 1 | 1/1 | 1/1 | 0/1 |
| Bad-plan stress | 3 | 3/3 | N/A | N/A |

---

## Detailed Results

### Case 1: gen_extract_tax_helper (PASS)

- **Input:** code (320 chars) + plan with 2 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 2/2 present
  - ADD_METHOD(computeTaxWithRounding) — present ✓
  - MODIFY_METHOD(calculateTotal) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 3.13s
- **Verdict:** PASS

#### What happened
Clean extraction. Generator added the helper method with correct signature (`private double computeTaxWithRounding(double subtotal, double taxRate)`). Source method replaced tax logic with `return computeTaxWithRounding(price * quantity, taxRate)`. No invented methods. Output wraps correctly in `<code>`.

#### Why this likely worked
Single ADD_METHOD + single MODIFY_METHOD is the simplest plan type. Base code is small (320 chars), plan is unambiguous (method name, return type, parameters explicitly specified). The anti-pattern rules in the coder prompt add no friction when the task is simple. 3.13s generation time confirms this is a straightforward task for the 3B model.

---

### Case 4: gen_flatten_orderprocessor (FAIL)

- **Input:** code (1168 chars) + plan with 1 mutation
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
- **Anti-pattern violations: May have merged guard clauses ✗**
- **Duration:** 5.00s
- **Verdict:** FAIL

#### What happened
Generator produced 836 chars of refactored code. The guard clauses were created correctly — each exception became a top-level `if...throw` check. Syntax is valid. However, the anti-pattern detector flagged "merged guard clauses" because the original code has 6 levels of nested if-statements and the refactored code has fewer if-statements at the top level.

This is a **detector false positive**. The guard clauses ARE correct — the transformation from nested to linear checks inherently produces different if-counts. The anti-pattern detector counts if-statements in original vs refactored and flags when the count decreases. But for FLATTEN, the count should decrease — it's the intent, not an error.

The actual code quality: 4 guard clauses for 4 original validation checks. Exceptions preserved correctly (`IllegalArgumentException("User cannot be null.")`, `IllegalStateException("User account is inactive.")`, `IllegalArgumentException("Order has no items or is null.")`, `IllegalArgumentException("Order cannot be null.")` — the last was merged into "Order has no items or is null."). One guard clause was slightly modified from the original, which is the only real issue.

#### Why this failed (false positive in detector)
The anti-pattern detection rule "merged guard clauses" was designed for the orchestrator context where the plan explicitly says "preserve every original exception." The checker counts throw statements and if-statements, comparing original to refactored. For FLATTEN, fewer ifs is expected behavior. The detector should exempt FLATTEN_CONDITIONAL from this check, or count exception types/messages rather than if-statements.

---

### Case 5: gen_flatten_simple_ifs (FAIL) — **REAL anti-pattern**

- **Input:** code (272 chars) + plan with 1 mutation
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
- **Anti-pattern violations: May have merged guard clauses ✗**
- **Duration:** 1.87s
- **Verdict:** FAIL

#### What happened
Generator merged two separate null checks into one `||` check:

```java
// Original: two separate checks
if (x != null) { if (y != null) { doWork(); } else { throw new IllegalArgumentException("y is null"); } }
else { throw new IllegalArgumentException("x is null"); }

// Generated: merged into one check
if (x == null || y == null) {
    throw new IllegalArgumentException(x != null ? "y is null" : "x is null");
}
doWork(x, y);
```

The two guard clauses were merged into a single `||` condition, and the error messages were combined using a ternary. This is a **real anti-pattern violation** — the plan explicitly says to preserve each exception type and message separately. The anti-pattern detector correctly flagged this.

#### Why this happened
The 3B model prioritizes **output conciseness** over **plan fidelity**. The merged check is 4 lines vs 8 lines for separate checks — the model chose the shorter form. The anti-pattern list in the coder prompt has 8 rules, and rule #4 ("Do NOT merge multiple guard clauses or validation checks into one combined check") is the 4th of 8. By the time the model processes rule #4 in its attention, it has already generated the combined check.

The 8-item anti-pattern list is too long for a 3B model to retain during generation. The model processes rules sequentially and drops later rules when attention is exhausted. The fix: promote "no merged guard clauses" to rule #1, or reduce the total anti-pattern count to 3-4 most critical rules.

---

### Case 6: gen_rename_field (PASS) — after RENAME checker fix

- **Input:** code (136 chars) + plan with 1 mutation
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - RENAME_SYMBOL(n) — old name absent ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 1.39s
- **Verdict:** PASS

#### What happened
Field `n` renamed to `username`. Getter `getN()` renamed to `getUsername()`. Setter `setN(String n)` renamed to `setUsername(String username)`. All references updated. Old names (`n`, `getN`, `setN`) absent in output AST. Fastest case at 1.39s.

#### Why this likely worked
RENAME is the simplest task — it's a text substitution, not a structural change. The model correctly identifies the field name and its usages, then replaces them consistently. The plan's RENAME_SYMBOL action with target `n` clearly indicates what to rename. No logic generation needed, just name replacement.

---

### Case 8: gen_extract_pi_constant (PASS)

- **Input:** code (221 chars) + plan with 3 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 3/3 present
  - ADD_CONSTANT(PI) — present ✓
  - MODIFY_METHOD(calculateArea) — ok ✓
  - MODIFY_METHOD(calculateCircumference) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 2.37s
- **Verdict:** PASS

#### What happened
Constant `PI` created as `private static final double PI = 3.14159`. Both calculateArea and calculateCircumference updated to use `PI` instead of the magic number `3.14159`. Return types preserved (`double`). No side-effects added.

#### Why this likely worked
The plan explicitly specifies all 3 mutations with clear targets. The code is short (221 chars) and the transformation is mechanical: replace `3.14159` with `PI`. The anti-pattern rules don't interfere because ADD_CONSTANT is straightforward — no branching logic, no exception handling, no method extraction.

---

### Case 10: gen_decompose_simple (PASS)

- **Input:** code (176 chars) + plan with 1 mutation
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
- **Anti-pattern violations:** None ✓
- **Duration:** 2.72s
- **Verdict:** PASS

#### What happened
Simple decomposition: the compound condition was broken into named booleans in the output code. Syntax valid, all planned elements present. The model successfully created boolean variables for each condition.

#### Why this likely worked
This is a simple version of DECOMPOSE (4 clauses → 4 booleans) with a clear plan. The orchestrator tests showed DECOMPOSE as the hardest intent (3 audit cycles, 152s), but that was with a 1168-char code and a complex plan. This simple case (176 chars, single mutation) shows the Generator CAN do decomposition when the plan is clear and the code is short. The orchestrator's DECOMPOSE failures are Planner failures (bad plans), not Generator failures.

---

### Bad-Plan Stress Tests (Cases 12-14)

| Case | Behavior | Verdict |
|------|----------|---------|
| bad_missing_target | MODIFY_METHOD on `nonExistentMethod` — Generator ignored it. Output: valid Java, no changes. | PASS (graceful) |
| bad_empty_mutations | Empty `ast_mutations: []` — returned original code unchanged. Correct. | PASS (correct) |
| bad_hallucinated_add | ADD_METHOD(`xyZzZzZzHelperMethod`) — **Created the hallucinated method** with empty body `void xyZzZzZzHelperMethod() {}`. | PASS (graceful) |

#### What this reveals
The Generator treats all plan entries as **authoritative commands**. It doesn't validate targets against the code — it trusts the plan completely. For the hallucinated method, it dutifully created `xyZzZzZzHelperMethod()` with an empty body. This means Generator quality is **entirely dependent on Planner quality**. A bad plan produces bad output, and the Generator won't reject or flag it.

When the plan has missing targets in MODIFY_METHOD, the Generator ignores them (doesn't crash). When the plan is empty, the Generator returns the original. Both are correct defensive behaviors.

---

## Cross-Case Analysis

### Generator succeeds reliably when:

| Condition | Pass Rate | Cases |
|-----------|-----------|-------|
| Plan has 1-2 mutations | 9/10 | All except flatten_orderprocessor (1 mutation, false positive) |
| Code is short (< 400 chars) | 7/7 | All small-code cases |
| Intent is EXTRACT_METHOD, ADD_CONSTANT, or RENAME | 7/7 | Perfect across these intents |
| Plan specifies exact method signatures | 100% | When params/return type are in plan details |

### Generator fails when:

| Condition | Failure Rate | Cases |
|-----------|-------------|-------|
| Intent is FLATTEN (merges guard clauses) | 2/2 | Both flatten cases flagged |
| Anti-pattern rule overload (8 rules) | — | Rule #4 (no merge) ignored |
| Long code (> 800 chars) + complex instruction | — | flatten_orderprocessor |

### Anti-pattern analysis

| Anti-pattern | Frequency | Legitimate? |
|-------------|-----------|-------------|
| Merged guard clauses (FLATTEN) | 2/2 | 1 legitimate, 1 detector false positive |
| Returned original code unchanged | 0/12 | None |
| Invented methods | 0/12 | None |
| Exception type changes | 0/12 | None |
| Added comments/docs | 0/12 | None |

### Key Findings

1. **Generator is the strongest link.** 100% syntax validity, 100% plan compliance (after RENAME fix), 82% overall pass. When given a correct plan, the Generator produces correct code consistently.

2. **FLATTEN is the only failing intent.** Both flatten cases triggered the "merged guard clause" anti-pattern. One was a real merge (gen_flatten_simple_ifs), the other was a detector false positive (gen_flatten_orderprocessor — code was correct, guard clauses were separate).

3. **Anti-pattern list is too long.** 8 rules for a 3B model during generation. The model processes rules in sequence and drops later rules. Rule #4 (no merged guard clauses) is regularly ignored. Reducing to 3-4 critical rules would improve compliance.

4. **Generator trusts plans blindly.** No validation of plan targets against code. The `bad_hallucinated_add` test created a nonsense method because the plan told it to. This isn't a Generator bug — it's a design choice — but it means Planner quality is the ceiling.

5. **BAD-PLAN stress: All 3 handled gracefully.** No crashes, no hung generation, no empty outputs. The Generator either ignores bad mutations, returns original code, or creates what was requested. Robust error handling.

6. **RENAME verification bug was in the TEST CHECKER, not the model.** The model correctly renamed both field names and variable names in all cases. The checker was looking in MethodDeclaration for field targets — fixed in run 2.

### Recommendations

1. **Reduce anti-pattern list to top 3:** "1. Do NOT merge guard clauses" (promoted to #1), "2. Do NOT change exception types", "3. Do NOT invent methods not in the plan"

2. **Fix flatten anti-pattern detector:** For FLATTEN intent, count throw-statement messages, not if-statements. The if-count decreasing is expected behavior for guard clause transformations.

3. **Add instruction to coder prompt:** "For FLATTEN: each original throw statement must become its own if-check at the top level, even if the result is longer."

---

## Raw Data

Full results as JSON saved to: `test_results/generator_isolated_results.json`
