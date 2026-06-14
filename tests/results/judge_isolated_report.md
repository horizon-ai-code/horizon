# Judge Isolated Reasoning Report

**Date:** 2026-06-01T20:50:19.155900
**Model:** Llama-3.2-3B-Instruct
**Cases:** 10 cases × 5 runs = 50 calls
**Design:** 5 ACCEPT-expected + 5 REVISE-expected, each run 5× for consistency

---

## Summary

| Metric | Result |
|--------|--------|
| Total runs | 50 |
| Correct verdict (matches expected) | 47/50 (94%) |
| False ACCEPT rate (REVISE-expected but ACCEPT) | 2/25 |
| False REVISE rate (ACCEPT-expected but REVISE) | 1/25 |
| Accuracy on ACCEPT-expected cases | 24/25 |
| Accuracy on REVISE-expected cases | 23/25 |
| Unanimous cases (5/5 same verdict) | 8/10 |
| Volatile cases (3-2 split) | 1/10 |
| Avg scratchpad length | 290 chars |
| Avg issues count | 0.6 |

---

## Per-Case Detail

### Case 1: accept_extract_method_tax (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | "" | 300 | 4.6s |
| 2 | ACCEPT | "" | 300 | 4.58s |
| 3 | ACCEPT | "" | 312 | 4.85s |
| 4 | ACCEPT | "" | 312 | 5.12s |
| 5 | ACCEPT | "" | 312 | 5.19s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Within the model's reliable range — clear structural signals make verdict straightforward. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code maintains the same logic as the original, with no changes to conditional paths or outputs. The computeTaxWithRounding method is a stylistic improvement and does not affect behavior.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code maintains the same logic as the original, with no changes to conditional paths or outputs. The computeTaxWithRounding method is a stylistic improvement and does not affect behavior.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code maintains the same logic as the original, with no changes to conditional paths or outputs. The computeTaxWithRounding method is a stylistic improvement and does not introduce any logical drift.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code maintains the same logic as the original, with no changes to conditional paths or outputs. The computeTaxWithRounding method is a stylistic improvement and does not introduce any logical drift.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code maintains the same logic as the original, with no changes to conditional paths or outputs. The computeTaxWithRounding method is a stylistic improvement and does not introduce any logical drift.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  }
]
```

### Case 2: accept_rename_symbol_field (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | "" | 172 | 3.57s |
| 2 | ACCEPT | "" | 262 | 5.05s |
| 3 | ACCEPT | "" | 173 | 4.14s |
| 4 | ACCEPT | "" | 299 | 5.7s |
| 5 | ACCEPT | "" | 172 | 3.56s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Within the model's reliable range — clear structural signals make verdict straightforward. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"n\", \"refactored\": \"username\"}], \"logic_comparison\": \"Renaming variable from 'n' to 'username'. No logic drift detected.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"n\", \"refactored\": \"username\"}], \"logic_comparison\": \"Renaming 'n' to 'username' does not change the behavior of getN() and setN(). The getter still returns the value stored in username, and the setter sets it.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"n\", \"refactored\": \"username\"}], \"logic_comparison\": \"Renaming variables from 'n' to 'username'. No logic drift detected.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"n\", \"refactored\": \"username\"}], \"logic_comparison\": \"Renaming 'n' to 'username' does not change the behavior of getN() and setN(). The getter returns the same value as before, which is still 'n'. The setter updates its argument with a new string.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"n\", \"refactored\": \"username\"}], \"logic_comparison\": \"Renaming variable from 'n' to 'username'. No logic drift detected.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  }
]
```

### Case 3: accept_flatten_guard_clauses (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | "" | 232 | 5.15s |
| 2 | ACCEPT | "" | 174 | 4.09s |
| 3 | ACCEPT | "" | 174 | 4.12s |
| 4 | ACCEPT | "" | 174 | 3.99s |
| 5 | REVISE | "Plan was not executed: code is identical to original., Logic drift would cause d" | 518 | 9.7s |
- **Accuracy:** 4/5
- **Consistency:** 4-1 split
- **Raw verdicts:** `['ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT', 'REVISE']`

#### What happened
4/5 runs matched expected ACCEPT. 1 runs disagreed. Judge is inconsistent on this case.

#### Why this likely happened
False REVISE on correct code. The Judge's audit prompt may be too demanding for 3B model — when it cannot fully verify equivalence, it defaults to REVISE as safe fallback. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null},{\"original\": \"y\", \"refactored\": \"null\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null},{\"original\": \"y\", \"refactored\": \"null\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\\nThe original code checks for x != null, y != null and then further conditions. The refactored version combines these into a single if statement that throws an exception when either variable is null or not equal to the other. This change does not preserve logic from the original code.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift would cause different behavior.\"] }"
  }
]
```

### Case 4: accept_split_loop (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | "" | 175 | 3.54s |
| 2 | ACCEPT | "" | 181 | 4.33s |
| 3 | ACCEPT | "" | 175 | 4.21s |
| 4 | ACCEPT | "" | 175 | 4.46s |
| 5 | ACCEPT | "" | 175 | 4.05s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Within the model's reliable range — clear structural signals make verdict straightforward. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Both loops have the same logic and produce identical outputs for all inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Both loops have the same logic and produce identical outputs for any given inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Both loops have the same logic and produce identical outputs for all inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Both loops have the same logic and produce identical outputs for all inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"Both loops have the same logic and produce identical outputs for all inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  }
]
```

### Case 5: accept_extract_constant_pi (expected: ACCEPT)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | ACCEPT | "" | 247 | 5.66s |
| 2 | ACCEPT | "" | 240 | 5.21s |
| 3 | ACCEPT | "" | 211 | 4.74s |
| 4 | ACCEPT | "" | 211 | 4.92s |
| 5 | ACCEPT | "" | 247 | 5.62s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT', 'ACCEPT']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Within the model's reliable range — clear structural signals make verdict straightforward. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The original code and refactored code produce the same outputs for the same inputs. For example, calculateArea(5) returns 78.53975 in both versions.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The original code and refactored code produce the same outputs for the same inputs. For example, calculateArea(1) returns 3 in both versions.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods produce the same outputs for any given inputs, as expected.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods produce the same outputs for any given inputs, as expected.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The original code and refactored code produce the same outputs for the same inputs. For example, calculateArea(5) returns 78.53975 in both versions.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  }
]
```

### Case 6: revise_extract_constant_broken_sig (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | "Plan was not executed: code is identical to original., Plan was not fully implem" | 238 | 7.8s |
| 2 | REVISE | "Plan was not executed: code is identical to original., Plan was not fully implem" | 284 | 7.93s |
| 3 | REVISE | "Plan was not executed: code is identical to original." | 284 | 6.32s |
| 4 | REVISE | "" | 611 | 11.89s |
| 5 | REVISE | "" | 615 | 11.52s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['REVISE', 'REVISE', 'REVISE', 'REVISE', 'REVISE']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Return type changed double→void AND println side-effect added. Two clear violations of the SIGNATURE CHECK task. When both signals are present, Judge reliably catches at least one. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods produce different outputs for the same inputs due to the addition of print statements.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Plan was not fully implemented as it included ADD_CONSTANT, MODIFY_METHOD changes but only partial implementation.\"] }"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods now print the results instead of returning them. This change does not affect their functionality, but it is a stylistic improvement.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Plan was not fully implemented: ADD_CONSTANT(PI) and MODIFY_METHOD(calculateArea), MODIFY_METHOD(calculateCircumference) were requested.\"] }"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods now print the results instead of returning them. This change does not affect their functionality, but it is a stylistic improvement.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\"] }"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods now print the results instead of returning them. This change does not affect their functionality but changes how they are used.\\n\\nFor example, given a circle with radius 5:\\n\\nOriginal code: \\ncalculateArea(5) returns 78.53975\\n\\ncalculateCircumference(5) returns 31.4159\\n\\nRefactored code: \\ncircle.calculateArea(5)\\n\\tprint('Area is: ' + circle.PI * radius * radius)\\n\\ncircle.calculateCircumence(5)\\n\\tprint('Circumference is: ' + 2 * circle.PI * radius)\"},\"verdict\": \"REVISE\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The calculateArea and calculateCircumference methods now print the results instead of returning them. This change does not affect their functionality but changes how they are used.\\n\\nFor example, given a circle with radius 5:\\n\\nOriginal code: \\ncalculateArea(5) returns 78.53975\\n\\ncalculateCircumference(5) returns 31.4159\\n\\nRefactored code: \\ncircle.calculateArea(5)\\n\\tprint(\\\"Area is: \\\" + circle.PI * radius * radius)\\n\\ncircle.calculateCircumence(5)\\n\\tprint(\\\"Circumference is: \\\" + 2 * circle.PI * radius)\"},\"verdict\": \"REVISE\", \"issues\": []}"
  }
]
```

### Case 7: revise_decompose_noop (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | "Plan was not executed: code is identical to original" | 250 | 5.67s |
| 2 | REVISE | "Plan was not executed: code is identical to original" | 273 | 6.62s |
| 3 | REVISE | "Plan was not executed: code is identical to original" | 302 | 6.75s |
| 4 | REVISE | "Plan was not executed: code is identical to original" | 268 | 6.86s |
| 5 | REVISE | "Plan was not executed: code is identical to original" | 269 | 5.81s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['REVISE', 'REVISE', 'REVISE', 'REVISE', 'REVISE']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Code is identical to original — the most obvious REVISE case. Model can verify this easily because both code blocks are the same. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code is identical to the original, but no changes were made as per the plan. The logic remains unchanged and does not exhibit any drift.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original\"]}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code is identical to the original code, but no changes were made as per the plan. This indicates that the plan was not executed: code is identical to original.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original\"]}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code is identical to the original, but no changes were made as per the plan. This indicates that either the mutations did not get executed or there was a logic drift in the implementation.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original\"]}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code is identical to the original, but no changes were made as per the plan. This indicates that either the plan was not executed or logic drift occurred.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original\"]}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code is byte-for-byte identical to the original code, but no changes were made as per the plan. The logic remains unchanged and does not exhibit any drift.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original\"]}"
  }
]
```

### Case 8: revise_flatten_logic_inverted (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | "" | 753 | 13.11s |
| 2 | REVISE | "" | 372 | 7.48s |
| 3 | REVISE | "" | 372 | 7.53s |
| 4 | REVISE | "Plan was not executed: code is identical to original., Logic drift would cause d" | 249 | 6.12s |
| 5 | REVISE | "Plan was not executed: code is identical to original., Changes explicitly listed" | 440 | 10.08s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['REVISE', 'REVISE', 'REVISE', 'REVISE', 'REVISE']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Logic inversion (discount applied at wrong threshold) is a subtle semantic error. The 3B model may struggle to trace all conditional paths. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"total\", \"refactored\": \"total\", \"mapping\": null},{\"original\": \"premium\", \"refactored\": \"premium\", \"mapping\": null}], \"logic_comparison\": \"Original: total > 1000, premium = true. Refactored: total <= 1000, !premium.\\nLogic drift detected for discount(0.15) when total <= 1000 and premium is false.\\nConcrete example:\\n- Original: process(1201, true). Expected output: bonus() then discount().\\n- Refactored: process(1201, false). Expected output: discount(), no bonus.\\nLogic drift detected for discount(0.05) when total <= 1000 and premium is true.\\nConcrete example:\\n- Original: process(900, true). Expected output: discount() then bonus().\\n- Refactored: process(900, false). Expected output: discount(), no bonus.\"}, \"verdict\": \"REVISE\", \"issues\": []}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"total\", \"refactored\": \"total\", \"mapping\": null},{\"original\": \"premium\", \"refactored\": \"premium\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\\n\\nOriginal: total > 1000, premium = true \\u2192 discount(0.15)\\nRefactored: total <= 1000, !premium \\u2192 discount(0.05)\"},\"verdict\": \"REVISE\",\"issues\": []}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"total\", \"refactored\": \"total\", \"mapping\": null},{\"original\": \"premium\", \"refactored\": \"premium\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\\n\\nOriginal: total > 1000, premium = true \\u2192 discount(0.15)\\nRefactored: total <= 1000, !premium \\u2192 discount(0.05)\"},\"verdict\": \"REVISE\",\"issues\": []}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"total\", \"refactored\": \"total\", \"mapping\": null},{\"original\": \"premium\", \"refactored\": \"premium\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift would cause different behavior.\"] }"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"total\", \"refactored\": \"total\", \"mapping\": null},{\"original\": \"premium\", \"refactored\": \"premium\", \"mapping\": null}], \"logic_comparison\": \"Structural summary of conditional paths with at least one concrete example.\\n\\nOriginal: total > 1000, premium = true \\u2192 discount(0.15)\\nRefactored: total <= 1000, !premium \\u2192 discount(0.05) or discount(0.15)\\nLogic drift: different behavior for same inputs.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Changes explicitly listed in the plan mutations are NOT errors \u2014 they were requested.\"] }"
  }
]
```

### Case 9: revise_extract_method_wrong_params (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | "Plan was not executed: code is identical to original., Logic drift would cause d" | 285 | 6.43s |
| 2 | REVISE | "Plan was not executed: code is identical to original., Logic drift would cause d" | 285 | 6.26s |
| 3 | REVISE | "Plan was not executed: code is identical to original., Logic drift would cause d" | 294 | 6.35s |
| 4 | REVISE | "Plan was not executed: code is identical to original., Logic drift due to added " | 427 | 10.96s |
| 5 | REVISE | "Plan was not executed: code is identical to original., Logic drift would cause d" | 285 | 6.31s |
- **Accuracy:** 5/5
- **Consistency:** unanimous
- **Raw verdicts:** `['REVISE', 'REVISE', 'REVISE', 'REVISE', 'REVISE']`

#### What happened
All 5 runs matched the expected verdict. Judge performed correctly.

#### Why this likely happened
Within the model's reliable range — clear structural signals make verdict straightforward. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code introduces a logic drift by adding an extra fee to the tax calculation, which was not specified in the plan. This change causes different behavior for certain inputs.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift would cause different behavior.\"] }"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code introduces a logic drift by adding an extra fee to the tax calculation, which was not specified in the plan. This change causes different behavior for certain inputs.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift would cause different behavior.\"] }"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code introduces a logic drift by adding an extra fee to the tax calculation, which was not specified in the original plan. This change causes different behavior for certain inputs.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift would cause different behavior.\"] }"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code introduces a logic drift by adding an extra fee to the tax calculation, which was not specified in the original intent. For example, if price = 100 and quantity = 2, calculateTotal would return 200 + (0.05 * 200) but computeTax would return 200 + (0.05 * 200) + (0.05 * 200), resulting in a different output.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift due to added extra fee.\"] }"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"x\", \"refactored\": \"y\", \"mapping\": null}], \"logic_comparison\": \"The refactored code introduces a logic drift by adding an extra fee to the tax calculation, which was not specified in the plan. This change causes different behavior for certain inputs.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original.\", \"Logic drift would cause different behavior.\"] }"
  }
]
```

### Case 10: revise_rename_broke_structural (expected: REVISE)

| Run | Verdict | Issues | Scratchpad len | Duration |
|-----|---------|--------|----------------|----------|
| 1 | REVISE | "Plan was not executed: code is identical to original" | 344 | 6.82s |
| 2 | REVISE | "Plan was not executed: RENAME_SYMBOL check->verify resulted in byte-for-byte ide" | 245 | 7.35s |
| 3 | REVISE | "Plan was not executed: RENAME_SYMBOL mutation did not change the code" | 340 | 8.3s |
| 4 | ACCEPT | "" | 259 | 5.14s |
| 5 | ACCEPT | "" | 245 | 4.63s |
- **Accuracy:** 3/5
- **Consistency:** 3-2 split
- **Raw verdicts:** `['REVISE', 'REVISE', 'REVISE', 'ACCEPT', 'ACCEPT']`

#### What happened
3/5 runs matched expected REVISE. 2 runs disagreed. Judge is inconsistent on this case.

#### Why this likely happened
Within the model's reliable range — clear structural signals make verdict straightforward. 

#### Raw output per run
```json
[
  {
    "run": 1,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"check\", \"refactored\": \"verify\"}], \"logic_comparison\": \"The refactored code has a different method name, but the logic remains unchanged. The original check(x) and refactored verify(x) methods have identical conditional paths with at least one concrete example: when x is 1, both return true.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: code is identical to original\"]}"
  },
  {
    "run": 2,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"check\", \"refactored\": \"verify\"}], \"logic_comparison\": \"Renaming 'check' to 'verify' does not change the logic of the method. The original and refactored code behave identically for all inputs.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: RENAME_SYMBOL check->verify resulted in byte-for-byte identical code despite plan intent\"]}"
  },
  {
    "run": 3,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"check\", \"refactored\": \"verify\"}], \"logic_comparison\": \"The refactored code has a different logic for the same inputs. For example, when x = 0, check returns false but verify also returns false (because of short-circuiting), whereas it should return true according to the original intent.\"}, \"verdict\": \"REVISE\", \"issues\": [\"Plan was not executed: RENAME_SYMBOL mutation did not change the code\"]}"
  },
  {
    "run": 4,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"check\", \"refactored\": \"verify\"}], \"logic_comparison\": \"Renaming 'check' to 'verify' does not change the logic of the method. The original and refactored methods produce the same outputs for the same inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  },
  {
    "run": 5,
    "content": "{\"audit_scratchpad\": {\"variable_trace\": [{\"original\": \"check\", \"refactored\": \"verify\"}], \"logic_comparison\": \"Renaming 'check' to 'verify' does not change the logic of the method. The original and refactored code behave identically for all inputs.\"}, \"verdict\": \"ACCEPT\", \"issues\": []}"
  }
]
```

---

## Cross-Case Analysis

### When Judge is reliable

| Pattern | Accuracy | Cases |
|---------|----------|-------|
| Obvious signature change (return type mismatch) | N/A |  |
| Code identical to original | N/A |  |
| Long scratchpad (> 200 chars) | 92% | revise_flatten_logic_inverted, revise_decompose_noop, revise_extract_method_wrong_params, revise_rename_broke_structural, accept_flatten_guard_clauses, accept_extract_constant_pi, accept_extract_method_tax, revise_extract_constant_broken_sig, accept_rename_symbol_field |

### When Judge is unreliable

| Pattern | Accuracy | Cases |
|---------|----------|-------|
| Correct code (false REVISE risk) | N/A |  |
| Short scratchpad (< 100 chars) | N/A |  |
| Complex multi-method refactoring | N/A |  |

### Scratchpad length vs accuracy

| Scratchpad | Runs | Accuracy |
|-----------|------|----------|
| 100-200 chars | 11 | 100% |
| > 200 chars | 39 | 92% |

---

## Raw Data

Full results as JSON saved to: `test_results/judge_isolated_results.json`