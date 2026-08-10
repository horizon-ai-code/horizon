# Horizon Dataset — Categorized Samples

30 entries selected from 279 total for analysis. Grouped by refactoring complexity profile.

## Selection Criteria

| Category | Filter | Candidates | Picked | ABORT |
|----------|--------|-----------|--------|-------|
| **Simple** | Easy + SUCCESS | 54 | 10 | 0 |
| **Edge** | Medium | 156 | 10 | 3 |
| **Complex** | Hard + SUCCESS | 40 | 10 | 0 |

Priority: SUCCESS exit_status over ABORT. Within same BER group, maximize intent diversity. Edge includes both SUCCESS and ABORT to capture boundary behavior.

## Summary

| Num | Category | Intent | Exit | BER | CC orig | CC delta | Lines |
|-----|----------|--------|------|-----|---------|----------|-------|
| 68 | Simple | DECOMPOSE_CONDITIONAL | SUCCESS | 1.0 | 6 | -1 | 17 |
| 424 | Simple | RENAME_SYMBOL | SUCCESS | 1.0 | 2 | 0 | 10 |
| 1060 | Simple | INLINE_VARIABLE | SUCCESS | 1.0 | 2 | 0 | 13 |
| 110 | Simple | EXTRACT_METHOD | SUCCESS | 0.0 | 4 | -1 | 8 |
| 144 | Simple | RENAME_SYMBOL | SUCCESS | 0.0 | 5 | 0 | 33 |
| 442 | Simple | REMOVE_CONTROL_FLAG | SUCCESS | 0.0 | 6 | -1 | 20 |
| 1343 | Simple | INLINE_METHOD | SUCCESS | 0.0 | 6 | 2 | 34 |
| 1510 | Simple | CONSOLIDATE_CONDITIONAL | SUCCESS | 0.0 | 4 | -1 | 29 |
| 2272 | Simple | EXTRACT_CONSTANT | SUCCESS | 0.0 | 8 | 0 | 11 |
| 2337 | Simple | DECOMPOSE_CONDITIONAL | SUCCESS | 0.0 | 4 | 0 | 7 |
| 18 | Edge | RENAME_SYMBOL | SUCCESS | 1.0 | 4 | 0 | 33 |
| 23 | Edge | DECOMPOSE_CONDITIONAL | SUCCESS | 1.0 | 3 | 0 | 11 |
| 76 | Edge | INLINE_METHOD | SUCCESS | 1.0 | 3 | 0 | 23 |
| 171 | Edge | RENAME_SYMBOL | SUCCESS | 1.0 | 2 | 0 | 10 |
| 584 | Edge | EXTRACT_CONSTANT | SUCCESS | 1.0 | 2 | 0 | 11 |
| 238 | Edge | FLATTEN_CONDITIONAL | ABORT_STRATEGY | 1.0 | 5 | 0 | 27 |
| 620 | Edge | CONSOLIDATE_CONDITIONAL | ABORT_STRATEGY | 1.0 | 5 | 0 | 27 |
| 305 | Edge | SPLIT_LOOP | SUCCESS | - | 4 | -1 | 15 |
| 1053 | Edge | RENAME_SYMBOL | ABORT_STRATEGY | 0.0 | 6 | 0 | 24 |
| 2227 | Edge | SPLIT_LOOP | SUCCESS | 0.0 | 6 | 0 | 49 |
| 217 | Complex | EXTRACT_METHOD | SUCCESS | 1.0 | 2 | 0 | 10 |
| 610 | Complex | EXTRACT_METHOD | SUCCESS | 1.0 | 2 | 0 | 11 |
| 1161 | Complex | EXTRACT_CONSTANT | SUCCESS | 1.0 | 3 | 0 | 13 |
| 125 | Complex | CONSOLIDATE_CONDITIONAL | SUCCESS | 0.0 | 8 | -1 | 70 |
| 131 | Complex | DECOMPOSE_CONDITIONAL | SUCCESS | 0.0 | 7 | -1 | 22 |
| 449 | Complex | EXTRACT_METHOD | SUCCESS | 0.0 | 5 | 0 | 20 |
| 661 | Complex | DECOMPOSE_CONDITIONAL | SUCCESS | 0.0 | 6 | 0 | 48 |
| 1014 | Complex | EXTRACT_METHOD | SUCCESS | 0.0 | 4 | -1 | 15 |
| 1785 | Complex | DECOMPOSE_CONDITIONAL | SUCCESS | 0.0 | 5 | 0 | 10 |
| 2155 | Complex | CONSOLIDATE_CONDITIONAL | SUCCESS | - | 7 | -3 | 28 |

## Category Averages

| Metric | Simple | Edge | Complex |
|--------|--------|------|---------|
| Avg lines | 18 | 23 | 25 |
| Avg CC | 4.7 | 4.0 | 4.9 |
| BER=1.0 | 3 | 7 | 3 |
| BER=0.0 | 7 | 1 | 6 |
| BER=- | 0 | 2 | 1 |
| ABORT | 0 | 3 | 0 |

---

## Simple

### #68 — DECOMPOSE_CONDITIONAL
> Decompose the compound condition `x == 0 || x == 1` in the mySqrt method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.

Exit: SUCCESS | BER: 1.0 | CC: 6 → 5 (-1) | Lines: 17

### #424 — RENAME_SYMBOL
> Rename the abbreviated variable names in the arrangeCoins method to descriptive names. Update every reference throughout the method.

Exit: SUCCESS | BER: 1.0 | CC: 2 → 2 (0) | Lines: 10

### #1060 — INLINE_VARIABLE
> Inline the local variable original in the isArmstrong method by replacing each occurrence of original with the expression it holds. Remove the variable declaration after inlining.

Exit: SUCCESS | BER: 1.0 | CC: 2 → 2 (0) | Lines: 13

### #110 — EXTRACT_METHOD
> Extract the core logic in the minDepth method into a private helper method called computeMinDepth. The helper should encapsulate the main algorithmic work. Call computeMinDepth from minDepth and pass the necessary parameters. Return the computed result from the helper.

Exit: SUCCESS | BER: 0.0 | CC: 4 → 3 (-1) | Lines: 8

### #144 — RENAME_SYMBOL
> Rename val to value throughout the entire postorderTraversal method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables.

Exit: SUCCESS | BER: 0.0 | CC: 5 → 5 (0) | Lines: 33

### #442 — REMOVE_CONTROL_FLAG
> Remove the boolean flag variable in the canConstruct method. Instead of setting the flag when the target is found and checking it after the loop, use an early return directly at the point where the condition is met.

Exit: SUCCESS | BER: 0.0 | CC: 6 → 5 (-1) | Lines: 20

### #1343 — INLINE_METHOD
> Inline the private helper method directly into its caller maxSumBST. Replace each call to helper(...) with the method body at the call site. Then remove the helper method declaration entirely.

Exit: SUCCESS | BER: 0.0 | CC: 6 → 8 (2) | Lines: 34

### #1510 — CONSOLIDATE_CONDITIONAL
> Consolidate the 4 separate loops in the solution method into a single pass. The current approach iterates over the same data structure multiple times. Merge the loop bodies to eliminate duplicate iteration and improve performance.

Exit: SUCCESS | BER: 0.0 | CC: 4 → 3 (-1) | Lines: 29

### #2272 — EXTRACT_CONSTANT
> Extract the magic number 1000000000 in the boxCategory method into a named constant at the class level as a static final field. Replace every occurrence of 1000000000 with the new constant name.

Exit: SUCCESS | BER: 0.0 | CC: 8 → 8 (0) | Lines: 11

### #2337 — DECOMPOSE_CONDITIONAL
> Decompose the compound condition `money < children * 1 || money > children * 8` in the maximumChildrenWithEightDollars method by extracting it into a boolean variable named isWithinRange defined before the if-statement. Replace the inline condition with the new variable.

Exit: SUCCESS | BER: 0.0 | CC: 4 → 4 (0) | Lines: 7

---

## Edge

### #18 — RENAME_SYMBOL
> Rename val to value throughout the entire removeNthFromEnd method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables.

Exit: SUCCESS | BER: 1.0 | CC: 4 → 4 (0) | Lines: 33

### #23 — DECOMPOSE_CONDITIONAL
> Decompose the compound condition `head == null || head.next == null` in the swapPairs method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.

Exit: SUCCESS | BER: 1.0 | CC: 3 → 3 (0) | Lines: 11

### #76 — INLINE_METHOD
> Inline the private backtrack helper method directly into its caller combine. Replace each call to backtrack(...) with the method body at the call site. Then remove the backtrack method declaration entirely.

Exit: SUCCESS | BER: 1.0 | CC: 3 → 3 (0) | Lines: 23

### #171 — RENAME_SYMBOL
> Rename the abbreviated variable names in the trailingZeroes method to descriptive names. Update every reference throughout the method.

Exit: SUCCESS | BER: 1.0 | CC: 2 → 2 (0) | Lines: 10

### #584 — EXTRACT_CONSTANT
> Extract the magic number 1000000007 in the findDerangement method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name.

Exit: SUCCESS | BER: 1.0 | CC: 2 → 2 (0) | Lines: 11

### #238 — FLATTEN_CONDITIONAL
> Flatten the nested if-else chain in the getFactors method using guard clauses with early returns. The method has nested conditional logic that makes the control flow hard to follow. Restructure so each guard clause handles one case at the top and returns immediately. Remove all nesting after refactoring.

Exit: ABORT_STRATEGY | BER: 1.0 | CC: 5 → 5 (0) | Lines: 27

### #620 — CONSOLIDATE_CONDITIONAL
> Consolidate the 3 separate loops in the maximumSwap method into a single pass. The current approach iterates over the same data structure multiple times. Merge the loop bodies to eliminate duplicate iteration and improve performance.

Exit: ABORT_STRATEGY | BER: 1.0 | CC: 5 → 5 (0) | Lines: 27

### #305 — SPLIT_LOOP
> Split the nested loop in the coinChange method into separate loops, each handling one distinct aspect of the computation. The current structure combines multiple responsibilities in a single nested loop, making the logic harder to follow.

Exit: SUCCESS | BER: - | CC: 4 → 3 (-1) | Lines: 15

### #1053 — RENAME_SYMBOL
> Rename sum to total throughout the entire longestWellPerformingInterval method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables.

Exit: ABORT_STRATEGY | BER: 0.0 | CC: 6 → 6 (0) | Lines: 24

### #2227 — SPLIT_LOOP
> Split the nested loop in the findMinMax method into separate loops, each handling one distinct aspect of the computation. The current structure combines multiple responsibilities in a single nested loop, making the logic harder to follow.

Exit: SUCCESS | BER: 0.0 | CC: 6 → 6 (0) | Lines: 49

---

## Complex

### #217 — EXTRACT_METHOD
> Extract the core logic in the countDigitOne method into a private helper method called computeCountDigitOne. The helper should encapsulate the main algorithmic work. Call computeCountDigitOne from countDigitOne and pass the necessary parameters. Return the computed result from the helper.

Exit: SUCCESS | BER: 1.0 | CC: 2 → 2 (0) | Lines: 10

### #610 — EXTRACT_METHOD
> Extract the core logic in the newInteger method into a private helper method called computeNewInteger. The helper should encapsulate the main algorithmic work. Call computeNewInteger from newInteger and pass the necessary parameters. Return the computed result from the helper.

Exit: SUCCESS | BER: 1.0 | CC: 2 → 2 (0) | Lines: 11

### #1161 — EXTRACT_CONSTANT
> Extract the magic number 1000000007 in the numberOfWays method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name.

Exit: SUCCESS | BER: 1.0 | CC: 3 → 3 (0) | Lines: 13

### #125 — CONSOLIDATE_CONDITIONAL
> Consolidate the 5 separate loops in the findLadders method into a single pass. The current approach iterates over the same data structure multiple times. Merge the loop bodies to eliminate duplicate iteration and improve performance.

Exit: SUCCESS | BER: 0.0 | CC: 8 → 7 (-1) | Lines: 70

### #131 — DECOMPOSE_CONDITIONAL
> Decompose the compound condition `s.charAt(i) == s.charAt(j) && (j - i < 2 || isPalindrome[i + 1][j - 1])` in the minCut method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.

Exit: SUCCESS | BER: 0.0 | CC: 7 → 6 (-1) | Lines: 22

### #449 — EXTRACT_METHOD
> Extract the core logic in the getMaxRepetitions method into a private helper method called computeGetMaxRepetitions. The helper should encapsulate the main algorithmic work. Call computeGetMaxRepetitions from getMaxRepetitions and pass the necessary parameters. Return the computed result from the helper.

Exit: SUCCESS | BER: 0.0 | CC: 5 → 5 (0) | Lines: 20

### #661 — DECOMPOSE_CONDITIONAL
> Decompose the compound condition `r >= 0 && c >= 0 && r < grid.length && c < grid[0].length && grid[r][c] == 1` in the dfs method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.

Exit: SUCCESS | BER: 0.0 | CC: 6 → 6 (0) | Lines: 48

### #1014 — EXTRACT_METHOD
> Extract the core logic in the countDigit method into a private helper method called computeCountDigit. The helper should encapsulate the main algorithmic work. Call computeCountDigit from countDigit and pass the necessary parameters. Return the computed result from the helper.

Exit: SUCCESS | BER: 0.0 | CC: 4 → 3 (-1) | Lines: 15

### #1785 — DECOMPOSE_CONDITIONAL
> Decompose the compound condition `s.charAt(i) != s.charAt(i + 1) && s.charAt(i) != s.charAt(i + 2) && s.charAt(i + 1) != s.charAt(i + 2)` in the countGoodSubstrings method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.

Exit: SUCCESS | BER: 0.0 | CC: 5 → 5 (0) | Lines: 10

### #2155 — CONSOLIDATE_CONDITIONAL
> Consolidate the 3 separate loops in the minDays method into a single pass. The current approach iterates over the same data structure multiple times. Merge the loop bodies to eliminate duplicate iteration and improve performance.

Exit: SUCCESS | BER: - | CC: 7 → 4 (-3) | Lines: 28
