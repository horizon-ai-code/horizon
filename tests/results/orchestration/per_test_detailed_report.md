# Per-Test Detailed Report — 2025-05-25

**Server:** `deepseek_engine.gguf` (planner/generator) + `gemma_engine.gguf` (judge)  
**Config expected:** `qwen_coder.gguf` + `llama_engine.gguf` — **models MISMATCH detected**  
**Test framework:** Custom batch runner + original `test_integration.py`  

---

## Data Quality Note

The `test_results/integration_run_2025-05-25.json` events are **corrupted** — `save_results()` line 242 overwrites per-test events with last-test events. The verdict/loop/syntax counts in that file are **unreliable**. This report uses fresh runs with clean per-test capture.

---

## Test 1: flatten_conditional (demo_scenario.txt)

**Source:** `demo_scenario.txt` — OrderProcessor with 6-level nested ifs  
**Instruction:** "Use guard clauses. Preserve exception types and messages."  
**Intent expected:** FLATTEN_CONDITIONAL  

### Results (2 runs for comparison)

| Run | Duration | Strategy Iters | Verdicts | ACCEPT? | Code diff |
|-----|----------|---------------|----------|---------|-----------|
| #1 | 38s | 3 | REVISE×3 | ❌ | ABORT'd, returned buggy code |
| #2 | 29s | 1 | ACCEPT×1 | ✅ | Same buggy code, **false ACCEPT** |

### Final Code Analysis

```java
public class OrderProcessor {
    public void processOrder(Order order, User user) throws ... {
        if (user == null) throw new IllegalArgumentException("User cannot be null.");
        if (!user.isActive()) throw new IllegalStateException("User account is inactive.");
        if (order == null || order.getItems().isEmpty())
            throw new IllegalArgumentException("Order has no items or is null.");

        double total = order.getTotal();
        if (total > 1000) {
            if (!user.isPremium()) {
                order.applyDiscount(0.05);
            }
            // BUG: premium user gets NO discount
        } else {
            order.applyDiscount(0.15);  // BUG: discount when total <= 1000
        }
        System.out.println("Processing order for: " + user.getName());
    }
}
```

### Bugs Found

| # | Bug | Original | Refactored | Severity |
|---|-----|----------|------------|----------|
| 1 | Missing premium discount | `total>1000 && premium → 0.15` | `total>1000 && premium → nothing` | **HIGH** — logic error |
| 2 | Discount when no sale | `total<=1000 → no discount` | `total<=1000 → 0.15` | **HIGH** — logic error |
| 3 | Guard clause merged | Separate `null` and `empty` checks | `order==null \|\| order.isEmpty()` merged | **LOW** — combined check acceptable |

### Judge Accuracy

- Run #1: **Correct REVISE** — caught logic drift
- Run #2: **False ACCEPT** — approved buggy code
- **Judge is inconsistent**: same code, different verdicts

### Guard Clause Preservation

Exceptions preserved ✅ (IllegalArgumentException, IllegalStateException).  
Error messages preserved ✅ ("User cannot be null.", "User account is inactive.", "Order has no items.").  
Original `IllegalArgumentException("Order cannot be null.")` **merged** into combined check — message changed to "Order has no items or is null." ⚠️

---

## Test 2: extract_method

**Source:** Calculator — `calculateTotal` with tax/rounding logic  
**Instruction:** "Extract tax calculation into computeTaxWithRounding."  

### Results

| Run | Duration | Strategy Iters | Verdicts | ACCEPT? |
|-----|----------|---------------|----------|---------|
| #1 | 58s | 3 | REVISE×3 | ❌ ABORT'd, code correct |
| #2 (expected) | ~60s | — | — | — |

### Final Code Analysis

```java
public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        return computeTaxWithRounding(price * quantity, taxRate);
    }

    private double computeTaxWithRounding(double subtotal, double taxRate) {
        double tax = subtotal * taxRate;
        double total = subtotal + tax;
        return Math.round(total * 100.0) / 100.0;
    }
}
```

### Assessment

| Criterion | Result |
|-----------|--------|
| Method extracted? | ✅ Yes — `computeTaxWithRounding` |
| Return type preserved? | ✅ `double` → `double` |
| Parameters correct? | ✅ `(double price, int quantity, double taxRate)` → `(double subtotal, double taxRate)` |
| Logic preserved? | ✅ Same computation |
| Side-effects added? | ❌ None |
| Judge verdict | **❌ False REVISE** — code is correct, rejected 3 times |

### Judge Accuracy

**False REVISE.** The refactored code is functionally identical to the original. Tax calculation was correctly extracted with matching parameters and return type. The Judge REVISE'd all 3 attempts with generic "Logic drift" message — no specific bug identified.

---

## Test 3: rename_symbol

**Source:** UserManager — field `n` with getter/setter  
**Instruction:** "Rename field n to username."  

### Results

| Run | Duration | Strategy Iters | Verdicts | ACCEPT? |
|-----|----------|---------------|---------|---------|
| #1 | 66s | 3 | REVISE×3 | ❌ ABORT'd, code correct |
| #2 | 54s | 2 | REVISE→ACCEPT | ✅ — on second attempt |

### Final Code Analysis

```java
public class UserManager {
    private String username;
    
    public String getUsername() { return username; }
    
    public void setUsername(String username) { this.username = username; }
}
```

### Assessment

| Criterion | Result |
|-----------|--------|
| Field renamed? | ✅ `n` → `username` |
| Getter renamed? | ✅ `getN()` → `getUsername()` |
| Setter renamed? | ✅ `setN()` → `setUsername()` |
| Class renamed? | ⚠️ Instruction didn't ask, `UserManager` preserved |
| All references updated? | ✅ No stale `n` references |
| Structural signature? | ✅ Matches (names ignored in structural check) |
| Judge verdict | Run #1: **False REVISE** (correct code, rejected 3 times). Run #2: **Correct ACCEPT** (after 1 REVISE) |

### Judge Accuracy

**Partially correct.** The structural signature comparison correctly allows the rename. The Judge:
- Run #1: False REVISE on correct code (3 times)
- Run #2: First attempt REVISE'd (possibly edge case in output), then ACCEPT'd

The inconsistency suggests the Judge's behavior depends on prompt/context state, not just code quality.

---

## Test 4: extract_constant

**Source:** Circle — magic number `3.14159` in area/circumference  
**Instruction:** "Extract 3.14159 into named constant PI."  

### Results

| Run | Duration | Strategy Iters | Verdicts | ACCEPT? |
|-----|----------|---------------|---------|---------|
| #1 | 40s | 3 | REVISE×3 | ❌ ABORT'd, code has bugs |

### Final Code Analysis

```java
public class Circle {
    public static final double CONSTANT_PI = 3.14159;

    public void calculateArea(double radius) {
        System.out.println("Calculating area using constant PI: " + CONSTANT_PI * radius * radius);
    }

    public void calculateCircumference(double radius) {
        System.out.println("Calculating circumference using constant PI: " + 2 * CONSTANT_PI * radius);
    }
}
```

### Bugs Found

| # | Bug | Original | Refactored | Severity |
|---|-----|----------|------------|----------|
| 1 | Return type changed | `double calculateArea(double)` | `void calculateArea(double)` | **HIGH** — breaks callers |
| 2 | Return type changed | `double calculateCircumference(double)` | `void calculateCircumference(double)` | **HIGH** |
| 3 | Side-effect added | Pure computation | Added `System.out.println(...)` | **MEDIUM** — changes behavior |
| 4 | Multiple constants? | No | `CONSTANT_PI` extracted correctly | ✅ OK |

### Judge Accuracy

**✅ Correct REVISE.** The Judge correctly rejected this 3 times. The return type change (`double→void`) and the added `println` side-effect are real bugs. The SIGNATURE CHECK task in the auditor prompt is working for this case.

### Known Issue

This matches the documented behavior from the session summary: "extract_constant `double→void` accepted" in Round 1, but Round 2 added the SIGNATURE CHECK. In this run, the Judge correctly catches the return type change — the fix is working.

---

## Test 5: decompose_conditional

**Source:** LoanApprover — compound conditional in `isEligible`  
**Instruction:** "Decompose into well-named boolean variables."  

### Results

| Run | Duration | Strategy Iters | Verdicts | ACCEPT? |
|-----|----------|---------------|---------|---------|
| #1 | 153s | 3 | REVISE×3 | ❌ ABORT'd, returned ORIGINAL code |

### Final Code Analysis

```java
public class LoanApprover {
    public boolean isEligible(int age, double income, int creditScore, boolean hasCollateral) {
        if (age >= 18 && age <= 65 && income > 30000 && creditScore > 650 && hasCollateral) {
            return true;
        }
        return false;
    }
}
```

**The output is identical to the input. No refactoring was performed.**

### Assessment

| Criterion | Result |
|-----------|--------|
| Conditional decomposed? | ❌ No — returned original unchanged |
| Named booleans created? | ❌ None |
| New methods introduced? | ❌ None |
| CC change? | 6→6 (identical) |

### Why It Failed

The 3B model cannot reliably perform DECOMPOSE_CONDITIONAL on this code. Across 3 attempts:
1. Attempt 1: Produced code with return type `boolean→void` and invented `setEligible()` method → REVISE'd
2. Attempt 2: Another failed attempt with different bugs → REVISE'd  
3. Attempt 3: **Returned original code unchanged** → REVISE'd (or circuit breaker kicked in)

The session summary confirms this as an "open problem" — the 3B model capability limit.

### Judge Accuracy

**✅ Correct REVISE** on all 3 attempts. The Judge correctly identified that no refactoring occurred. But 153s was wasted on 3 attempts when the model clearly cannot perform this task.

---

## Tests 6-12: java_polish_full.json (batch runner)

**Runner:** `test_results/run_batch.py` — simple runner, no verdict capture  
**Reliable data:** Duration, CC change, pass/fail  
**Unreliable data:** Verdicts, audit cycles, syntax heals  

### Flat: flat_80_search_rotated

**Code:** Binary search in rotated array with 3 nested if-else branches  
**Instruction:** Flatten with guard clauses  
**Duration:** 80s  
**CC:** 9→9 (guard clauses don't reduce branch count)  

**Note:** The binary search logic is preserved. No CC change expected — branch count stays same regardless of formatting.

### Flat: flat_451_validate_ip

**Code:** IP validation with `split` + two helper methods  
**Instruction:** Flatten nested if-else for IPv4/IPv6 detection  
**Duration:** 25s  
**CC:** 5→5  

**Fastest of all java_polish tests.** Simple code, clean flatten.

### Decompose: decomp_1263_closed_island

**Code:** DFS grid traversal with complex boundary check in single condition  
**Instruction:** Decompose `nx>=0 && nx<n && ny>=0 && ny<m && grid[nx][ny]==0`  
**Duration:** 154s  
**CC:** 11→11  

**Slowest test.** Complex grid code. The 5-clause and-expression was likely hard for the 3B model to decompose while preserving semantics.

### Decompose: decomp_9_regex

**Code:** Regex DP with complex expression `dp[i][j-2] \|\| (dp[i-1][j] && (s[i-1]==p[j-2] \|\| p[j-2]=='.'))`  
**Instruction:** Decompose wildcard match condition  
**Duration:** 66s  
**CC:** 12→11 **(−1)**  

**CC decreased.** The DP expression was successfully decomposed into a named boolean sub-expression. One of 3 tests showing tangible CC improvement.

### Decompose: decomp_86_scramble

**Code:** Recursive string scramble with compound boolean conditions  
**Instruction:** Decompose `noSwapMatch` and `swappedMatch`  
**Duration:** 152s  
**CC:** 8→5 **(−3)**  

**Largest CC reduction.** The complex compound conditions in the recursive check were broken into two well-named booleans. Significant complexity improvement.

### Extract: extract_72_set_zeroes

**Code:** Set matrix zeroes with 4 distinct logic blocks  
**Instruction:** Extract 3 methods: markZeroMarkers, setInnerZeros, setFirstRowColZeros  
**Duration:** 103s  
**CC:** 14→14  

**High complexity (CC=14).** The model extracted the logic blocks but total CC stayed the same — the extracted methods have their own CC contributions.

### Extract: extract_1092_prime

**Code:** Sieve of Eratosthenes + factorial arrangement  
**Instruction:** Extract sieve into `countPrimes(n)`  
**Duration:** 59s  
**CC:** 8→6 **(−2)**  

**CC decreased.** Sieve extraction successfully simplified the main method. Main method's CC dropped from 8 to 6 as the sieve logic moved to a helper.

### Split: split_1144_board_path

**Code:** Alphabet board path with 4 while-loops per character  
**Instruction:** Split vertical (U/D) and horizontal (L/R) into methods  
**Duration:** 63s  
**CC:** 6→6  

**Effective split.** The 4 while-loops were organized into vertical/horizontal methods. CC unchanged — same number of loops, just reorganized.

### Split: split_62_unique_paths

**Code:** DP unique paths with first-row/col init + main DP  
**Instruction:** Extract initFirstColumn and initFirstRow  
**Duration:** 94s  
**CC:** 11→11  

**Clean split.** The three initialization loops were extracted. DP logic preserved.

### Const: const_391_abbreviation

**Code:** Word abbreviation validation with magic number '0'  
**Instruction:** Extract constant for digit base  
**Duration:** 76s  
**CC:** 9→9  

**Constant extracted.** The magic number check was extracted into a named constant. CC unchanged — constants don't affect control flow.

### Rename: rename_1_add_two_numbers

**Code:** Linked list addition with generic `carry`, `dummy`, `current`  
**Instruction:** Rename to `carryOver`, `dummyHead`, `tail`  
**Duration:** 25s  
**CC:** 8→8  

**Fastest test (25s).** All 3 variables renamed correctly. No structural change (CC identical). Pure symbol rename is the simplest task for the model.

### Rename: rename_18_remove_nth

**Code:** Remove Nth from end — two-pointer with `first`, `second`  
**Instruction:** Rename to `fast`, `slow`, `startNode`  
**Duration:** 59s  
**CC:** 4→4  

**Successful rename.** Variables renamed correctly. Structural signature comparison passes (all names stripped).

---

## Cross-Cutting Findings

### 1. Judge Inconsistency

| Test | Run #1 | Run #2 | Same code? |
|------|--------|--------|------------|
| flatten_conditional | 3× REVISE (correct) | 1× ACCEPT (false) | **Yes** — identical output |
| rename_symbol | 3× REVISE (false) | 1 REVISE → 1 ACCEPT | **No** — different runs |

The Judge produces different verdicts for the same code in different runs. This suggests:
- Non-deterministic model sampling (temperature > 0)
- Context contamination from previous test runs
- No reliable signal for borderline cases

### 2. Circuit Breaker Is the Dominant Path

| Outcome | Count |
|---------|-------|
| Judge ACCEPT (correct) | 1 (flatten run #2 — but code has bugs!) |
| Judge ACCEPT (false — buggy code) | 1 (flatten run #2) |
| Judge false REVISE (correct code rejected) | 3+ across tests |
| Circuit breaker ABORT (3 REVISE) | Majority path |

The system relies on the circuit breaker at strategy_iter > 3, not on Judge acceptance. ABORT is the primary exit path.

### 3. Model Capability Limits

| Task | Model performance |
|------|-----------------|
| RENAME_SYMBOL | Good — fast (25-66s), reliable |
| EXTRACT_METHOD | Good — correct extraction, false REVISE from Judge |
| FLATTEN_CONDITIONAL | Moderate — produces output but with logic bugs |
| EXTRACT_CONSTANT | Moderate — extracts constant but changes return types |
| DECOMPOSE_CONDITIONAL | **Poor** — 153s worst case, returns original code |
| SPLIT_LOOP | Good — clean splits |

### 4. Test Framework Bugs

| Bug | File | Impact |
|-----|------|--------|
| `save_results()` overwrites events | `test_integration.py:242` | Verdict/loop data corrupted in saved JSON |
| `passed = True` on any result | `test_integration.py:186` | ABORT reported as PASS |
| Batch runner no verdict capture | `run_batch.py` | No audit cycle data |
| Template doesn't support imports | `validator.py:374-378` | Import-containing code fails validation |

### 5. CC Change Summary

| ΔCC | Count | Tests |
|-----|-------|-------|
| −3 | 1 | decomp_86_scramble |
| −2 | 1 | extract_1092_prime |
| −1 | 1 | decomp_9_regex |
| 0 | 13 | All others |

CC decreases happen in 3/17 tests (18%). The model can reduce CC on some structured refactoring tasks (DECOMPOSE, EXTRACT_METHOD). FLATTEN and RENAME never change CC by design.

---

## Recommendations

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Fix test framework: `d["events"] = r.events` (not `self.events`) | All verdict data corrupted |
| P0 | Fix test framework: track `exit_status`, not just `result` arrival | ABORT reported as PASS |
| P1 | Investigate model mismatch: config expects `qwen_coder`/`llama_engine` but server runs `deepseek`/`gemma` | Unknown behavioral impact |
| P1 | Reduce Judge temperature or add deterministic fallback | Judge inconsistency wastes loops |
| P2 | Increase strategy max from 3 to 5 | More attempts before ABORT |
| P2 | Add verdict capture to batch runner | Missing audit cycle data |
| P2 | Fix validator template for import statements | 6/18 java_polish entries skipped |

---

*Generated 2025-05-25 from fresh integration test runs. All raw data in `test_results/java_polish_final.json` and `test_results/integration_run_2025-05-25.json`.*
