# Planner Isolated Reasoning Report

**Date:** 2026-05-28T15:06
**Model:** Qwen2.5-Coder-3B-Instruct  
**Cases:** 15 code+instruction pairs  
**Calls:** 45 (3 model calls per case: classifier → analysis → synthesis)  

---

## Summary

| Metric | Result |
|--------|--------|
| Total cases | 15 |
| Classifier accuracy (intent matches expected) | 11/15 (73%) |
| Scope anchor validity (member+class exist in AST) | 6/15 (40%) |
| Analysis completeness (targets+preserve captured) | 15/15 (100%) |
| Plan executability (mutations reference real targets) | 6/15 (40%) |
| Hallucination rate (invented names in plan) | 17 across 15 cases |
| Analysis→Plan coherence | 11/15 (73%) |

---

## By Intent

| Intent | Cases | Class Acc | Scope | Analysis | Plan | Hallucinations |
|--------|-------|-----------|-------|----------|------|----------------|
| FLATTEN_CONDITIONAL | 3 | 3/3 (100%) | 1/3 | 3/3 | 3/3 | 4 |
| EXTRACT_METHOD | 3 | 3/3 (100%) | 2/3 | 3/3 | 0/3 | 8 |
| RENAME_SYMBOL | 2 | 2/2 (100%) | 1/2 | 2/2 | 2/2 | 1 |
| EXTRACT_CONSTANT | 2 | 2/2 (100%) | 1/2 | 2/2 | 0/2 | 3 |
| DECOMPOSE_CONDITIONAL | 2 | **0/2 (0%)** | 0/2 | 2/2 | 0/2 | 0 |
| SPLIT_LOOP | 2 | **0/2 (0%)** | 0/2 | 2/2 | 0/2 | 1 |
| CONSOLIDATE_CONDITIONAL | 1 | 1/1 (100%) | 1/1 | 1/1 | 1/1 | 0 |

---

## Detailed Results

### Case 1: flat_demo_orderprocessor (FAIL)

- **Input:** code (1168 chars) + "Refactor processOrder to use guard clauses..."
- **Expected intent:** FLATTEN_CONDITIONAL
- **Classifier output:** FLATTEN_CONDITIONAL ✓
- **Scope anchor:** OrderProcessor.processOrder, METHOD_UNIT ✓
- **Analysis targets:** ['processOrder'] ✓
- **Analysis must_preserve:** ['Exception: IllegalArgumentException', "String: 'User cannot be null.'"] ✓
- **Plan mutations:** 1 mutation ✓
- **Hallucinations:** INVALID_ORDER_MESSAGE, guardClauseHelper — analysis hallucinated new structures
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 17.1s
- **Verdict:** FAIL

#### What happened
Classifier correctly identified FLATTEN_CONDITIONAL with correct scope anchor. Analysis correctly identified the target method and key exception types. But the architect_analysis hallucinated two new structures (`guardClauseHelper`, `INVALID_ORDER_MESSAGE`) that the instruction never asked for. The plan was executable (single MODIFY_METHOD on processOrder) but the hallucinated analysis items counted as failures. The model inserted extra "new_structures_needed" from memory of common refactoring patterns rather than from the instruction.

#### Why this likely happened
Long code (1168 chars, ~150 tokens) pushes the prompt toward the 6144-token context limit when combined with the system prompt. The architect_analysis prompt has no explicit rule saying "Do not invent new structures unless the instruction explicitly requests them." The 3B model fills gaps with pattern-matched defaults — `guardClauseHelper` is a common name in guard clause examples from training data.

#### Raw output
```json
{"classifier": "...FLATTEN_CONDITIONAL, scope_anchor: OrderProcessor.processOrder...",
 "analysis": { "primary_targets": ["processOrder"], "new_structures_needed": ["guardClauseHelper", "INVALID_ORDER_MESSAGE"], "must_preserve": ["Exception: IllegalArgumentException", "String: 'User cannot be null.'"] },
 "synthesis": { "target_class": "OrderProcessor", "ast_mutations": [{ "action": "MODIFY_METHOD", "target": "processOrder", "details": { ... } }] }}
```


### Case 4: extract_set_zeroes (FAIL)

- **Input:** code (641 chars) + "Extract three private methods from setZeroes..."
- **Expected intent:** EXTRACT_METHOD ✓
- **Classifier output:** EXTRACT_METHOD ✓
- **Scope anchor:** `Solution.setZeroes` — scope_valid=FALSE: "Solution" class doesn't exist in code ✗
- **Plan mutations:** 14 mutations (massive over-generation) ✗
- **Hallucinations:** 7 invented names
- **Duration:** 67.8s
- **Verdict:** FAIL

#### What happened
Classifier correctly identified EXTRACT_METHOD for setZeroes. Scope anchor said `Solution.setZeroes` — the model invented class name "Solution" (code has no class). This is a CLASSIFICATION error: the code has no class wrapper, and the model defaults to "Solution" from LeetCode pattern training.

Analysis was correct (target=setZeroes). But the synthesis step produced **14 mutations** instead of the expected 2 (1 ADD_METHOD + 1 MODIFY_METHOD). The architect generated mutations for every individual step inside the loops — unpacking the loops into individual mutations. This ballooned the plan and introduced hallucinated method names. The synthesizer confused "extract the loops into methods" with "describe every operation in the loops."

This is the longest-duration case at 67.8s — the model took extended time to generate the over-detailed plan.

#### Why this likely happened
The instruction says "extract three private methods" but the code has 3 distinct logic blocks (mark, zero, final). The 3B model's architect_analysis captured only setZeroes as the primary target, losing the secondary targets of the three internal blocks. Without proper decomposition in the analysis step, the synthesis step over-compensated by listing every individual detail.

The class name hallucination (`Solution`) is a LeetCode pattern bleed — most java_polish_full.json problems wrap code in `class Solution` but the test data intentionally removed it. The model infers the missing class from training distribution.

---

### Case 11: decomp_closed_island (FAIL)

- **Input:** code (770 chars) + "Decompose the complex DFS boundary condition..."
- **Expected intent:** DECOMPOSE_CONDITIONAL
- **Classifier output:** **EXTRACT_METHOD** ✗
- **Scope anchor:** invalid — wrong intent, wrong target
- **Duration:** 36.3s
- **Verdict:** FAIL

#### What happened
Classifier misclassified DECOMPOSE_CONDITIONAL as EXTRACT_METHOD. The instruction says "Decompose... into well-named booleans: isInBounds, isOnBorder, and isUnvisited." The word pattern "extract into named" triggered the model's METHOD_MOVEMENT association despite the instruction explicitly saying "Decompose." Once the intent is wrong, the rest of the pipeline cascades: analysis looks for method-level targets, plan generates ADD_METHOD mutations, everything fails.

This happened identically for decomp_regex_dp, split_board_path, and split_unique_paths — ALL classified as EXTRACT_METHOD instead of their correct intents (DECOMPOSE_CONDITIONAL, SPLIT_LOOP, SPLIT_LOOP).

#### Why this likely happened
The classifier prompt (prompts.yaml planner.classifier) lists categories:
```
CONTROL_FLOW: FLATTEN_CONDITIONAL | DECOMPOSE_CONDITIONAL | ... | SPLIT_LOOP
METHOD_MOVEMENT: EXTRACT_METHOD | INLINE_METHOD
```

But the few-shot example only shows FLATTEN_CONDITIONAL. There is no example for DECOMPOSE or SPLIT. The model's strongest association for "extract/decompose/split" is with METHOD_MOVEMENT (extracting methods). Without a counter-example in the prompt, the 3B model cannot override this statistical prior.

Additionally, the classifier's CoT steps say "Read the instruction" then "Read the code" — but steps 3 and 4 don't include a rule distinguishing DECOMPOSE from EXTRACT. The model defaults to the more common intent.

**This is the single highest-impact fix: adding one DECOMPOSE_CONDITIONAL few-shot example and one SPLIT_LOOP few-shot example to the classifier prompt.**

---

### Case 10: const_circle_pi (FAIL)

- **Input:** code (221 chars) + "Extract the magic number 3.14159 into a named constant PI"
- **Expected intent:** EXTRACT_CONSTANT ✓
- **Classifier output:** EXTRACT_CONSTANT ✓
- **Scope anchor:** Circle.calculateArea — but target should be CLASS-LEVEL, not method-level ✗
- **Plan mutations:** 3 mutations, but `calculateCircumference` modification missing targets
- **Duration:** 22.0s
- **Verdict:** FAIL

#### What happened
Classifier classified EXTRACT_CONSTANT correctly. But the scope_anchor pointed to `calculateArea` (first method with 3.14159) instead of the `Circle` class. The constant should be a class-level static final field — the anchor should be CLASS_UNIT with Circle, not METHOD_UNIT with calculateArea.

Analysis correctly identified `calculateArea` as primary target but completely missed `calculateCircumference` — which also uses 3.14159. The analysis lists `["calculateArea"]` with no secondary targets. This means the plan only modifies one method, leaving the other method with the magic number unchanged.

#### Why this likely happened
The instruction mentions "magic number 3.14159" and the model found the first occurrence in `calculateArea` (listed first in the class). It stopped there — a `grep`-style match rather than a cross-reference. The 3B model's attention mechanism anchors on the first match and doesn't scan for all occurrences. The architect_analysis prompt says "Identify targets" but doesn't instruct the model to scan ALL code for ALL occurrences of the target value.

---

## Cross-Case Analysis

### Planner succeeds reliably when:

| Condition | Success Rate |
|-----------|-------------|
| Intent is FLATTEN_CONDITIONAL or RENAME_SYMBOL | 3/3 classifier, 3/3 plan |
| Code has explicit class wrapper | 6/11 vs 0/4 without |
| Instruction uses the exact keyword from the classifier prompt | "flatten" → FLATTEN, "rename" → RENAME |
| Code is short (< 400 chars) | Better scope accuracy |

### Planner fails when:

| Condition | Failure Rate |
|-----------|-------------|
| Intent is DECOMPOSE or SPLIT (misclassified as EXTRACT_METHOD) | 4/4 all misclassified |
| Code has no class wrapper (invents "Solution", "DPTransition") | 4/4 failed scope |
| Instruction contains "extract" but intent is CONTROL_FLOW | Always → EXTRACT_METHOD |
| Multi-target constant/method extraction (misses secondary targets) | 2/2 missed |

### Key Findings

1. **Classifier is the point of failure** — When intent is correctly classified (11/15), plan executability is 6/11 (55%). When misclassified (4/15), plan is 0/4. The classifier must improve before any downstream improvement matters.

2. **DECOMPOSE_CONDITIONAL and SPLIT_LOOP are impossible** for the current classifier prompt. Both always map to EXTRACT_METHOD. This is a prompt engineering problem, not a model capability problem — adding few-shot examples would likely fix it.

3. **Architect hallucinates structures** when the instruction is open-ended. The `new_structures_needed` field should be empty unless the instruction explicitly asks for new structures, but the model fills it based on pattern memory.

4. **Scope anchor for classless code** defaults to "Solution" — clear LeetCode training data bleed. The model has never seen Java code without a class wrapper in its training distribution.

5. **Analysis misses cross-references** — `const_circle_pi` missed the second method. The model scans for first occurrence, not all occurrences.

### Recommendations

1. **Add DECOMPOSE_CONDITIONAL and SPLIT_LOOP few-shot examples to classifier prompt** — highest-impact single fix
2. **Add rule to architect_analysis: "List in new_structures_needed ONLY items the instruction explicitly requests"**
3. **Add rule to architect: "If code has no class declaration, use empty string for target_class"**
4. **Add scanning instruction to analysis: "Scan ALL code for ALL occurrences of the target pattern"**

---

## Raw Data

Full results as JSON saved to: `test_results/planner_isolated_results.json`
