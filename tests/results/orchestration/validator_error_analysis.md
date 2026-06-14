# Deterministic Validation Error Analysis

Traced every function in `app/modules/validator.py` and every call from `app/modules/orchestrator.py` Phase 4. Each finding categorized: **BUG** (provably wrong output), **GAP** (missing check, correct code passes through), **FLAW** (correct output but wrong for design intent).

---

## BUGS — Provably Wrong Behavior

### BUG 1: `get_method_complexity` always returns None
**File:** `validator.py:455`  
**Severity:** P0 — EXTRACT_METHOD CC check silent no-op  
**Proof:**
```
v.get_method_complexity('class A { void m() { ... } }', 'm') → None
v.get_method_complexity('class A { void m() { ... } }', 'A::m') → 1
```
**Root cause:** Lizard returns `ClassName::methodName` (e.g., `A::m`). The code compares `func.name == method_name` where `method_name` is the bare name `m`. Never matches.

**Impact:** EXTRACT_RULE path in Phase 4 (line 430-458) always hits the `elif refac_method_cc is None` branch, adding false "Target method not found" finding. Or if both `orig_method_cc` and `refac_method_cc` are None, the branch is silently skipped — the CC check does nothing.

**Fix:** `func.name == method_name or func.name.endswith('::' + method_name)`

---

### BUG 2: Overloaded methods — dict key collision in `verify_boundary`
**File:** `validator.py:499-506`  
**Severity:** P1 — boundary violation hidden for overloaded methods  
**Proof:**
```python
orig_methods = {m.name: ... for m in find_nodes(orig_unit, MethodDeclaration)}
```
If class has `void m()` and `int m(int x)`, both have name `m`. Dict keeps only one. The second method's signature is never checked.

**Impact:** If the generator silently changes the second overload's body or returns wrong type for it, the boundary check misses it because only the first `m()` is in the dict.

**Fix:** Use `(name, param_count)` tuple as key, or `(name, param_types)` for full disambiguation.

---

### BUG 3: `verify_boundary` misses added methods in non-target scopes
**File:** `validator.py:524-534`  
**Severity:** P1 — boundary violations undetected  
**Proof:**
```python
for name, h in orig_methods.items():
    if name not in target_scopes and name in refac_methods:
        if h != refac_methods[name]:
            ...
```
The inner condition `name in refac_methods` means the check ONLY runs for methods that exist in BOTH original and refactored. If the generator adds `newEvil()` to a non-target class, `name` is in `refac_methods` but NOT in `orig_methods` → never enters the loop → never detected.

**Impact:** Generator can inject methods into non-target classes without detection. Could be exploited or triggered accidentally.

**Fix:** Add a second loop checking `refac_methods` keys not in `orig_methods` and not in `target_scopes`.

---

### BUG 4: `verify_boundary` misses removed methods from non-target scopes
**File:** `validator.py:524-534`  
**Severity:** P1 — boundary violations undetected  
**Proof:** Same condition as BUG 3. If the generator deletes `safe()` from a non-target class, `name` is in `orig_methods` but NOT in `refac_methods` → never enters the `if name in refac_methods` inner condition → never detected.

**Impact:** Generator can silently delete methods from non-target classes.

**Fix:** Add a check for `name not in refac_methods` within the outer loop.

---

### BUG 5: `verify_boundary` class-level check is dead code
**File:** `validator.py:536-548`  
**Severity:** P2 — misleading code, no functional impact with current method checks  
**Proof:** The entire `for name, h in orig_structs.items():` loop always hits `continue` on line 548. The class/enum structural comparison is completely disabled. Only method-level checks are active.

**Impact:** If a non-target top-level class has structural changes (added fields, changed modifiers), it's never flagged. Mitigated by the method-level check catching method modifications inside that class.

**Fix:** Either remove the dead loop or implement the class-level comparison properly.

---

### BUG 6: `_run_phase_4` syntax exhaustion path double-increments `strategy_iter`
**File:** `orchestrator.py:410`  
**Severity:** P1 — strategy counter overflow  
**Proof:**
```python
# Phase 4, line 410:
state.strategy_iter += 1  # No check for strategy_iter_incremented flag!
```
Compare with line 531 (structural failure path):
```python
if not state.strategy_iter_incremented:
    state.strategy_iter += 1
    state.strategy_iter_incremented = True
```
If Phase 3 already incremented `strategy_iter` (line 362-363) and then Phase 4 syntax exhaustion path also increments it, the counter jumps by 2 on a single outer loop. This prematurely triggers the circuit breaker (`strategy_iter > 3`).

**Fix:** Wrap line 410 in `if not state.strategy_iter_incremented:` check.

---

### BUG 7: `verify_flatten_conditional` checks entire AST, not target method
**File:** `validator.py:131-152`  
**Severity:** P1 — false failure for correct flatten  
**Proof:**
```
class A {
    void deepFunc() { if(a){if(b){if(c){}}}}  // depth 3, NOT modified
    void target()   { if(x){if(y){doW();}} }  // depth 2→1, WAS flattened
}
→ Final max depth = 3 → "Nesting depth did not decrease (Old: 3, New: 3)"
→ FAILS even though target method was correctly flattened
```
`get_max_depth` walks the ENTIRE AST, not just the target method's subtree. If any non-target method has deeper nesting, the global check fails even when the target method was correctly flattened.

**Impact:** Correct flatten refactorings fail because of deep nesting in OTHER methods. The orchestrator would re-plan unnecessarily.

**Fix:** Use `scope_anchor.member` to find the target method in the original AST, walk only that subtree for original depth. Find the corresponding method in the refactored AST for comparison.

---

### BUG 8: `count_binary_ops` in decompose includes arithmetic operators
**File:** `validator.py:156-166`  
**Severity:** P2 — metric inflates, still conservatively correct (only causes false negatives, not false positives)  
**Proof:**
```
if (a + b > 0 && c + d < 10)
```
`count_binary_ops` counts: `+`(a+b), `>`(a+b>0), `+`(c+d), `<`(c+d<10), `&&` = **5 ops total**  
But the condition's LOGICAL complexity is only: `>`, `<`, `&&` = 3 ops

The `+` operations are arithmetic, not conditional. Including them inflates the count, making the decrease harder to achieve (the verifier requires `refac_ops < orig_ops`). This is conservatively safe — it won't pass wrong code, but might fail correct decompositions that reduce logical operators but can't reduce arithmetic operators.

**Impact:** False negatives only (correct decompositions fail). Not a correctness risk, but hurts pipeline efficiency.

**Fix:** Filter to only logical/comparison operators: `>`, `<`, `>=`, `<=`, `==`, `!=`, `&&`, `||`, `!`.

---

## GAPS — Missing Checks

### GAP 1: No method signature verification in Phase 4
**Location:** Nowhere in `_run_phase_4` or `validator.py`  
**Severity:** P0 — allows `double→void`, `boolean→void`, parameter changes  
**What it misses:**
- Return type changes (`double calculateArea` → `void calculateArea`)
- Parameter list changes (`void m(int x)` → `void m(int x, int y)`)
- Modifier changes (`private` → `public`)
- Method deletion/renaming that wasn't in the plan

**These pass through undetected:** The `extract_constant` output with `double→void` passed all Phase 4 checks (CC, boundary, intent math) and reached the Judge.

**Fix:** Add Check D to Phase 4 — walk all MethodDeclaration nodes in both ASTs, compare (return_type, name, parameter_count, modifier_set). Flag any unplanned differences.

---

### GAP 2: No planned-elements verification in Phase 4
**Location:** Nowhere in `_run_phase_4`  
**Severity:** P0 — allows generator to skip planned changes  
**What it misses:**
- Plan says `ADD_METHOD: computeTaxWithRounding` — generator doesn't create it
- Plan says `ADD_FIELD: boolean hasSufficientAge` — generator skips it
- Plan says `ADD_CONSTANT: PI` — generator doesn't create it
- Generator returns original code unchanged — Phase 4 doesn't notice

**Proof:** The `decompose_conditional` test returned the original LoanApprover code unchanged. Phase 4 passed (CC 6→6, boundary clean, intent math clean because the algorithm checked for ANY binary op reduction, which happened to be true via the original code).

**Fix:** Add Check E to Phase 4 — for each `ADD_METHOD`/`ADD_FIELD`/`ADD_CONSTANT` mutation in the plan, verify the corresponding declaration exists in the refactored AST.

---

### GAP 3: No check for new methods/fields in non-target scopes
**File:** `validator.py:524-534` — same as BUG 3/4  
**Severity:** P0 — same root cause as BUG 3/4, scored higher for impact  
**What it misses:** Adding or removing methods/fields in non-target classes. Only existing methods that are modified are caught.

---

### GAP 4: `verify_extract_method` only checks count, not content
**File:** `validator.py:289-304`  
**Severity:** P2 — allows empty extractions  
**What it misses:**
- New method could be empty: `void helper() {}` still increments method count → passes
- Source method might not call the new helper → passes
- Extracted logic might be wrong or incomplete → passes

---

### GAP 5: `verify_extract_constant` doesn't verify `static final`
**File:** `validator.py:349-358`  
**Severity:** P2 — allows non-constant field declarations  
**Proof:**
```
Origin: class A { void m() { double a = 3.14 * 2; } }  // 0 fields
Refac:  class A { int PI = 3; void m() { double a = PI * 2; } }  // 1 field
→ verify_extract_constant: "Constant count increased from 0 to 1" → PASS
```
`PI` is `int` (not `double`), not `static final`, and value `3` (not `3.14`). All pass because the verifier only checks field count increased.

**Fix:** Check that new FieldDeclarations have `static final` modifiers and that their type matches the original literal's type.

---

### GAP 6: `verify_split_loop` requires exactly +1
**File:** `validator.py:284`  
**Severity:** P2 — fails legitimate multi-way splits  
**Proof:** If 1 loop is split into 3 loops, `refac_loops == orig_loops + 2` → FAILS. Only exactly `+1` passes.

**Impact:** Correct refactorings with more than 2-way splits fail. Minor — most loop splits are binary.

---

### GAP 7: `verify_consolidate_conditional` counts nodes, not conditions
**File:** `validator.py:188-200`  
**Severity:** P2 — allows wrong consolidations  
**What it misses:** Counting if-statements + switches doesn't verify the conditions were actually merged (using `||`). The generator could remove 2 ifs and add 1 switch with completely different logic, and the count decrease would pass.

---

### GAP 8: `verify_remove_control_flag` allows flag removal without flag check
**File:** `validator.py:228`  
**Severity:** P2 — allows non-flag variable removal  
**Proof:** If `refac_breaks > orig_breaks` is True (more exits), the verifier returns True even if no variable was removed. The `and len(removed_vars) > 0` check on line 222 is a separate condition — line 228 returns True without checking variable removal.

---

### GAP 9: No check for side-effect injection
**Location:** Nowhere  
**Severity:** P1 — `System.out.println` added to pure computation passes  
**Proof:** The `extract_constant` output added `System.out.println("Calculating area...")` to `calculateArea`. This passed all Phase 4 checks. Only the Judge caught it (sometimes).

**Fix:** Add side-effect check — compare MethodInvocation counts in target methods. If the original method has zero `println`/`print`/`log` calls and the refactored method adds them, flag as finding.

---

### GAP 10: `intent_enum` created twice from same data
**File:** `orchestrator.py:424, 505`  
**Severity:** P3 — code smell, no functional impact  
```python
intent_enum = RefactorIntent(state.intent_packet["specific_intent"])  # line 424
intent_enum = RefactorIntent(state.intent_packet["specific_intent"])  # line 505
```

---

## FLAWS — Correct Output, Wrong for Design Intent

### FLAW 1: `get_structural_signature` includes string literals in body
**File:** `validator.py:87-89`  
**Severity:** P2 — too strict for cosmetic changes  
**Effect:** Changing `"hello"` to `"world"` in a non-target method triggers boundary violation because the string is in the structural signature. This means error messages or log strings can't be refined without re-planning.

---

### FLAW 2: `get_structural_signature` excludes numeric literals
**File:** `validator.py:87-89`  
**Severity:** P2 — too lenient for value changes  
**Effect:** Changing `3.14` to `2.71` doesn't affect the structural signature. A non-target method could silently change its numeric logic without detection.

---

### FLAW 3: `check_syntax` errors accumulate from all templates
**File:** `validator.py:421-423`  
**Severity:** P3 — noisy error messages  
**Effect:** If all 3 templates fail, `errors` has 3 entries. `format_syntax_error` takes the FIRST error (`raw_errors[0]`), which is from template 0 (the least-wrapped attempt). The error from template 2 (the most-wrapped) might be more helpful since it's closest to valid Java.

---

### FLAW 4: `verify_boundary` returns None on syntax failure
**File:** `validator.py:492-493`  
**Severity:** P3 — defensive, but hides boundary violations in syntax-broken code  
**Effect:** If the refactored code has a syntax error, any boundary violation in it is silently swallowed. In practice, Phase 4's syntax check runs first and structural checks only run after syntax passes, so this is defensive.

---

### FLAW 5: `verifier_registry` returns None for unmapped intents
**File:** `validator.py:474-475`  
**Severity:** P3 — silent pass for new intents  
**Effect:** If a new `RefactorIntent` value is added without a verifier, the intent check silently passes. Should raise or log.

---

## SUMMARY TABLE

| # | Type | Severity | File:Line | Description |
|---|------|----------|-----------|-------------|
| B1 | BUG | P0 | `validator.py:455` | `get_method_complexity` always None — lizard name prefix |
| B2 | BUG | P1 | `validator.py:499` | Dict key collision on overloaded methods in boundary |
| B3 | BUG | P1 | `validator.py:525` | Boundary misses added methods in non-target scopes |
| B4 | BUG | P1 | `validator.py:525` | Boundary misses removed methods from non-target scopes |
| B5 | BUG | P2 | `validator.py:548` | Class boundary loop always continues — dead code |
| B6 | BUG | P1 | `orchestrator.py:410` | Syntax exhaustion double-increments strategy_iter |
| B7 | BUG | P1 | `validator.py:145` | Flatten depth is global AST, not per-target-method |
| B8 | BUG | P2 | `validator.py:156` | Decompose counts arithmetic binary ops as condition ops |
| G1 | GAP | P0 | `orchestrator.py:419+` | No method signature check in Phase 4 |
| G2 | GAP | P0 | `orchestrator.py:419+` | No planned-elements verification in Phase 4 |
| G3 | GAP | P0 | `validator.py:524` | BUG 3/4 compound — no add/remove detection |
| G4 | GAP | P2 | `validator.py:289` | extract_method only checks count, not content |
| G5 | GAP | P2 | `validator.py:349` | extract_constant doesn't verify static final |
| G6 | GAP | P2 | `validator.py:284` | split_loop requires exactly +1 |
| G7 | GAP | P2 | `validator.py:188` | consolidate counts nodes, not conditions |
| G8 | GAP | P2 | `validator.py:228` | remove_control_flag allows non-flag removal |
| G9 | GAP | P1 | `validator.py` | No side-effect injection check |
| G10 | GAP | P3 | `orchestrator.py:424` | intent_enum created twice |
| F1 | FLAW | P2 | `validator.py:87` | Structural sig includes strings — too strict |
| F2 | FLAW | P2 | `validator.py:87` | Structural sig excludes numerics — too lenient |
| F3 | FLAW | P3 | `validator.py:422` | Syntax errors accumulate from all templates |
| F4 | FLAW | P3 | `validator.py:492` | Boundary returns None on syntax failure |
| F5 | FLAW | P3 | `validator.py:474` | Missing verifier silently passes |

**Total: 8 bugs, 10 gaps, 5 flaws = 23 issues**
