# Sequential Mutation Application — 5-Case Results

**Run:** 2026-06-03  
**Generator model:** Qwen2.5-Coder-3B-Instruct (qwen_coder.gguf)  
**Judge model:** Llama-3.2-3B-Instruct (llama_engine.gguf)  

---

## Results Table

| Case | Intent | Mutations | Sequential Used? | Final Status | Total Time | Gen Time | Steps Succeeded |
|------|--------|-----------|-----------------|-------------|------------|----------|----------------|
| polish_extract_long_reformat | EXTRACT_METHOD | ADD_METHOD + MODIFY_METHOD | ✅ Yes (2 steps) | ABORT_STRATEGY | 77,767ms | 14,569ms | 2/2 |
| polish_const_short_box | EXTRACT_CONSTANT | 2× ADD_CONSTANT + MODIFY_METHOD | ✅ Yes | ERROR (crash) | 185,923ms | 0ms | 0/2 |
| polish_flatten_long_quads | FLATTEN_CONDITIONAL | 1× MODIFY_METHOD | ❌ (only 1 mutation) | ABORT_STRATEGY | 81,765ms | 0ms | N/A |
| polish_decompose_long_palindrome | DECOMPOSE_CONDITIONAL | ADD_FIELD + MODIFY_METHOD | ✅ Yes (2 steps) | ABORT_STRATEGY | 80,726ms | 0ms | 0/2 |
| polish_rename_long_paths | RENAME_SYMBOL | 4× (RENAME + RENAME + MODIFY + MODIFY) | ✅ Yes (4 steps) | **SUCCESS** | 81,162ms | 37,683ms | 4/4 |

---

## Per-Step Breakdown

### polish_extract_long_reformat (EXTRACT_METHOD) — Sequential PASSED

| Step | Action | Target | Time | Status |
|------|--------|--------|------|--------|
| 1 | ADD_METHOD | interleaveQueues | 7,200ms | ✅ OK |
| 2 | MODIFY_METHOD | reformat | 7,369ms | ✅ OK |

Gen time: **14,569ms** (avg 7.3s per step)  
Phase 4 failed on intent math (method count delta = 0, but sequential was correct). Circuit breaker hit before outer loop retry.

### polish_const_short_box (EXTRACT_CONSTANT) — Sequential FAILED

| Step | Action | Target | Time | Status |
|------|--------|--------|------|--------|
| 1 | ADD_CONSTANT | BULKY_DIMENSION_THRESHOLD | 5,827ms | ❌ SYNTAX_FAIL |
| 1 | ADD_CONSTANT | BULKY_DIMENSION_THRESHOLD | 5,359ms | ❌ SYNTAX_FAIL |
| 1 | ADD_CONSTANT | BULKY_DIMENSION_THRESHOLD | 5,347ms | ❌ SYNTAX_FAIL |
| 1 | ADD_CONSTANT | BULKY_DIMENSION_THRESHOLD | 5,275ms | ❌ SYNTAX_FAIL |

**Root cause:** Mutation prompt lacks the constant VALUE. Prompt says `ADD_CONSTANT BULKY_DIMENSION_THRESHOLD` but doesn't say `= 10000`. Generator cannot infer the value, produces invalid code.

### polish_decompose_long_palindrome (DECOMPOSE_CONDITIONAL) — Sequential FAILED

| Step | Action | Target | Time | Status |
|------|--------|--------|------|--------|
| 1 | ADD_FIELD | hasPalindromePermutation | 4,959ms | ❌ BOUNDARY_FAIL |
| 1 | ADD_FIELD | hasPalindromePermutation | 4,549ms | ❌ BOUNDARY_FAIL |
| 1 | ADD_FIELD | hasPalindromePermutation | 4,594ms | ❌ BOUNDARY_FAIL |
| 1 | ADD_FIELD | hasPalindromePermutation | 4,725ms | ❌ BOUNDARY_FAIL |

**Root cause:** `verify_boundary` compares structural signatures of all methods. Adding a field changes the class's structural signature (new field declaration appears in AST), triggering a false violation. Boundary check needs exemption for ADD_* structural additions.

### polish_rename_long_paths (RENAME_SYMBOL) — Sequential FULL SUCCESS

| Step | Action | Target | Time | Status |
|------|--------|--------|------|--------|
| 1 | RENAME_SYMBOL | m | 9,116ms | ✅ OK |
| 2 | RENAME_SYMBOL | n | 9,648ms | ✅ OK |
| 3 | MODIFY_METHOD | uniquePathsWithObstacles | 9,521ms | ✅ OK |
| 4 | MODIFY_METHOD | uniquePathsWithObstacles | 9,398ms | ✅ OK |

Gen time: **37,683ms** (avg 9.4s per step)  
All Phase 4 checks passed, Judge ACCEPTED. **First SUCCESS in this batch.**

---

## Key Findings

### ✅ What Works
1. **RENAME via sequential** — 4 steps, all clean. The model correctly renames symbols one at a time without touching other code. Per-step boundary check ensures no collateral damage.
2. **EXTRACT_METHOD via sequential** — Both steps passed syntax and boundary. The ADD_METHOD followed by MODIFY_METHOD order works. Failure was from Phase 4 intent math being too strict, not sequential.
3. **Per-step timing is consistent** — Each mutation takes 7-10s regardless of type. Predictable.

### ❌ What's Broken
1. **ADD_CONSTANT prompt lacks value** — Generator doesn't know `= 10000`. Must include `body_abstract` content as the value in the prompt. Fix: append `// Value: {value}` to the mutation text.
2. **Boundary check too strict for ADD_*** — `verify_boundary` flags structural additions as violations before MODIFY_METHOD runs. Fix: exempt ADD_* mutations from boundary check during sequential mode, or treat "new structures in output but not in original" as expected.
3. **Architect hallucination cascade** — When EXTRACT_CONSTANT fell back to one-shot and produced bad code, Planner regenerated 20+ identical MODIFY_METHOD mutations, crashing the response parser. Fix: cap mutation count in Planner synthesis prompt (already documented in optimization roadmap #8).
4. **Sequential for single-mutation plans** — FLATTEN had only 1 MODIFY_METHOD, so sequential was skipped entirely. This is correct behavior (no benefit from sequential for single mutations).

### ⏱️ Timing Analysis
| Phase | Time | % of Total |
|-------|------|-----------|
| Planner (Ph2) | ~15-20s | 20-25% |
| Generator (Ph3) sequential | 14-38s | 15-50% |
| One-shot fallback + retries | 30-90s | 35-55% |
| Validation (Ph4) | <1s | <1% |
| Judge (Ph5) | ~10-15s | 15-20% |

### 🔬 Sequential Overhead vs Benefit
- **Overhead per case:** Sequential adds 1 extra Generator call per mutation (2-4 calls vs 1-3 for multi-sample). Each call is 7-10s.
- **Benefit:** Cleaner output per mutation. No defensive code. Step-level verification catches problems early.
- **When to use:** Only for multi-mutation plans (EXTRACT_METHOD, EXTRACT_CONSTANT, DECOMPOSE, RENAME). For single mutations (FLATTEN), one-shot is fine.

---

## Recommendations

| Priority | Fix | Impact | Effort |
|----------|-----|--------|--------|
| P0 | Include constant value in ADD_CONSTANT prompt | Unlocks EXTRACT_CONSTANT | <5 lines |
| P1 | Exempt ADD_* mutations from boundary check in sequential mode | Unlocks DECOMPOSE, CONSOLIDATE | <10 lines |
| P2 | Cap mutation count in Planner to max 5 | Prevents hallucination cascade | 1 line (prompts.yaml) |
| P3 | Fix verify_intent for EXTRACT_METHOD to allow method count increase | Unlocks EXTRACT_METHOD | Already in robustness plan #4 |

With P0+P1 fixed, sequential should work for 3/5 test cases (EXTRACT_METHOD, EXTRACT_CONSTANT, RENAME).
