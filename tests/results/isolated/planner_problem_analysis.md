# Planner Model — Comprehensive Problem Analysis

**Date:** 2025-05-28  
**Model:** Qwen2.5-Coder-3B-Instruct (GGUF, 1.9GB, 36 layers, 6144-token context)  
**Tested:** 15 code+instruction pairs, 45 total model calls (3 per case)  
**Overall score:** 0/15 pass (0% plan executability, 40% after fixing test artifacts)  

---

## 1. What the Planner Does

The Planner is a 3-step pipeline that takes Java code and an English instruction and produces a structured modification plan:

```
Step 1: Classifier       →  intent_packet (what to do, where)
Step 2: Architect Analysis →  target list, preserve list, new structures needed
Step 3: Architect Synthesis →  ast_modification_plan (detailed mutations)
```

Each step is a separate model call. The output of each step feeds into the next.

**Success criteria** for a plan:
1. Intent matches what the instruction asks for
2. Scope anchor (class name, method name) points to real code elements
3. Plan mutations reference targets that exist in the code
4. No hallucinated (invented) class names, method names, or structures

---

## 2. How It Was Tested

15 code+instruction pairs drawn from `demo_scenario.txt` and `java_polish_full.json`. Coverage across 7 intent types:

| Intent | Cases | Difficulty range |
|--------|-------|-----------------|
| FLATTEN_CONDITIONAL | 3 | Medium to Hard |
| EXTRACT_METHOD | 3 | Easy to Medium |
| RENAME_SYMBOL | 2 | Easy |
| EXTRACT_CONSTANT | 2 | Easy |
| DECOMPOSE_CONDITIONAL | 2 | Medium to Hard |
| SPLIT_LOOP | 2 | Medium |
| CONSOLIDATE_CONDITIONAL | 1 | Medium |

Each case was run in isolation — no orchestrator, no feedback loops, no context from prior cases. Every model call started with a clean context. Temperature fixed at 0.1. Outputs evaluated with deterministic structural checks: javalang AST parsing, identifier extraction, and cross-reference validation.

---

## 3. Results by Step

### 3.1 Step 1 — Classifier: What worked, what broke

| Metric | Score |
|--------|-------|
| Correct intent classification | 11/15 (73%) |
| Scope anchor class exists in code | 6/15 (40%) |
| Scope anchor member exists in code | 14/15 (93%) |

#### Pattern A: Intent classification works for simple intents

For FLATTEN_CONDITIONAL, EXTRACT_METHOD, RENAME_SYMBOL, EXTRACT_CONSTANT, and CONSOLIDATE_CONDITIONAL, the classifier was 100% accurate. Examples:

**Case `flat_demo_orderprocessor` — Correct:**
```
Instruction: "Refactor processOrder to use guard clauses. Invert nested if-statements..."
Classifier: FLATTEN_CONDITIONAL ✓
Scope: OrderProcessor.processOrder, METHOD_UNIT ✓
```

**Case `rename_user_manager` — Correct:**
```
Instruction: "Rename the field 'n' to 'username' and update all references."
Classifier: RENAME_SYMBOL ✓
```

#### Pattern B: DECOMPOSE and SPLIT always misclassified as EXTRACT_METHOD

All 4 cases with DECOMPOSE_CONDITIONAL or SPLIT_LOOP intent were classified as EXTRACT_METHOD. Zero exceptions.

**Case `decomp_closed_island` — Misclassified:**
```
Instruction: "Decompose the complex DFS boundary condition into well-named booleans:
              isInBounds, isOnBorder, and isUnvisited."

Expected: DECOMPOSE_CONDITIONAL
Got:       EXTRACT_METHOD ✗
```

**Evidence — Raw classifier output:**
```json
{
  "classification_scratchpad": "Instruction targets method decomposition. Code contains DFS boundary condition... Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD."
}
```

**Case `decomp_regex_dp` — Misclassified:**
```
Instruction: "Decompose the complex DP transition for the '*' character into a named
              boolean like matchesZeroOrMore."

Expected: DECOMPOSE_CONDITIONAL
Got:       EXTRACT_METHOD ✗
```

**Evidence — Raw classifier output:**
```json
{
  "classification_scratchpad": "Instruction targets method decomposition. Code contains a complex DP transition for the '*' character in isMatch method. Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD."
}
```

**Case `split_board_path` — Misclassified:**
```
Instruction: "Split the per-character loop into two separate methods: one for vertical
              movement (U/D) and one for horizontal movement (L/R)."

Expected: SPLIT_LOOP
Got:      EXTRACT_METHOD ✗
```

**Case `split_unique_paths` — Misclassified:**
```
Instruction: "Split the DP initialization into separate methods: initFirstColumn and
              initFirstRow."

Expected: SPLIT_LOOP
Got:      EXTRACT_METHOD ✗
```

#### Why This Happens

The classifier prompt (`prompts.yaml planner.classifier`) lists both DECOMPOSE_CONDITIONAL and SPLIT_LOOP as CONTROL_FLOW intents, alongside FLATTEN_CONDITIONAL. However, the prompt only provides **one few-shot example**, and it's for FLATTEN_CONDITIONAL:

```
### EXAMPLE
Instruction: "Flatten the nested ifs in processOrder using guard clauses"
Code: public class A { void processOrder() { if(x) { if(y) { doWork(); } } } }
Output: { ... FLATTEN_CONDITIONAL ... }
```

There is **no example** for DECOMPOSE_CONDITIONAL or SPLIT_LOOP. The model has never been shown what these intents look like.

The model's reasoning chain (scratchpad) reveals the failure mechanism. For `decomp_closed_island`:

> "Instruction targets method decomposition. Code contains DFS boundary condition... Category is METHOD_MOVEMENT"

The model processes the word "extract"/"decompose" → associates it with METHOD_MOVEMENT (the category containing EXTRACT_METHOD) → outputs EXTRACT_METHOD. The classifier's CoT steps (Steps 1-4) don't include a rule to distinguish CONTROL_FLOW decomposition from METHOD_MOVEMENT extraction.

This is a **prompt engineering failure, not a model capability failure**. The 3B model can classify FLATTEN correctly when shown an example. It needs equivalent examples for the other CONTROL_FLOW intents.

---

### 3.2 Step 1 — Scope Anchor: Class Name Hallucination

40% of cases had invalid scope anchors — the classifier invented class names for code that has no class wrapper.

**Case `flat_binary_search` — Hallucinated class name:**
```
Code: public boolean search(int[] nums, int target) { ... }
      ^ no class declaration

Classifier scope_anchor: class="A", member="search"
                          ^^^^ invented — no class "A" exists in code
Scope valid: FALSE ✗
```

**Case `extract_set_zeroes` — Hallucinated class name:**
```
Code: public void setZeroes(int[][] matrix) { ... }
      ^ no class declaration

Classifier scope_anchor: class="Solution", member="setZeroes"
                          ^^^^^^^^^^ invented — typical LeetCode wrapper
Scope valid: FALSE ✗
```

**Case `extract_prime_arrange` — Hallucinated class name:**
```
Code: public int numPrimeArrangements(int n) { ... }
      ^ no class declaration

Classifier scope_anchor: class="PrimeArrangements", member="numPrimeArrangements"
                          ^^^^^^^^^^^^^^^^^^ invented — derived from method name
Scope valid: FALSE ✗
```

#### Why This Happens

The Qwen2.5-Coder-3B model was trained on code where Java methods always reside inside a class. The model's training distribution (GitHub, LeetCode, StackOverflow) never shows standalone method declarations as inputs. When presented with code that has no class wrapper, the model's statistical prior activates — it fills in the missing class from:

- **Training-pattern bleed:** LeetCode problems wrap code in `class Solution { ... }` — hence "Solution"
- **Method-name derivation:** `numPrimeArrangements` → "PrimeArrangements"
- **Context inference:** Binary search → typical wrapper class "A" or "Search"

The classifier prompt's scope_anchor field has `"class": "..."` with no fallback rule. The model must always produce a class name, even when the code has none. The prompt needs: "If the code has no class declaration, set 'class' to an empty string."

---

### 3.3 Step 2 — Architect Analysis: Hallucinated Structures

The analysis step correctly identifies primary targets (100% of cases had valid targets). However, it invents `new_structures_needed` and `must_preserve` items that the instruction never asked for.

**Case `flat_demo_orderprocessor` — Hallucinated new structures:**

Analysis output:
```json
{
  "primary_targets": ["processOrder"],          // ✓ correct
  "new_structures_needed": [
    "guardClauseHelper",                        // ✗ NOT in instruction
    "INVALID_ORDER_MESSAGE"                     // ✗ NOT in instruction
  ],
  "must_preserve": [
    "Exception: IllegalArgumentException",      // ✓ correct
    "String: 'User cannot be null.'"            // ✓ correct
  ]
}
```

The instruction says "preserve exception types and error messages" — it never says "create a helper method" or "create a constant INVALID_ORDER_MESSAGE." The analysis invented two structures that don't exist and weren't requested.

**Case `const_circle_pi` — Missed secondary target:**

Analysis output:
```json
{
  "primary_targets": ["calculateArea"],         // ✓ but incomplete
  "secondary_targets": [],                      // ✗ empty — missed calculateCircumference
  "new_structures_needed": ["PI"],              // ✓ correct
  "must_preserve": []                           // ✓ nothing to preserve
}
```

`calculateCircumference` also uses `3.14159` — it must also be modified. The analysis scanned for the first occurrence of the magic number (in `calculateArea`, listed first in the class) and stopped. It never checked for other occurrences.

#### Why This Happens

**Hallucinated new_structures:** The analysis prompt says "Identify new structures needed." It doesn't say "Only if the instruction explicitly requests them." The model sees FLATTEN + "use guard clauses" and pattern-matches: "guard clause patterns often include helper methods" → invents `guardClauseHelper`.

**Missed secondary targets:** The analysis prompt asks to identify targets but doesn't instruct the model to scan for ALL occurrences of the pattern. The model uses a first-match heuristic rather than exhaustive search. This is a 3B attention limitation — the model processes the code left-to-right and anchors on the first match.

---

### 3.4 Step 3 — Architect Synthesis: Plan Quality

| Metric | Score |
|--------|-------|
| Plan executable (all targets exist in code) | 6/15 (40%) |
| Average mutations per plan | 2.9 (range: 1-14) |
| Hallucinated target names | 17 across all cases |

#### Failure Mode A: Explosion of mutations

**Case `extract_set_zeroes` — 14 mutations instead of 2:**

The instruction asks to extract 3 methods. The synthesis plan should have ~3 mutations (ADD_METHOD + MODIFY_METHOD pairs). Instead it produced 14:

```
ast_mutations: [
  MODIFY_METHOD(setZeroes),   // 14 items — describing every operation inside loops
  ADD_METHOD(markZeroes),     // instead of 2-3 high-level mutations
  ADD_METHOD(applyZeroes),    // model unpacked loops into individual steps
  ... 11 more ...
]
```

The synthesis step lost the analysis context and generated low-level mutations describing loop internals rather than the high-level method extraction.

**Evidence — Raw synthesis output (truncated):**
```json
{
  "ast_mutations": [
    { "action": "MODIFY_METHOD", "target": "setZeroes", ... },
    { "action": "ADD_METHOD", "target": "markZeroes", ... },
    { "action": "ADD_METHOD", "target": "applyZeroes", ... },
    { "action": "ADD_METHOD", "target": "initializeFirstRow", ... },
    { "action": "ADD_METHOD", "target": "initializeFirstCol", ... },
    { "action": "ADD_METHOD", "target": "zeroFirstRow", ... },
    { "action": "ADD_METHOD", "target": "zeroFirstCol", ... },
    { "action": "ADD_METHOD", "target": "zeroInnerCells", ... },
    ...
  ]
}
```

#### Failure Mode B: Hallucinated class names in plan targets

**Case `decomp_regex_dp` — Invented class:**
```
Code:        public boolean isMatch(String s, String p) { ... }
             ^ no class declaration

Plan target_class: "DPTransition"  ← invented. "DP" from regex context, "Transition" from DP pattern
```

**Case `rename_remove_nth` — Modified but correct class:**
```
Code:     class ListNode { ... } public ListNode removeNthFromEnd(...) { ... }
Plan:     target_class: "Solution"  ← invented. Actual class is "ListNode"
```

The plan references a class that doesn't exist, making all mutations within it non-executable.

#### Failure Mode C: Plan ignores analysis

**Case `extract_tax_calculator` — Plan has wrong parameters:**

Analysis (correct):
```json
{
  "primary_targets": ["calculateTotal"],
  "new_structures_needed": ["computeTaxWithRounding"]
}
```

Plan (incorrect — wrong parameters):
```json
{
  "action": "ADD_METHOD",
  "target": "computeTaxWithRounding",
  "details": {
    "parameters": [
      { "name": "price", "type": "double" },     // ← wrong: should be subtotal
      { "name": "quantity", "type": "int" },      // ← wrong: helper doesn't need this
      { "name": "taxRate", "type": "double" }
    ]
  }
}
```

The analysis correctly identified the new method name. But the synthesis picked the WRONG parameters — it copied `calculateTotal`'s parameters instead of the parameters that make sense for the extracted logic. The synthesis step re-derived the method signature independently instead of using the analysis context.

---

## 4. Root Cause Analysis

### 4.1 Prompt Gaps (fixable)

| Problem | Root Cause | Evidence |
|---------|-----------|----------|
| DECOMPOSE/SPLIT misclassified | No few-shot example in classifier prompt | FLATTEN works (has example), DECOMPOSE/SPLIT don't (no example) |
| Scope anchor hallucination | No fallback rule for classless code | All 4 classless-code cases had invented class names |
| new_structures hallucination | No constraint on what to list | Cases with instruction not asking for helpers got hallucinated helpers |
| Missed secondary targets | No "scan all occurrences" instruction | circle_pi analysis missed calculateCircumference |

### 4.2 Model Capability Limits (harder to fix)

| Problem | Root Cause | Evidence |
|---------|-----------|----------|
| Mutation explosion (14 vs 2) | Lost high-level analysis context | Long loop-heavy code triggers low-level breakdown |
| Plan ignores analysis parameters | Analysis→synthesis coherence gap | tax_calculator case: correct analysis, wrong plan params |
| Class name invention for classless code | Training distribution has no classless examples | All 4 cases invented class names |

### 4.3 Cascade Effect

```
Step 1: Classifier misclassifies intent (4/15 cases)
  → Step 2: Analysis targets wrong structure
    → Step 3: Plan mutations for wrong intent → all fail

Step 2: Analysis hallucinates structures (4/15 cases)
  → Step 3: Plan includes hallucinated structures → non-executable

Step 3: Synthesis independent of analysis (5/15 cases)
  → Plan ignores analysis → wrong parameters, wrong targets
```

The cascade means a failure in Step 1 or 2 guarantees Step 3 fails. And in 5 cases, even when Steps 1-2 succeed, Step 3 fails independently.

---

## 5. Evidence Package

### 5.1 Step 1 — Raw Classifier Outputs (verbatim)

**FLATTEN — Correct:**
```json
{
  "classification_scratchpad": "Instruction targets conditional structure. Code has nested if-statements in processOrder method. Category is CONTROL_FLOW, intent is FLATTEN_CONDITIONAL.",
  "intent_packet": {
    "refactor_category": "CONTROL_FLOW",
    "specific_intent": "FLATTEN_CONDITIONAL",
    "scope_anchor": { "unit_type": "METHOD_UNIT", "class": "OrderProcessor", "member": "processOrder" }
  }
}
```

**DECOMPOSE — Misclassified (from decomp_regex_dp):**
```json
{
  "classification_scratchpad": "Instruction targets method decomposition. Code contains a complex DP transition for the '*' character in isMatch method. Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD.",
  "intent_packet": {
    "refactor_category": "METHOD_MOVEMENT",
    "specific_intent": "EXTRACT_METHOD",
    "scope_anchor": { "unit_type": "METHOD_UNIT" }
  }
}
```

**SPLIT — Misclassified (from split_board_path):**
```json
{
  "classification_scratchpad": "Instruction targets method decomposition. Code contains a path-building method with nested while loops. Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD.",
  "intent_packet": {
    "refactor_category": "METHOD_MOVEMENT",
    "specific_intent": "EXTRACT_METHOD",
    "scope_anchor": { "unit_type": "METHOD_UNIT", "class": "PathBuilder", "member": "alphabetBoardPath" }
  }
}
```

Notice the consistent pattern: "targets method decomposition" → "METHOD_MOVEMENT" → "EXTRACT_METHOD." The model's scratchpad explicitly states this categorization chain. The word "decompose"/"split" is being semantically mapped to "method decomposition" → METHOD_MOVEMENT, overriding the prompt's CONTROL_FLOW categorization.

### 5.2 Step 2 — Raw Analysis Outputs (verbatim)

**Clean case (flat_demo_orderprocessor):**
```json
{
  "analysis_scratchpad": "The code contains nested if-statements that can be refactored using guard clauses to handle invalid states at the top with immediate exceptions.",
  "primary_targets": ["processOrder"],
  "secondary_targets": [],
  "new_structures_needed": ["guardClauseHelper", "INVALID_ORDER_MESSAGE"],
  "must_preserve": ["Exception: IllegalArgumentException", "String: 'User cannot be null.'"]
}
```

**Missing secondary target (const_circle_pi):**
```json
{
  "analysis_scratchpad": "The code contains a magic number 3.14159 used in calculateArea and calculateCircumference methods.",
  "primary_targets": ["calculateArea"],
  "secondary_targets": [],
  "new_structures_needed": ["CONSTANT_PI"],
  "must_preserve": []
}
```

The scratchpad acknowledges both methods ("used in calculateArea and calculateCircumference") but only lists calculateArea. The model recognized the cross-reference in natural language but didn't translate it to the structured output. This is a **reasoning-to-structure translation failure** — the model knows both methods use the constant but encodes only one in the structured field.

### 5.3 Step 3 — Raw Synthesis Outputs (verbatim)

**Executable plan (flat_demo_orderprocessor):**
```json
{
  "ast_modification_plan": {
    "target_class": "OrderProcessor",
    "ast_mutations": [{
      "action": "MODIFY_METHOD",
      "target": "processOrder",
      "details": {
        "modifiers": ["public"],
        "type": "void",
        "parameters": [
          { "name": "order", "type": "Order" },
          { "name": "user", "type": "User" }
        ],
        "logic_changes": ["Replace nested ifs with guard clauses using early returns/exceptions"],
        "body_abstract": "Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw."
      }
    }]
  }
}
```

This plan is correct — 1 mutation, proper scope, matching parameters. This is what successful Planner output looks like.

**Hallucinated target (decomp_regex_dp):**
```json
{
  "ast_modification_plan": {
    "target_class": "DPTransition",
    "ast_mutations": [{
      "action": "ADD_METHOD",
      "target": "boolean matchesZeroOrMore(String s, int i, String p, int j)",
      "details": { "modifiers": ["public"], "type": "boolean", "parameters": [...] }
    }]
  }
}
```

- `target_class: "DPTransition"` — hallucinated. Code has no class.
- Target includes full signature `boolean matchesZeroOrMore(String s, int i, String p, int j)` — wrong format (should be just the name).

---

## 6. Summary of Problems

| # | Problem | Severity | Occurrence | Fix difficulty |
|---|---------|----------|------------|----------------|
| 1 | DECOMPOSE/SPLIT always misclassified as EXTRACT_METHOD | P0 | 4/4 cases | **Easy** — add few-shot examples |
| 2 | Scope anchor invents class names for classless code | P0 | 4/4 classless cases | **Easy** — add empty-string fallback rule |
| 3 | Analysis hallucinates new_structures_needed | P1 | 4/15 cases | **Easy** — add "only if requested" constraint |
| 4 | Analysis misses secondary targets in multi-target cases | P1 | 2/2 multi-target cases | **Medium** — add "scan all occurrences" instruction |
| 5 | Synthesis produces plan with hallucinated targets | P1 | 7/15 cases | **Medium** — better analysis→synthesis handoff |
| 6 | Synthesis ignores analysis context (wrong parameters) | P1 | 3/15 cases | **Medium** — inject analysis directly into synthesis prompt |
| 7 | Mutation explosion (14 vs expected 2) | P2 | 1/15 cases | **Hard** — model capability limit |
| 8 | Analysis recognizes but doesn't encode cross-references | P2 | 1/15 cases | **Hard** — reasoning-to-structure translation |

---

## 7. Recommendations (in priority order)

### P0: Fix classifier prompt — Add DECOMPOSE and SPLIT examples

Add 2 few-shot examples to `prompts.yaml planner.classifier`:

```
### EXAMPLE 2 — DECOMPOSE_CONDITIONAL
Instruction: "Decompose the complex condition in isEligible into named booleans"
Code: public class A { boolean isEligible(int age) { if (age >= 18 && age <= 65) return true; return false; } }
Output: { "specific_intent": "DECOMPOSE_CONDITIONAL", "refactor_category": "CONTROL_FLOW", ... }

### EXAMPLE 3 — SPLIT_LOOP
Instruction: "Split the loop into two separate loops for each operation"
Code: public class A { void m() { for(int i=0;i<10;i++) { doX(); doY(); } } }
Output: { "specific_intent": "SPLIT_LOOP", "refactor_category": "CONTROL_FLOW", ... }
```

### P0: Add classless-code rule to classifier

Add to classifier prompt: "If the code has no class declaration (bare methods), set scope_anchor.class to an empty string."

### P1: Add constraint to analysis prompt

Add to `prompts.yaml planner.architect_analysis`: "List in new_structures_needed ONLY items the instruction explicitly requests. If the instruction asks only to modify existing code, leave new_structures_needed empty."

### P1: Add cross-reference instruction

Add: "Scan ALL code for ALL occurrences of the target pattern (magic numbers, repeated expressions, duplicate logic). List every occurrence in primary_targets or secondary_targets."

### P2: Strengthen analysis→synthesis coherence

In the synthesis prompt, after providing the analysis, add: "For each ADD_METHOD, use the parameter types and return type from the analysis new_structures_needed. Do NOT re-derive signatures independently."

### P2: Add mutation count guard

Add to synthesis prompt: "Produce no more than 5 ast_mutations. If the change requires more, consolidate into higher-level mutations."

---

## 8. Data Sources

- `test_results/isolated/planner_isolated_results.json` — Raw outputs from all 45 model calls
- `test_results/isolated/planner_isolated_report.md` — Structured per-case report
- `demo_scenario.txt` — OrderProcessor test case (1 case)
- `java_polish_full.json` — LeetCode problems (14 cases)
- `prompts.yaml` — Current Planner prompts (classifier, architect_analysis, architect)

*This report can be used as input for prompt engineering, model fine-tuning, or pipeline redesign. All evidence comes from verifiable model outputs captured in the JSON results file.*
