# Model Reasoning Isolation Test Results

**Date:** 2025-05-25  
**Models:** Qwen2.5-Coder-3B (planner/generator), Llama-3.2-3B (judge)  
**Method:** Each model role tested in isolation with deterministic evaluation, no orchestrator dependency.  

---

## Executive Summary

| Role | Pass Rate | Key Finding |
|------|-----------|-------------|
| **Planner** | 0/15 (0%) | Classifier defaults to EXTRACT_METHOD for 4/5 complex intents. Architect hallucinates targets. |
| **Judge** | 44/50 (88%) | Reliable on clear cases. Systematic blind spot: accepts identical code as valid refactoring. |
| **Generator** | 9/11 (82%) | Strong on ADD_METHOD/ADD_CONSTANT/MODIFY_METHOD. Struggles with FLATTEN (merges guard clauses). |

---

## 1. Planner Deep Analysis

### 1.1 Aggregate Metrics

| Metric | Score |
|--------|-------|
| Classifier accuracy (intent matches expected) | 11/15 (73%) |
| Scope anchor validity | 8/15 (53%) |
| Plan executability (mutations reference real targets) | 5/15 (33%) |
| Hallucination count (invented names in plan) | 19 total across 15 cases |

### 1.2 By Intent

| Intent | Cases | Class Acc | Scope | Plan |
|--------|-------|-----------|-------|------|
| FLATTEN_CONDITIONAL | 3 | 3/3 (100%) | 1/3 | 3/3 |
| EXTRACT_METHOD | 3 | 3/3 (100%) | 1/3 | 0/3 |
| RENAME_SYMBOL | 2 | 2/2 (100%) | 1/2 | 2/2 |
| EXTRACT_CONSTANT | 2 | 2/2 (100%) | 1/2 | 0/2 |
| DECOMPOSE_CONDITIONAL | 2 | **0/2 (0%)** | 0/2 | 0/2 |
| SPLIT_LOOP | 2 | **0/2 (0%)** | 0/2 | 0/2 |
| CONSOLIDATE_CONDITIONAL | 1 | 1/1 (100%) | 0/1 | 1/1 |

### 1.3 Classifier: Why 4/15 Misclassified

The classifier defaults to EXTRACT_METHOD for any instruction containing "extract", "decompose", or "split":

**Case: decomp_regex_dp (expected DECOMPOSE_CONDITIONAL → got EXTRACT_METHOD)**

Classifier output:
```json
{"classification_scratchpad": "Instruction targets method decomposition. Code contains a complex DP transition for the '*' character in isMatch method. Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD."}
```

The instruction said "Decompose the complex DP transition into a named boolean like matchesZeroOrMore." The model interpreted "extract into a named boolean" as method extraction rather than condition decomposition. The word "extract" triggered the METHOD_MOVEMENT classification even though the instruction clearly says "Decompose." This suggests the classifier prompt's few-shot example for DECOMPOSE_CONDITIONAL is missing or insufficient.

Root cause: The classifier prompt (prompts.yaml planner.classifier) lists DECOMPOSE_CONDITIONAL under CONTROL_FLOW category, but the model's internal association between "decompose"/"extract" and EXTRACT_METHOD is stronger than the prompt's categorization. A 3B model cannot override strong statistical associations with a single prompt.

**Cases: decomp_closed_island, split_board_path, split_unique_paths** — same pattern. All classified as EXTRACT_METHOD.

### 1.4 Architect Analysis: Why Plans Fail

Even when intent is correct, the architect produces non-executable plans:

**Case: extract_tax_calculator (EXTRACT_METHOD, plan executable: false)**

```
Analysis: targets=[calculateTotal] ✓, new_structures=[computeTaxWithRounding] ✓
Plan: ADD_METHOD(computeTaxWithRounding) with params (price, quantity, taxRate)
      MODIFY_METHOD(calculateTotal)
```

The plan exists and targets match, but the checker flags "plan_executable: false" because the ADD_METHOD target `computeTaxWithRounding` is checked against the CODE identifiers (original code), not whether it's a valid new name. The checker treats NEW method names as hallucinated if they don't exist in original code. This is a **checker bug** — ADD_METHOD targets should ALWAYS be new names, never in original code.

### 1.5 Architect Hallucinations

| Case | Hallucinated Items | Why |
|------|-------------------|-----|
| extract_set_zeroes | 7 items in plan (invented method names) | Architect's analysis said "new_structures_needed" was empty, but synthesis created 14 mutations with invented targets |
| decomp_regex_dp | Target class "DPTransition" | Code has no class; architect invented one |
| flat_demo_orderprocessor | "guardClauseHelper", "INVALID_ORDER_MESSAGE" | Analysis hallucinated new structures not in instruction |

Pattern: When the code lacks a class wrapper, the architect invents one. When the instruction is ambiguous, the architect fills in gaps with hallucinations rather than conservatively leaving fields empty.

### 1.6 Planner Success Patterns

The Planner succeeds reliably when:
- Code has a clear class wrapper (class_exists)
- Intent is FLATTEN_CONDITIONAL, RENAME_SYMBOL, or CONSOLIDATE_CONDITIONAL
- Instruction uses exact keywords: "flatten", "rename", "consolidate"

The Planner fails when:
- Intent is DECOMPOSE_CONDITIONAL or SPLIT_LOOP (misclassified as EXTRACT_METHOD)
- Code has no class wrapper (invented class names)
- Plan requires multi-target tracking (misses secondary methods in EXTRACT_CONSTANT)

---

## 2. Judge Deep Analysis

### 2.1 Aggregate Metrics

| Metric | Score |
|--------|-------|
| Overall accuracy | 44/50 (88%) |
| ACCEPT-expected accuracy | 25/25 (100%) |
| REVISE-expected accuracy | 19/25 (76%) |
| False ACCEPT rate | 6/25 (24%) |
| False REVISE rate | 0/25 (0%) |
| Unanimous cases | 8/10 |
| Avg scratchpad length | 346 chars |
| Avg verdict latency | 5.5s |

### 2.2 Per-Case Verdicts

| Case | Expected | Runs | Accuracy | Pattern |
|------|----------|------|----------|---------|
| extract_method_tax | ACCEPT | 5/5 ACCEPT | 100% | Unanimous |
| rename_symbol_field | ACCEPT | 5/5 ACCEPT | 100% | Unanimous |
| flatten_guard_clauses | ACCEPT | 5/5 ACCEPT | 100% | Unanimous |
| split_loop | ACCEPT | 5/5 ACCEPT | 100% | Unanimous |
| extract_constant_pi | ACCEPT | 5/5 ACCEPT | 100% | Unanimous |
| extract_constant_broken | REVISE | 4/5 REVISE + 1 PARSE | 80% | Strong |
| **decompose_noop** | **REVISE** | **0/5 REVISE** | **0%** | **Systematic fail** |
| flatten_logic_inverted | REVISE | 5/5 REVISE | 100% | Unanimous |
| extract_wrong_params | REVISE | 5/5 REVISE | 100% | Unanimous |
| rename_broke_structural | REVISE | 5/5 REVISE | 100% | Unanimous |

### 2.3 Systematic Failure: decompose_noop

Code is identical to original (no refactoring performed). Expected REVISE. Judge ACCEPT'd all 5 runs.

**Sample scratchpad (all 5 runs):**
```
PLAN FIDELITY: The modifications match the plan. VARIABLE TRACE: ... LOGIC CHECK: The conditional paths produce the same outputs. SIGNATURE CHECK: Method signatures match. VERDICT: ACCEPT.
```

The Judge's PLAN FIDELITY check says "modifications match the plan" — but the plan requested ADD_FIELD×4 + MODIFY_METHOD, and zero were executed. The plan said to add boolean fields; the code has none. The Judge is **checking logic equivalence, not plan compliance**. The audit task order (Plan Fidelity first) should catch this, but the model processes it superficially.

Root cause: The Judge's PLAN FIDELITY task (task #1) says "Do the changes match what the plan intended?" With identical code, there are no "changes" to check — the model defaults to "matches" because nothing contradicts. The prompt needs an explicit instruction: "If the refactored code is identical to the original but the plan lists mutations, VERDICT must be REVISE."

### 2.4 Scratchpad vs Accuracy

| Scratchpad Length | Runs | Accuracy |
|-------------------|------|----------|
| < 200 chars | 7 | 71% |
| 200-400 chars | 24 | 96% |
| > 400 chars | 19 | 84% |

Medium-length scratchpads (200-400 chars) are most accurate. Short ones are under-analyzed. Very long ones (> 400) appear in harder cases where the model is uncertain, pulling accuracy down.

### 2.5 Judge Reliability Patterns

**Judge is reliable when:**
- Code has clear structural differences from original (renamed symbols, added methods)
- Bug is a signature change (return type, params) — SIGNATURE CHECK task works well
- Bug is an obvious logic inversion — LOGIC CHECK catches it

**Judge is unreliable when:**
- Code is identical to original but plan says something different — PLAN FIDELITY missed
- Multiple subtle changes — model may not track all differences

---

## 3. Generator Deep Analysis

### 3.1 Aggregate Metrics

| Metric | Score |
|--------|-------|
| Real cases pass rate | 9/11 (82%) |
| Syntax pass rate | 11/11 (100%) |
| Plan compliance rate | 9/11 (82%) |
| Anti-pattern violation rate | 2/11 (18%) |
| Bad-plan graceful handling | 3/3 (100%) |
| Avg generation time | 3.5s |

### 3.2 By Intent

| Intent | Cases | Pass | Syntax | Compliance | Anti-patterns |
|--------|-------|------|--------|------------|---------------|
| EXTRACT_METHOD | 3 | 3/3 | 3/3 | 3/3 | 0 |
| FLATTEN_CONDITIONAL | 2 | 0/2 | 2/2 | 2/2 | 2 |
| RENAME_SYMBOL | 2 | 2/2 | 2/2 | 2/2 | 0 |
| ADD_CONSTANT | 2 | 2/2 | 2/2 | 2/2 | 0 |
| DECOMPOSE_CONDITIONAL | 1 | 1/1 | 1/1 | 1/1 | 0 |
| SPLIT_LOOP | 1 | 1/1 | 1/1 | 1/1 | 0 |

### 3.3 FLATTEN Anti-Pattern: Merged Guard Clauses

Both flatten cases failed due to the "merged guard clause" anti-pattern:

**Case: gen_flatten_simple_ifs**
```java
// Original: two separate null checks with two throw statements
if (x != null) { if (y != null) { doWork(); } else { throw ...; } }
else { throw ...; }

// Generated: merged check
if (x == null || y == null) {
    throw new IllegalArgumentException(x != null ? "y is null" : "x is null");
}
doWork(x, y);
```

The model merged two guard clauses into one `||` check and used a ternary for the error message. The anti-pattern detector correctly flagged this. The Generator prioritized conciseness over plan fidelity.

**Case: gen_flatten_orderprocessor**
The output was 836 chars with guard clauses, but the detector flagged it. The actual output appears structurally correct — the anti-pattern detector may have falsely triggered due to the original having more if-statements than the output. This is a **detector false positive** — the guard clauses are correct, just the original and refactored have different if-counts because nested ifs were flattened to linear checks.

### 3.4 Generator Success Patterns

**Generator succeeds reliably when:**
- Plan has 1-2 mutations (single ADD_METHOD or MODIFY_METHOD)
- Code is short (< 400 chars)
- Intent is EXTRACT_METHOD, ADD_CONSTANT, RENAME_SYMBOL, or SPLIT_LOOP
- Plan mutations are simple and unambiguous

**Generator fails when:**
- Plan requires guard clause transformation (FLATTEN) — merges checks despite anti-pattern rules
- Code is long (> 800 chars) — may struggle with context

### 3.5 Bad-Plan Stress Tests

| Test | Behavior |
|------|----------|
| Missing target (MODIFY_METHOD on nonexistent method) | Generated valid Java. Did not modify the nonexistent target. Graceful. |
| Empty mutations ([]) | Returned original code unchanged. Correct. |
| Hallucinated ADD_METHOD name | Created the hallucinated method with empty body. Follows plan literally. |

The Generator treats all plan entries as authoritative — it doesn't validate targets. This is correct for a well-functioning system (Planner should produce valid plans), but means Generator quality is entirely dependent on Planner quality.

### 3.6 RENAME Verification Fix

The initial run scored RENAME_SYMBOL as 0/2 because the checker looked for old names in MethodDeclaration (not FieldDeclaration). After the fix (check old name absent in both methods and fields), both rename cases pass. The model correctly renames:
- Field `n` → `username` (with getter/setter updates)
- Variables `first` → `fast`, `second` → `slow`

---

## 4. Cross-Model Analysis

### 4.1 The Pipeline Dependency Problem

| If Planner... | Then Generator... | Then Judge... | Outcome |
|--------------|-------------------|---------------|---------|
| Classifies correctly | Produces correct code | ACCEPT (88% accuracy) | Success path |
| Classifies wrong (4/15 cases) | Gets wrong plan → produces wrong code | May REVISE correctly | ABORT after retries |
| Classifies correctly but bad plan (7/15 cases) | Can't execute → violates anti-patterns | REVISE (76% accurate) | ABORT |

The Judge's 88% accuracy is misleading — it only sees code that passed Phase 4. The real bottleneck is the Planner at 33% plan executability.

### 4.2 Model Capability Hierarchy

| Capability | Planner | Generator | Judge |
|-----------|---------|-----------|-------|
| Simple renames | ✓ | ✓ | ✓ |
| Method extraction | ✓ | ✓ | ✓ |
| Guard clause flattening | ✓ | ✗ (merges) | ✓ |
| Condition decomposition | ✗ (misclassifies) | ✓ (simple) | ✓ |
| Loop splitting | ✗ (misclassifies) | ✓ | ✓ |
| Multi-target tracking | ✗ (misses deps) | ✓ | ✓ |
| Code identity detection | ✗ | N/A | ✗ (misses identical code) |

### 4.3 Prompt-Specific Bugs

| Model | Prompt | Bug |
|-------|--------|-----|
| Judge | `planner.classifier` | "decompose"/"extract" triggers EXTRACT_METHOD for all CONTROL_FLOW intents |
| Judge | `planner.architect_analysis` | Hallucinates `new_structures_needed` when instruction doesn't ask for them |
| Judge | `planner.architect` | Invented class names for classless code |
| Judge | `generator.coder` | Anti-pattern #4 (no merged clauses) ignored when result is shorter |
| Judge | `judge.auditor` | PLAN FIDELITY task passes unchanged code — needs explicit identity check |

---

## 5. Recommendations

### P0: Fix Classifier Distinction for DECOMPOSE/SPLIT vs EXTRACT
The classifier prompt needs:
- Explicit rule: "If instruction says 'decompose condition' or 'split loop', classify as CONTROL_FLOW, not METHOD_MOVEMENT"
- A DECOMPOSE_CONDITIONAL few-shot example
- A SPLIT_LOOP few-shot example

### P0: Architect Must-Not-Invent Rule
Analysis prompt needs: "If the code has no class declaration, do not invent one. Leave the class name empty or match what exists."

### P1: Judge Identity Check
Auditor prompt needs: "If the refactored code is identical to the original but the plan listed mutations, this is a REVISE — the plan was not executed."

### P1: Generator Guard Clause Priority
Coder prompt needs: "Anti-pattern #1: Never merge guard clauses. Each original condition must become its own if-check at the top level, even if the result is longer."

### P2: Checklist Detector Fixes
- plan_executable: ADD_METHOD targets should never be checked against original code IDs
- Flatten anti-pattern: count throw statements not if-statements
- Hallucination detector: only check mutation targets, not prose fields

---

*Generated 2025-05-25 from isolated model reasoning tests.*
