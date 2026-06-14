# Planner Isolated Reasoning Report

**Date:** 2026-05-30T00:51:27.528443
**Model:** Qwen2.5-Coder-3B-Instruct
**Cases:** 15 code+instruction pairs
**Calls:** 45 (3 model calls per case: classifier → analysis → synthesis)

---

## Summary

| Metric | Result |
|--------|--------|
| Total cases | 15 |
| Classifier accuracy (intent matches expected) | 15/15 |
| Scope anchor validity (member+class exist in AST) | 14/15 |
| Analysis completeness (targets+preserve captured) | 15/15 |
| Plan executability (mutations reference real targets) | 15/15 |
| Hallucination rate (invented names in plan) | 2 hallucinations |
| Analysis→Plan coherence (plan references analysis items) | 9/15 |

---

## By Intent

| Intent | Cases | Class Acc | Scope | Analysis | Plan | Hallucinations |
|--------|-------|-----------|-------|----------|------|----------------|
| FLATTEN_CONDITIONAL | 3 | 3/3 | 2/3 | 3/3 | 3/3 | 0 |
| EXTRACT_METHOD | 3 | 3/3 | 3/3 | 3/3 | 3/3 | 2 |
| RENAME_SYMBOL | 2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 |
| EXTRACT_CONSTANT | 2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 |
| DECOMPOSE_CONDITIONAL | 2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 |
| SPLIT_LOOP | 2 | 2/2 | 2/2 | 2/2 | 2/2 | 0 |
| CONSOLIDATE_CONDITIONAL | 1 | 1/1 | 1/1 | 1/1 | 1/1 | 0 |

---

## Detailed Results

### Case 1: flat_demo_orderprocessor (FAIL)

- **Input:** code (1168 chars) + instruction "Refactor processOrder to use guard clauses. Invert nested if-statements to handl"
- **Expected intent:** FLATTEN_CONDITIONAL
- **Classifier output:** FLATTEN_CONDITIONAL ✓
- **Scope anchor:** ., METHOD_UNIT ✗ (class=False, member=True, hasClasses=True)
- **Analysis targets:** ['processOrder']
- **Analysis must_preserve:** ['Exception: IllegalArgumentException', "String: 'Order has no items'", "String: 'User account is inactive'"]
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 19.1s
- **Verdict:** FAIL

#### What happened
Scope anchor references code elements that do not exist in the AST. 

#### Why this likely happened
Long code (1168 chars) may exceed effective attention for 3B model. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction targets guard clauses and exception handling. Code has nested if-statements in processOrder method with immediate exceptions for invalid states at the top.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"FLATTEN_CONDITIONAL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\", \"class\": \"\", \"member\": \"\" } } }",
  "analysis": "{ \"analysis_scratchpad\": \"The goal is to refactor the processOrder method by using guard clauses and inverting nested if-statements. The primary targets are methods that need changes, such as those handling invalid states at the top with immediate exceptions.\", \"primary_targets\": [\"processOrder\"], \"secondary_targets\": [], \"new_structures_needed\": [], \"must_preserve\": [\"Exception: IllegalArgumentException\", \"String: 'Order has no items'\", \"String: 'User account is inactive'\"]}",
  "synthesis": "{ \"architect_scratchpad\": \"The goal is to refactor the processOrder method by using guard clauses and inverting nested if-statements. The primary targets are methods that need changes, such as those handling invalid states at the top with immediate exceptions.\", \"ast_modification_plan\": { \"target_class\": \"OrderProcessor\", \"ast_mutations\": [ { \"action\": \"MODIFY_METHOD\", \"target\": \"processOrder\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [{ \"name\": \"order\", \"type\": \"Order\" }, { \"name\": \"user\", \"type\": \"User\" }], \"logic_changes\": [\"Replace nested ifs with guard clauses using early returns/exceptions\"], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } }] }}"
}
```

### Case 2: flat_binary_search (PASS)

- **Input:** code (591 chars) + instruction "Flatten the nested if-else branches in the binary search. Use early return for t"
- **Expected intent:** FLATTEN_CONDITIONAL
- **Classifier output:** FLATTEN_CONDITIONAL ✓
- **Scope anchor:** None.None, METHOD_UNIT ✓
- **Analysis targets:** ['search']
- **Analysis must_preserve:** []
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 17.9s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Clean single-method code with unambiguous instruction — within the model's reliable operating range. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction targets nested if-else branches in the binary search. Code has multiple levels of conditional logic within the method. Category is CONTROL_FLOW, intent is FLATTEN_CONDITIONAL.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"FLATTEN_CONDITIONAL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The goal is to flatten the nested if-else branches and use early return for matching cases, while maintaining guard clauses for remaining checks.\", \"primary_targets\": [\"search\"], \"secondary_targets\": [], \"new_structures_needed\": [], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The primary target 'search' will be modified to use early return for the match case and guard clauses for remaining checks.\", \"ast_modification_plan\": { \"target_class\": \"BinarySearch\", \"ast_mutations\": [ { \"action\": \"MODIFY_METHOD\", \"target\": \"search\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"boolean\", \"parameters\": [{ \"name\": \"nums\", \"type\": \"int[]\" }, { \"name\": \"target\", \"type\": \"int\" }], \"logic_changes\": [ \"Replace nested ifs with guard clauses using early returns/exceptions\", \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" ], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } } ] }}"
}
```

### Case 3: flat_validate_ip (PASS)

- **Input:** code (347 chars) + instruction "Flatten the nested if-else in validateIP. Use early returns for each validation "
- **Expected intent:** FLATTEN_CONDITIONAL
- **Classifier output:** FLATTEN_CONDITIONAL ✓
- **Scope anchor:** String.validateIP, METHOD_UNIT ✓
- **Analysis targets:** ['validateIP']
- **Analysis must_preserve:** []
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 15.8s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Clean single-method code with unambiguous instruction — within the model's reliable operating range. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction targets conditional structure. Code has nested if-else statements in validateIP method. Category is CONTROL_FLOW, intent is FLATTEN_CONDITIONAL.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"FLATTEN_CONDITIONAL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\",\"class\":\"String\",\"member\":\"validateIP\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The goal is to flatten the nested if-else structure by using early returns for each validation case.\", \"primary_targets\": [\"validateIP\"], \"secondary_targets\": [], \"new_structures_needed\": [], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The goal is to flatten the nested if-else structure by using early returns for each validation case.\", \"ast_modification_plan\": { \"target_class\": \"String\", \"ast_mutations\": [ { \"action\": \"MODIFY_METHOD\", \"target\": \"validateIP\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"logic_changes\": [\"Replace nested ifs with guard clauses using early returns/exceptions\"], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } } ] } }"
}
```

### Case 4: extract_set_zeroes (FAIL)

- **Input:** code (641 chars) + instruction "Extract three private methods from setZeroes: markZeroMarkers for the first loop"
- **Expected intent:** EXTRACT_METHOD
- **Classifier output:** EXTRACT_METHOD ✓
- **Scope anchor:** None.None, CLASS_UNIT ✓
- **Analysis targets:** ['markZeroMarkers', 'setInnerZeros', 'setFirstRowColZeros']
- **Analysis must_preserve:** ['Exception: IllegalArgumentException', "String: 'Order has no items'"]
- **Plan mutations:** 14 mutations
- **Hallucinations:** markZeroMarkers, setInnerZeros
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 80.6s
- **Verdict:** FAIL

#### What happened
Invented identifiers in plan/analysis: ['markZeroMarkers', 'setInnerZeros']. 

#### Why this likely happened
Model likely generated from memory of similar patterns rather than from specific code analysis. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to extract methods from setZeroes. Code has a method with multiple nested loops and conditional checks. Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD.\", \"intent_packet\": { \"refactor_category\": \"METHOD_MOVEMENT\", \"specific_intent\": \"EXTRACT_METHOD\", \"scope_anchor\": { \"unit_type\": \"CLASS_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to extract three private methods: markZeroMarkers, setInnerZeros, and setFirstRowColZeros. The primary targets are these methods.\", \"primary_targets\": [\"markZeroMarkers\", \"setInnerZeros\", \"setFirstRowColZeros\"], \"secondary_targets\": [], \"new_structures_needed\": [\"private void markZeroMarkers(int[][] matrix) { ... }\", \"private void setInnerZeros(int[][] matrix, boolean firstRow, boolean firstCol) { ... }\", \"private void setFirstRowColZeros(int[][] matrix, boolean firstRow, boolean firstCol) { ... }\"], \"must_preserve\": [\"Exception: IllegalArgumentException\", \"String: 'Order has no items'\"]}",
  "synthesis": "{ \"architect_scratchpad\": \"The instruction asks to extract three private methods: markZeroMarkers, setInnerZeros, and setFirstRowColZeros. The primary targets are these methods.\", \"ast_modification_plan\": { \"target_class\": \"Solution\", \"ast_mutations\": [ { \"action\": \"ADD_METHOD\", \"target\": \"markZeroMarkers(int[][] matrix)\", \"details\": { \"modifiers\": [\"private\"], \"type\": \"void\", \"parameters\": [], \"logic_changes\": [\"Extract the logic for marking zero markers into a separate method.\"], \"body_abstract\": \"Iterate over each element in the matrix and mark it if it is zero. Update firstRow and firstCol flags accordingly.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"setInnerZeros(int[][] matrix, boolean firstRow, boolean firstCol)\", \"details\": { \"modifiers\": [\"private\"], \"type\": \"void\", \"parameters\": [ {\"name\":\"matrix\",\"type\":\"int[][]\"}, {\"name\":\"firstRow\",\"type\":\"boolean\"},{\"name\":\"firstCol\",\"type\":\"boolean\"}], \"logic_changes\": [\"Extract the logic for setting inner zeros into a separate method.\"], \"body_abstract\": \"Iterate over the matrix starting from (1, 1) and set elements to zero if they are marked by firstRow or firstCol flags.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"setFirstRowColZeros(int[][] matrix, boolean firstRow, boolean firstCol)\", \"details\": { \"modifiers\": [\"private\"], \"type\": \"void\", \"parameters\": [ {\"name\":\"matrix\",\"type\":\"int[][]\"}, {\"name\":\"firstRow\",\"type\":\"boolean\"},{\"name\":\"firstCol\",\"type\":\"boolean\"}], \"logic_changes\": [\"Extract the logic for setting first row and column zeros into a separate method.\"], \"body_abstract\": \"Set elements in the first row or column to zero if their corresponding flags are true.\" } }, { \"action\": \"REMOVE_METHOD\", \"target\": \"setZeroes(int[][] matrix)\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"logic_changes\": [\"Remove the original setZeroes method and replace it with calls to markZeroMarkers, setInnerZeros, and setFirstRowColZeros.\"], \"body_abstract\": \"Replace the entire body of the setZeroes method with calls to the newly created methods.\" } }, { \"action\": \"ADD_CONSTANT\", \"target\": \"Exception: IllegalArgumentException\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Add a constant for IllegalArgumentException if it is not already present in the code.\", \"Ensure that any references to this exception are updated accordingly.\"], \"body_abstract\": \"\" } }, { \"action\": \"ADD_CONSTANT\", \"target\": \"String: 'Order has no items'\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Add a constant for the string 'Order has no items' if it is not already present in the code.\", \"Ensure that any references to this string are updated accordingly.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"setZeroes(int[][] matrix)\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the setZeroes method to a more descriptive name if necessary.\", \"Update any references to this method in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"markZeroMarkers(int[][] matrix)\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the markZeroMarkers method if necessary.\", \"Update any references to this method in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"setInnerZeros(int[][] matrix, boolean firstRow, boolean firstCol)\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the setInnerZeros method if necessary.\", \"Update any references to this method in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"setFirstRowColZeros(int[][] matrix, boolean firstRow, boolean firstCol)\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the setFirstRowColZeros method if necessary.\", \"Update any references to this method in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"rows\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the variable rows if necessary.\", \"Update any references to this variable in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"cols\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the variable cols if necessary.\", \"Update any references to this variable in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"firstRow\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the variable firstRow if necessary.\", \"Update any references to this variable in the code.\"], \"body_abstract\": \"\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"firstCol\", \"details\": { \"modifiers\": [], \"type\": \"\", \"parameters\": [], \"logic_changes\": [\"Rename the variable firstCol if necessary.\", \"Update any references to this variable in the code.\"], \"body_abstract\": \"\" } } ] } }"
}
```

### Case 5: extract_tax_calculator (PASS)

- **Input:** code (320 chars) + instruction "Extract the tax calculation logic (tax computation and rounding) into a separate"
- **Expected intent:** EXTRACT_METHOD
- **Classifier output:** EXTRACT_METHOD ✓
- **Scope anchor:** Calculator.calculateTotal, CLASS_UNIT ✓
- **Analysis targets:** ['calculateTotal']
- **Analysis must_preserve:** []
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 23.4s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Clean single-method code with unambiguous instruction — within the model's reliable operating range. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to extract tax calculation logic into a separate method. Code has a calculateTotal method with nested calculations for subtotal, tax, and total. Category is METHOD_MOVEMENT, intent is EXTRACT_METHOD.\", \"intent_packet\": { \"refactor_category\": \"METHOD_MOVEMENT\", \"specific_intent\": \"EXTRACT_METHOD\", \"scope_anchor\": { \"unit_type\": \"CLASS_UNIT\",\"class\":\"Calculator\",\"member\":\"calculateTotal\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to extract the tax calculation logic into a separate private method called computeTaxWithRounding. This involves moving the computation of tax and rounding it out of the calculateTotal method.\", \"primary_targets\": [\"calculateTotal\"], \"secondary_targets\": [], \"new_structures_needed\": [\"computeTaxWithRounding\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The instruction asks to extract the tax calculation logic into a separate private method called computeTaxWithRounding. This involves moving the computation of tax and rounding it out of the calculateTotal method.\", \"ast_modification_plan\": { \"target_class\": \"Calculator\", \"ast_mutations\": [ { \"action\": \"MODIFY_METHOD\", \"target\": \"calculateTotal\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"double\", \"parameters\": [{ \"name\": \"price\", \"type\": \"double\" }, { \"name\": \"quantity\", \"type\": \"int\" }, { \"name\": \"taxRate\", \"type\": \"double\" }], \"logic_changes\": [\"Replace nested ifs with guard clauses using early returns/exceptions\"], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } }] }}"
}
```

### Case 6: extract_prime_arrange (PASS)

- **Input:** code (535 chars) + instruction "Extract the Sieve of Eratosthenes logic into a separate method called countPrime"
- **Expected intent:** EXTRACT_METHOD
- **Classifier output:** EXTRACT_METHOD ✓
- **Scope anchor:** None.None, CLASS_UNIT ✓
- **Analysis targets:** ['numPrimeArrangements']
- **Analysis must_preserve:** []
- **Plan mutations:** 2 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 19.7s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Clean single-method code with unambiguous instruction — within the model's reliable operating range. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to extract Sieve of Eratosthenes logic into a separate method. Code contains the sieve algorithm in numPrimeArrangements, but it is not extracted yet.\", \"intent_packet\": { \"refactor_category\": \"METHOD_MOVEMENT\", \"specific_intent\": \"EXTRACT_METHOD\", \"scope_anchor\": { \"unit_type\": \"CLASS_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The Sieve of Eratosthenes logic is currently part of the numPrimeArrangements method. We need to extract this logic into a separate countPrimes method that returns the number of primes up to n.\", \"primary_targets\": [\"numPrimeArrangements\"], \"secondary_targets\": [], \"new_structures_needed\": [\"countPrimes(int)\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The Sieve of Eratosthenes logic is currently part of the numPrimeArrangements method. We need to extract this logic into a separate countPrimes method that returns the number of primes up to n.\", \"ast_modification_plan\": { \"target_class\": \"ClassName\", \"ast_mutations\": [ { \"action\": \"ADD_METHOD\", \"target\": \"countPrimes(int)\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"int\", \"parameters\": [], \"body_abstract\": \"Implement the Sieve of Eratosthenes algorithm to count primes up to n.\" } }, { \"action\": \"REMOVE_METHOD\", \"target\": \"numPrimeArrangements(int)\" , \"details\": {} } ] }}"
}
```

### Case 7: rename_user_manager (PASS)

- **Input:** code (136 chars) + instruction "Rename the field 'n' to 'username' and update all references."
- **Expected intent:** RENAME_SYMBOL
- **Classifier output:** RENAME_SYMBOL ✓
- **Scope anchor:** UserManager., CLASS_UNIT ✓
- **Analysis targets:** ['n']
- **Analysis must_preserve:** []
- **Plan mutations:** 3 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 23.5s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Clean single-method code with unambiguous instruction — within the model's reliable operating range. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to rename a field and update references. Code has a private String 'n' in UserManager class with getter and setter methods. Category is STATE_MANAGEMENT, intent is RENAME_SYMBOL.\", \"intent_packet\": { \"refactor_category\": \"STATE_MANAGEMENT\", \"specific_intent\": \"RENAME_SYMBOL\", \"scope_anchor\": { \"unit_type\": \"CLASS_UNIT\",\"class\":\"UserManager\",\"member\":\"\" } } }",
  "analysis": "{ \"analysis_scratchpad\": \"The field 'n' will be renamed to 'username', and all references in the class UserManager need to be updated.\", \"primary_targets\": [\"n\"], \"secondary_targets\": [\"getN\", \"setN\"], \"new_structures_needed\": [], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The field 'n' will be renamed to 'username', and all references in the class UserManager need to be updated.\", \"ast_modification_plan\": { \"target_class\": \"UserManager\", \"ast_mutations\": [ { \"action\": \"RENAME_SYMBOL\", \"target\": \"n\", \"details\": { \"type\": \"field\" } }, { \"action\": \"MODIFY_METHOD\", \"target\": \"getN\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"String\", \"parameters\": [], \"logic_changes\": [\"Replace 'this.n' with 'this.username'\", \"Update return statement to use 'username' instead of 'n'\"], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } }, { \"action\": \"MODIFY_METHOD\", \"target\": \"setN\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [ { \"name\": \"String n\" } ], \"logic_changes\": [\"Replace 'this.n = n;' with 'this.username = username;'\"], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } } ] } }"
}
```

### Case 8: rename_remove_nth (PASS)

- **Input:** code (421 chars) + instruction "Rename 'first' to 'fast', rename 'second' to 'slow' in removeNthFromEnd. Update "
- **Expected intent:** RENAME_SYMBOL
- **Classifier output:** RENAME_SYMBOL ✓
- **Scope anchor:** ListNode.removeNthFromEnd, METHOD_UNIT ✓
- **Analysis targets:** ['removeNthFromEnd']
- **Analysis must_preserve:** []
- **Plan mutations:** 2 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan misaligned ✗ — plan does not reference analysis targets
- **Duration:** 15.0s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Plan does not reference analysis items — model may have ignored the analysis step and generated plan independently. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction targets renaming variables. Code has 'first' and 'second' as local variables in removeNthFromEnd method. Category is STATE_MANAGEMENT, intent is RENAME_SYMBOL.\", \"intent_packet\": { \"refactor_category\": \"STATE_MANAGEMENT\", \"specific_intent\": \"RENAME_SYMBOL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\",\"class\":\"ListNode\",\"member\":\"removeNthFromEnd\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to rename 'first' and 'second' in the removeNthFromEnd method. This will affect all references within this method.\", \"primary_targets\": [\"removeNthFromEnd\"], \"secondary_targets\": [], \"new_structures_needed\": [], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"Rename 'first' to 'fast', rename 'second' to 'slow'.\", \"ast_modification_plan\": { \"target_class\": \"ListNode\", \"ast_mutations\": [ { \"action\": \"RENAME_SYMBOL\", \"target\": \"first\", \"details\": { \"type\": \"variable\" } }, { \"action\": \"RENAME_SYMBOL\", \"target\": \"second\", \"details\": { \"type\": \"variable\" } } ] } }"
}
```

### Case 9: const_abbreviation (PASS)

- **Input:** code (578 chars) + instruction "Extract the magic number '0' used in character-to-digit conversion into constant"
- **Expected intent:** EXTRACT_CONSTANT
- **Classifier output:** EXTRACT_CONSTANT ✓
- **Scope anchor:** ., METHOD_UNIT ✓
- **Analysis targets:** ['validWordAbbreviation']
- **Analysis must_preserve:** []
- **Plan mutations:** 2 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan misaligned ✗ — plan does not reference analysis targets
- **Duration:** 16.9s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Plan does not reference analysis items — model may have ignored the analysis step and generated plan independently. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to extract a magic number into constants. Code contains the digit '0' in character-to-digit conversion logic.\", \"intent_packet\": { \"refactor_category\": \"STATE_MANAGEMENT\", \"specific_intent\": \"EXTRACT_CONSTANT\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\", \"class\": \"\", \"member\": \"\" } } }",
  "analysis": "{ \"analysis_scratchpad\": \"The magic number '0' is used in character-to-digit conversion. We need to extract this into constants DIGIT_BASE and LEADING_ZERO_CHAR.\", \"primary_targets\": [\"validWordAbbreviation\"], \"secondary_targets\": [], \"new_structures_needed\": [\"DIGIT_BASE\", \"LEADING_ZERO_CHAR\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The magic number '0' is used in character-to-digit conversion. We need to extract this into constants DIGIT_BASE and LEADING_ZERO_CHAR.\", \"ast_modification_plan\": { \"target_class\": \"\", \"ast_mutations\": [ { \"action\": \"ADD_CONSTANT\", \"target\": \"DIGIT_BASE\", \"details\": { \"type\": \"int\", \"body_abstract\": \"The base for digit conversion.\" } }, { \"action\": \"ADD_CONSTANT\", \"target\": \"LEADING_ZERO_CHAR\", \"details\": { \"type\": \"char\", \"body_abstract\": \"Character representing leading zero in the abbreviation.\" } } ] } }"
}
```

### Case 10: const_circle_pi (PASS)

- **Input:** code (221 chars) + instruction "Extract the magic number 3.14159 into a named constant PI."
- **Expected intent:** EXTRACT_CONSTANT
- **Classifier output:** EXTRACT_CONSTANT ✓
- **Scope anchor:** Circle., CLASS_UNIT ✓
- **Analysis targets:** ['calculateArea', 'calculateCircumference']
- **Analysis must_preserve:** []
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan misaligned ✗ — plan does not reference analysis targets
- **Duration:** 14.6s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Constant appears in 2 methods — model may miss the cross-method dependency. Plan does not reference analysis items — model may have ignored the analysis step and generated plan independently. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to extract a magic number into a named constant. Code contains the value 3.14159 in calculateArea and calculateCircumference methods of Circle class.\", \"intent_packet\": { \"refactor_category\": \"STATE_MANAGEMENT\", \"specific_intent\": \"EXTRACT_CONSTANT\", \"scope_anchor\": { \"unit_type\": \"CLASS_UNIT\",\"class\":\"Circle\",\"member\":\"\" } } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to extract the magic number 3.14159 into a named constant PI.\", \"primary_targets\": [\"calculateArea\", \"calculateCircumference\"], \"secondary_targets\": [], \"new_structures_needed\": [\"PI\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The primary targets are calculateArea and calculateCircumference. The new structure needed is PI, which will be added as a constant.\", \"ast_modification_plan\": { \"target_class\": \"Circle\", \"ast_mutations\": [ { \"action\": \"ADD_CONSTANT\", \"target\": \"PI\", \"details\": { \"type\": \"double\", \"body_abstract\": \"3.14159\" } } ] } }"
}
```

### Case 11: decomp_closed_island (PASS)

- **Input:** code (770 chars) + instruction "Decompose the complex DFS boundary condition into well-named booleans: isInBound"
- **Expected intent:** DECOMPOSE_CONDITIONAL
- **Classifier output:** DECOMPOSE_CONDITIONAL ✓
- **Scope anchor:** None.None, METHOD_UNIT ✓
- **Analysis targets:** ['dfs']
- **Analysis must_preserve:** []
- **Plan mutations:** 5 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 33.5s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
DECOMPOSE is the hardest intent for 3B models — requires understanding multi-clause conditions and inventing named variables. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction targets decomposing a complex DFS boundary condition into well-named booleans. Code contains an implementation of the DFS algorithm in closedIsland method, which involves checking boundaries and unvisited cells. Category is CONTROL_FLOW, intent is DECOMPOSE_CONDITIONAL.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"DECOMPOSE_CONDITIONAL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to decompose the DFS boundary condition into well-named booleans: isInBounds, isOnBorder, and isUnvisited. This will help in making the code more readable and maintainable.\", \"primary_targets\": [\"dfs\"], \"secondary_targets\": [], \"new_structures_needed\": [\"isInBounds\", \"isOnBorder\", \"isUnvisited\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The instruction asks to decompose the DFS boundary condition into well-named booleans: isInBounds, isOnBorder, and isUnvisited. This will help in making the code more readable and maintainable.\", \"ast_modification_plan\": { \"target_class\": \"dfs\", \"ast_mutations\": [ { \"action\": \"MODIFY_METHOD\", \"target\": \"dfs\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"logic_changes\": [\"Replace nested ifs with guard clauses using early returns/exceptions\"], \"body_abstract\": \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"isInBounds\", \"details\": { \"modifiers\": [], \"type\": \"boolean\", \"parameters\": [ {\"name\":\"x\",\"type\":\"int\"}, {\"name\":\"y\",\"type\":\"int\"} ], \"body_abstract\": \"Check if the coordinates (x, y) are within bounds of the grid.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"isOnBorder\", \"details\": { \"modifiers\": [], \"type\": \"boolean\", \"parameters\": [ {\"name\":\"x\",\"type\":\"int\"}, {\"name\":\"y\",\"type\":\"int\"} ], \"body_abstract\": \"Check if the coordinates (x, y) are on any of the grid's borders.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"isUnvisited\", \"details\": { \"modifiers\": [], \"type\": \"boolean\", \"parameters\": [ {\"name\":\"x\",\"type\":\"int\"}, {\"name\":\"y\",\"type\":\"int\"} ], \"body_abstract\": \"Check if the coordinates (x, y) are unvisited in the grid.\" } }, { \"action\": \"ADD_FIELD\", \"target\": \"grid\", \"details\": { \"modifiers\": [], \"type\": \"int[][][]\" } } ] }}"
}
```

### Case 12: decomp_regex_dp (PASS)

- **Input:** code (617 chars) + instruction "Decompose the complex DP transition for the '*' character into a named boolean l"
- **Expected intent:** DECOMPOSE_CONDITIONAL
- **Classifier output:** DECOMPOSE_CONDITIONAL ✓
- **Scope anchor:** None.None, METHOD_UNIT ✓
- **Analysis targets:** ['isMatch']
- **Analysis must_preserve:** []
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan misaligned ✗ — plan does not reference analysis targets
- **Duration:** 20.7s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
DECOMPOSE is the hardest intent for 3B models — requires understanding multi-clause conditions and inventing named variables. Plan does not reference analysis items — model may have ignored the analysis step and generated plan independently. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to decompose the DP transition for '*' character into a named boolean. Code has a complex DP table with transitions involving '*', and category is CONTROL_FLOW, intent is DECOMPOSE_CONDITIONAL.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"DECOMPOSE_CONDITIONAL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to decompose the conditional logic involving '*' in the DP transition for the '*' character into a named boolean like matchesZeroOrMore.\", \"primary_targets\": [\"isMatch\"], \"secondary_targets\": [], \"new_structures_needed\": [\"boolean matchesZeroOrMore(int i, int j) { ... }\"], \"must_preserve\": []}",
  "synthesis": "{ \"architect_scratchpad\": \"The instruction asks to decompose the conditional logic involving '*' in the DP transition for the '*' character into a named boolean like matchesZeroOrMore.\", \"ast_modification_plan\": { \"target_class\": \"String\", \"ast_mutations\": [ { \"action\": \"ADD_METHOD\", \"target\": \"matchesZeroOrMore(int i, int j)\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"boolean\", \"parameters\": [{ \"name\": \"i\", \"type\": \"int\" }, { \"name\": \"j\", \"type\": \"int\" }], \"logic_changes\": [ \"Replace nested ifs with guard clauses using early returns/exceptions\", \"Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw.\" ], \"body_abstract\": \"Implement logic to determine if '*' matches zero or more characters in the DP transition for the '*' character.\" } } ] }}"
}
```

### Case 13: split_board_path (PASS)

- **Input:** code (454 chars) + instruction "Split the per-character loop into two separate methods: one for vertical movemen"
- **Expected intent:** SPLIT_LOOP
- **Classifier output:** SPLIT_LOOP ✓
- **Scope anchor:** None.None, METHOD_UNIT ✓
- **Analysis targets:** ['alphabetBoardPath']
- **Analysis must_preserve:** []
- **Plan mutations:** 2 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan misaligned ✗ — plan does not reference analysis targets
- **Duration:** 16.5s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Plan does not reference analysis items — model may have ignored the analysis step and generated plan independently. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to split the per-character loop into two separate methods. Code has a for/while/do-while loop in alphabetBoardPath method. Category is CONTROL_FLOW, intent is SPLIT_LOOP.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"SPLIT_LOOP\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The loop needs to be split into two separate methods for vertical and horizontal movement.\", \"primary_targets\": [\"alphabetBoardPath\"], \"secondary_targets\": [], \"new_structures_needed\": [\"verticalMove\", \"horizontalMove\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The loop needs to be split into two separate methods for vertical and horizontal movement.\", \"ast_modification_plan\": { \"target_class\": \"AlphabetBoardPath\", \"ast_mutations\": [ { \"action\": \"ADD_METHOD\", \"target\": \"verticalMove\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"body_abstract\": \"Iterate over the vertical movement logic.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"horizontalMove\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"body_abstract\": \"Iterate over the horizontal movement logic.\" } } ] }}"
}
```

### Case 14: split_unique_paths (PASS)

- **Input:** code (554 chars) + instruction "Split the DP initialization into separate methods: initFirstColumn and initFirst"
- **Expected intent:** SPLIT_LOOP
- **Classifier output:** SPLIT_LOOP ✓
- **Scope anchor:** None.None, METHOD_UNIT ✓
- **Analysis targets:** ['uniquePathsWithObstacles']
- **Analysis must_preserve:** []
- **Plan mutations:** 2 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan misaligned ✗ — plan does not reference analysis targets
- **Duration:** 20.7s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Plan does not reference analysis items — model may have ignored the analysis step and generated plan independently. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction asks to split the initialization of DP table into separate methods. Code has a nested loop for initializing the first column and row in uniquePathsWithObstacles method. Category is CONTROL_FLOW, intent is SPLIT_LOOP.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"SPLIT_LOOP\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The instruction asks to split the DP initialization into separate methods: initFirstColumn and initFirstRow. The code contains a nested loop that initializes the first column and row of the grid based on obstacles.\", \"primary_targets\": [\"uniquePathsWithObstacles\"], \"secondary_targets\": [], \"new_structures_needed\": [\"initFirstColumn\", \"initFirstRow\"], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The instruction asks to split the DP initialization into separate methods: initFirstColumn and initFirstRow. The code contains a nested loop that initializes the first column and row of the grid based on obstacles.\", \"ast_modification_plan\": { \"target_class\": \"uniquePathsWithObstacles\", \"ast_mutations\": [ { \"action\": \"ADD_METHOD\", \"target\": \"initFirstColumn\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"body_abstract\": \"Initialize the first column of the grid based on obstacles.\" } }, { \"action\": \"ADD_METHOD\", \"target\": \"initFirstRow\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"void\", \"parameters\": [], \"body_abstract\": \"Initialize the first row of the grid based on obstacles.\" } } ] } }"
}
```

### Case 15: cons_word_pattern (PASS)

- **Input:** code (296 chars) + instruction "Consolidate the two base-case checks at the top of backtrack into a single if-el"
- **Expected intent:** CONSOLIDATE_CONDITIONAL
- **Classifier output:** CONSOLIDATE_CONDITIONAL ✓
- **Scope anchor:** None.None, METHOD_UNIT ✓
- **Analysis targets:** ['backtrack']
- **Analysis must_preserve:** []
- **Plan mutations:** 1 mutations
- **Hallucinations:** None
- **Coherence:** Analysis→Plan aligned ✓
- **Duration:** 21.1s
- **Verdict:** PASS

#### What happened
Model correctly classified intent, identified valid targets, and produced executable plan with no hallucinations. 

#### Why this likely happened
Clean single-method code with unambiguous instruction — within the model's reliable operating range. 

#### Raw output
```json
{
  "classifier": "{ \"classification_scratchpad\": \"Instruction targets consolidating base-case checks. Code has two separate if-else statements at the top of backtrack method. Category is CONTROL_FLOW, intent is CONSOLIDATE_CONDITIONAL.\", \"intent_packet\": { \"refactor_category\": \"CONTROL_FLOW\", \"specific_intent\": \"CONSOLIDATE_CONDITIONAL\", \"scope_anchor\": { \"unit_type\": \"METHOD_UNIT\"} } }",
  "analysis": "{ \"analysis_scratchpad\": \"The primary target is the `backtrack` method, which contains two base-case checks. The secondary targets are any methods that call `backtrack`, as well as fields referenced by these calls.\", \"primary_targets\": [\"backtrack\"], \"secondary_targets\": [], \"new_structures_needed\": [], \"must_preserve\": [] }",
  "synthesis": "{ \"architect_scratchpad\": \"The primary target is the `backtrack` method, which contains two base-case checks. The secondary targets are any methods that call `backtrack`, as well as fields referenced by these calls.\", \"ast_modification_plan\": { \"target_class\": \"ClassName\", \"ast_mutations\": [ { \"action\": \"MODIFY_METHOD\", \"target\": \"backtrack\", \"details\": { \"modifiers\": [\"public\"], \"type\": \"boolean\", \"parameters\": [{ \"name\": \"pattern\", \"type\": \"String\" }, { \"name\": \"pi\", \"type\": \"int\" }, { \"name\": \"s\", \"type\": \"String\" }, { \"name\": \"si\", \"type\": \"int\" }], \"logic_changes\": [\"Replace nested ifs with a single if-else statement to consolidate the base-case checks\"], \"body_abstract\": \"If both pi and si are equal to their respective lengths, return true. Otherwise, if either is greater than its length, return false.\" } }] }}"
}
```

---

## Cross-Case Analysis

### Planner succeeds reliably when:

| Pattern | Pass rate | Cases |
|---------|-----------|-------|
| Single-method code | 9/11 | flat_demo_orderprocessor, flat_binary_search, flat_validate_ip, extract_set_zeroes, extract_tax_calculator, extract_prime_arrange, rename_remove_nth, const_abbreviation, decomp_regex_dp, split_board_path, split_unique_paths |
| Short code (< 400 chars) | 5/5 | flat_validate_ip, extract_tax_calculator, rename_user_manager, const_circle_pi, cons_word_pattern |
| FLATTEN_CONDITIONAL intent | 2/3 | flat_demo_orderprocessor, flat_binary_search, flat_validate_ip |
| RENAME_SYMBOL intent | 2/2 | rename_user_manager, rename_remove_nth |

### Planner struggles when:

| Pattern | Pass rate | Cases |
|---------|-----------|-------|
| Multi-method code (> 2 methods) | N/A |  |
| Long code (> 800 chars) | 0/1 | flat_demo_orderprocessor |
| DECOMPOSE_CONDITIONAL intent | 2/2 | decomp_closed_island, decomp_regex_dp |
| EXTRACT_CONSTANT with multiple methods | 1/1 | const_circle_pi |

---

## Raw Data

Full results as JSON saved to: `test_results/planner_isolated_results.json`