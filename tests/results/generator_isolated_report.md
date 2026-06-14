# Generator Isolated Reasoning Report

**Date:** 2026-06-02T01:22:39.780481
**Model:** Qwen2.5-Coder-3B-Instruct
**Cases:** 14 (11 real plans + 3 bad-plan stress tests)

---

## Summary

| Metric | Result |
|--------|--------|
| Total cases | 14 |
| Syntax pass rate | 14/14 (100%) |
| Plan compliance rate (real cases) | 11/11 |
| Planned elements present (total / total expected) | 18 / 18 |
| Anti-pattern violation rate (real cases) | 2/11 |
| Bad-plan graceful handling | 3/3 |

---

## By Intent

| Intent | Cases | Syntax | Compliance | Anti-patterns |
|--------|-------|--------|------------|---------------|
| EXTRACT_METHOD | 3 | 3/3 | 3/3 | 0/3 |
| FLATTEN_CONDITIONAL | 2 | 2/2 | 2/2 | 2/2 |
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
- **Duration:** 4.17s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Calculator",
  "ast_mutations": [
    {
      "action": "ADD_METHOD",
      "target": "computeTaxWithRounding",
      "details": {
        "modifiers": [
          "private"
        ],
        "type": "double",
        "parameters": [
          {
            "type": "double",
            "name": "subtotal"
          },
          {
            "type": "double",
            "name": "taxRate"
          }
        ],
        "logic_changes": [
          "Extract tax calculation and rounding"
        ],
        "body_abstract": "Compute tax, add to subtotal, round to 2 decimal places, return result"
      }
    },
    {
      "action": "MODIFY_METHOD",
      "target": "calculateTotal",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "double",
        "parameters": [
          {
            "type": "double",
            "name": "price"
          },
          {
            "type": "int",
            "name": "quantity"
          },
          {
            "type": "double",
            "name": "taxRate"
          }
        ],
        "logic_changes": [
          "Replace tax logic with call to computeTaxWithRounding"
        ],
        "body_abstract": "Compute subtotal from price*quantity, call computeTaxWithRounding, return result"
      }
    }
  ]
}
```

#### Generated output
```java
public class Calculator {
    private double computeTaxWithRounding(double subtotal, double taxRate) {
        double tax = subtotal * taxRate;
        return Math.round((subtotal + tax) * 100.0) / 100.0;
    }

    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double totalWithTax = computeTaxWithRounding(subtotal, taxRate);
        return totalWithTax;
    }
}
```

### Case 2: gen_extract_prime_count (PASS)

- **Input:** code (535 chars) + plan with 2 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 2/2 present
  - ADD_METHOD(countPrimes) — present ✓
  - MODIFY_METHOD(numPrimeArrangements) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 9.39s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Solution",
  "ast_mutations": [
    {
      "action": "ADD_METHOD",
      "target": "countPrimes",
      "details": {
        "modifiers": [
          "private"
        ],
        "type": "int",
        "parameters": [
          {
            "type": "int",
            "name": "n"
          }
        ],
        "logic_changes": [
          "Extract Sieve of Eratosthenes"
        ],
        "body_abstract": "Run Sieve up to n, return count of primes"
      }
    },
    {
      "action": "MODIFY_METHOD",
      "target": "numPrimeArrangements",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "int",
        "parameters": [
          {
            "type": "int",
            "name": "n"
          }
        ],
        "logic_changes": [
          "Replace sieve logic with call to countPrimes"
        ],
        "body_abstract": "Call countPrimes(n), compute factorial result, return as int"
      }
    }
  ]
}
```

#### Generated output
```java
public class Solution {
    private int countPrimes(int n) {
        boolean[] isPrime = new boolean[n + 1];
        Arrays.fill(isPrime, true); 
        isPrime[0] = false; 
        isPrime[1] = false;
        
        for (int i = 2; i * i <= n; i++) if (isPrime[i])
            for (int j = i * i; j <= n; j += i) isPrime[j] = false;

        int pc = 0; 
        for (int i = 2; i <= n; i++) if (isPrime[i]) pc++;
        
        return pc;
    }

    public int numPrimeArrangements(int n) {
        int pc = countPrimes(n);
        int cc = n - pc;

        long res = 1; 
        int MOD = 1000000007;
        for (int i = 1; i <= pc; i++) res = res * i % MOD;
        for (int i = 1; i <= cc; i++) res = res * i % MOD;

        return (int) res;
    }
}
```

### Case 3: gen_extract_set_zeroes_helpers (PASS)

- **Input:** code (641 chars) + plan with 2 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 2/2 present
  - ADD_METHOD(markZeroes) — present ✓
  - MODIFY_METHOD(setZeroes) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 13.18s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Solution",
  "ast_mutations": [
    {
      "action": "ADD_METHOD",
      "target": "markZeroes",
      "details": {
        "modifiers": [
          "private"
        ],
        "type": "void",
        "parameters": [
          {
            "type": "int[][]",
            "name": "matrix"
          }
        ],
        "logic_changes": [
          "Extract zero-marking logic"
        ],
        "body_abstract": "Find zeros, mark first row and first column"
      }
    },
    {
      "action": "MODIFY_METHOD",
      "target": "setZeroes",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "void",
        "parameters": [
          {
            "type": "int[][]",
            "name": "matrix"
          }
        ],
        "logic_changes": [
          "Call markZeroes then apply row/col zeroing"
        ],
        "body_abstract": "Call markZeroes(matrix), then set rows/cols to zero"
      }
    }
  ]
}
```

#### Generated output
```java
public class Solution {
    private void markZeroes(int[][] matrix) {
        int rows = matrix.length, cols = matrix[0].length;
        boolean firstRow = false, firstCol = false;

        for (int i = 1; i < rows; i++) {
            for (int j = 1; j < cols; j++) {
                if (matrix[i][j] == 0) {
                    matrix[i][0] = 0;
                    matrix[0][j] = 0;
                }
            }
        }

        for (int i = 1; i < rows; i++) {
            for (int j = 1; j < cols; j++) {
                if (matrix[i][0] == 0 || matrix[0][j] == 0) {
                    matrix[i][j] = 0;
                }
            }
        }

        if (firstRow) {
            for (int j = 0; j < cols; j++) {
                matrix[0][j] = 0;
            }
        }

        if (firstCol) {
            for (int i = 0; i < rows; i++) {
                matrix[i][0] = 0;
            }
        }
    }

    public void setZeroes(int[][] matrix) {
        markZeroes(matrix);
        int rows = matrix.length, cols = matrix[0].length;

        if (matrix[0][0] == 0) for (int j = 1; j < cols; j++) matrix[0][j] = 0;
        if (matrix[0][0] == 0) for (int i = 1; i < rows; i++) matrix[i][0] = 0;

    }
}
```

### Case 4: gen_flatten_orderprocessor (FAIL)

- **Input:** code (1168 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - MODIFY_METHOD(processOrder) — ok ✓
- **Anti-pattern violations:** May have merged guard clause exception messages, Original exception messages lost: {'Order has no items.', 'Order cannot be null.'} ✗
- **Duration:** 6.11s
- **Verdict:** FAIL

#### What happened
Anti-pattern violations: ['May have merged guard clause exception messages', "Original exception messages lost: {'Order has no items.', 'Order cannot be null.'}"]. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "OrderProcessor",
  "ast_mutations": [
    {
      "action": "MODIFY_METHOD",
      "target": "processOrder",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "void",
        "parameters": [
          {
            "type": "Order",
            "name": "order"
          },
          {
            "type": "User",
            "name": "user"
          }
        ],
        "logic_changes": [
          "Replace nested ifs with guard clauses using early exceptions"
        ],
        "body_abstract": "Invert all conditionals. Each original exception becomes a guard clause at the top with immediate throw."
      }
    }
  ]
}
```

#### Generated output
```java
public class OrderProcessor {
    public void processOrder(Order order, User user) throws IllegalArgumentException, IllegalStateException {
        if (user == null) {
            throw new IllegalArgumentException("User cannot be null.");
        }
        
        if (!user.isActive()) {
            throw new IllegalStateException("User account is inactive.");
        }

        if (order == null || order.getItems().isEmpty()) {
            throw new IllegalArgumentException("Order has no items or is null.");
        }

        double total = order.getTotal();
        if (total > 1000) {
            if (!user.isPremium()) {
                order.applyDiscount(0.05);
            }
        } else {
            order.applyDiscount(0.15);
        }

        System.out.println("Processing order for: " + user.getName());
    }
}
```

### Case 5: gen_flatten_simple_ifs (FAIL)

- **Input:** code (272 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - MODIFY_METHOD(process) — ok ✓
- **Anti-pattern violations:** May have merged guard clause exception messages, Original exception messages lost: {'y is null', 'x is null'} ✗
- **Duration:** 2.28s
- **Verdict:** FAIL

#### What happened
Anti-pattern violations: ['May have merged guard clause exception messages', "Original exception messages lost: {'y is null', 'x is null'}"]. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Processor",
  "ast_mutations": [
    {
      "action": "MODIFY_METHOD",
      "target": "process",
      "details": {
        "modifiers": [],
        "type": "void",
        "parameters": [
          {
            "type": "Object",
            "name": "x"
          },
          {
            "type": "Object",
            "name": "y"
          }
        ],
        "logic_changes": [
          "Flatten nested ifs to guard clauses"
        ],
        "body_abstract": "Check x==null throw, check y==null throw, then doWork"
      }
    }
  ]
}
```

#### Generated output
```java
void process(Object x, Object y) {
    if (x == null || y == null) {
        throw new IllegalArgumentException(x != null ? "y is null" : "x is null");
    }
    doWork(x, y);
}
```

### Case 6: gen_rename_field (PASS)

- **Input:** code (136 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - RENAME_SYMBOL(n) — old name absent ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 1.71s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "UserManager",
  "ast_mutations": [
    {
      "action": "RENAME_SYMBOL",
      "target": "n",
      "details": {
        "modifiers": [],
        "type": "String",
        "parameters": [],
        "logic_changes": [
          "Rename field n to username"
        ],
        "body_abstract": "Update field, getter, and setter to use username"
      }
    }
  ]
}
```

#### Generated output
```java
public class UserManager {
    private String username;
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
```

### Case 7: gen_rename_variables (PASS)

- **Input:** code (421 chars) + plan with 2 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 2/2 present
  - RENAME_SYMBOL(first) — old name absent ✓
  - RENAME_SYMBOL(second) — old name absent ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 4.68s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Solution",
  "ast_mutations": [
    {
      "action": "RENAME_SYMBOL",
      "target": "first",
      "details": {
        "modifiers": [],
        "type": "",
        "parameters": [],
        "logic_changes": [
          "Rename first to fast"
        ],
        "body_abstract": ""
      }
    },
    {
      "action": "RENAME_SYMBOL",
      "target": "second",
      "details": {
        "modifiers": [],
        "type": "",
        "parameters": [],
        "logic_changes": [
          "Rename second to slow"
        ],
        "body_abstract": ""
      }
    }
  ]
}
```

#### Generated output
```java
class ListNode { int val; ListNode next; ListNode(int x) { val = x; } }
public ListNode removeNthFromEnd(ListNode head, int n) {
    ListNode fast = head;
    ListNode slow = head;
    for (int i = 0; i < n; i++) fast = fast.next;
    if (fast == null) { head = head.next; return head; }
    while (fast.next != null) { first = first.next; second = second.next; }
    second.next = second.next.next;
    return head;
}
```

### Case 8: gen_extract_pi_constant (PASS)

- **Input:** code (221 chars) + plan with 3 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 3/3 present
  - ADD_CONSTANT(PI) — present ✓
  - MODIFY_METHOD(calculateArea) — ok ✓
  - MODIFY_METHOD(calculateCircumference) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 2.8s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Circle",
  "ast_mutations": [
    {
      "action": "ADD_CONSTANT",
      "target": "PI",
      "details": {
        "modifiers": [
          "private",
          "static",
          "final"
        ],
        "type": "double",
        "parameters": [],
        "logic_changes": [],
        "body_abstract": ""
      }
    },
    {
      "action": "MODIFY_METHOD",
      "target": "calculateArea",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "double",
        "parameters": [
          {
            "type": "double",
            "name": "radius"
          }
        ],
        "logic_changes": [
          "Replace 3.14159 with PI"
        ],
        "body_abstract": ""
      }
    },
    {
      "action": "MODIFY_METHOD",
      "target": "calculateCircumference",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "double",
        "parameters": [
          {
            "type": "double",
            "name": "radius"
          }
        ],
        "logic_changes": [
          "Replace 3.14159 with PI"
        ],
        "body_abstract": ""
      }
    }
  ]
}
```

#### Generated output
```java
public class Circle {
    private static final double PI = 3.14159;

    public double calculateArea(double radius) {
        return PI * radius * radius;
    }

    public double calculateCircumference(double radius) {
        return 2 * PI * radius;
    }
}
```

### Case 9: gen_extract_mod_constant (PASS)

- **Input:** code (198 chars) + plan with 2 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 2/2 present
  - ADD_CONSTANT(MOD) — present ✓
  - MODIFY_METHOD(compute) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 3.14s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Solution",
  "ast_mutations": [
    {
      "action": "ADD_CONSTANT",
      "target": "MOD",
      "details": {
        "modifiers": [
          "private",
          "static",
          "final"
        ],
        "type": "int",
        "parameters": [],
        "logic_changes": [],
        "body_abstract": ""
      }
    },
    {
      "action": "MODIFY_METHOD",
      "target": "compute",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "int",
        "parameters": [
          {
            "type": "int",
            "name": "n"
          }
        ],
        "logic_changes": [
          "Replace 1000000007 with MOD constant"
        ],
        "body_abstract": ""
      }
    }
  ]
}
```

#### Generated output
```java
public class Solution {
    private static final int MOD = 1000000007;

    public int compute(int n) {
        int result = 1;
        for (int i = 1; i <= n; i++) {
            result = result * i % MOD;
        }
        return result;
    }
}
```

### Case 10: gen_decompose_simple (PASS)

- **Input:** code (176 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - MODIFY_METHOD(isEligible) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 3.48s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
DECOMPOSE is the hardest intent — requires creating multiple named booleans and restructuring conditions. 3B model capability limit. 

#### Plan fed to Generator
```json
{
  "target_class": "Checker",
  "ast_mutations": [
    {
      "action": "MODIFY_METHOD",
      "target": "isEligible",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "boolean",
        "parameters": [
          {
            "type": "int",
            "name": "age"
          },
          {
            "type": "double",
            "name": "income"
          },
          {
            "type": "int",
            "name": "score"
          }
        ],
        "logic_changes": [
          "Decompose compound condition into named booleans"
        ],
        "body_abstract": "Create boolean variables for each condition, combine with &&, return result"
      }
    }
  ]
}
```

#### Generated output
```java
public class Checker {
    public boolean isEligible(int age, double income, int score) {
        boolean meetsAgeRequirements = (age >= 18 && age <= 65);
        boolean hasHighIncome = (income > 30000);
        boolean hasGoodScore = (score > 650);

        return meetsAgeRequirements && hasHighIncome && hasGoodScore;
    }
}
```

### Case 11: gen_split_simple_loop (PASS)

- **Input:** code (190 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - MODIFY_METHOD(process) — ok ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 0.85s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Simple plan within model's reliable range. 

#### Plan fed to Generator
```json
{
  "target_class": "Processor",
  "ast_mutations": [
    {
      "action": "MODIFY_METHOD",
      "target": "process",
      "details": {
        "modifiers": [],
        "type": "void",
        "parameters": [
          {
            "type": "int[]",
            "name": "arr"
          }
        ],
        "logic_changes": [],
        "body_abstract": ""
      }
    }
  ]
}
```

#### Generated output
```java
public class Processor {
    void process(int[] arr) {}
}
```

### Case 12: bad_missing_target (PASS)

- **Input:** code (161 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 0/1 present
  - MODIFY_METHOD(nonExistentMethod) — not found ✗
- **Anti-pattern violations:** None ✓
- **Duration:** 1.66s
- **Verdict:** PASS

#### What happened
Only 0/1 planned elements present. All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
MODIFY_METHOD target doesn't exist in code. Generator treated it as valid instruction — plan is trusted blindly. 

#### Plan fed to Generator
```json
{
  "target_class": "Calculator",
  "ast_mutations": [
    {
      "action": "MODIFY_METHOD",
      "target": "nonExistentMethod",
      "details": {
        "modifiers": [
          "public"
        ],
        "type": "void",
        "parameters": [],
        "logic_changes": [
          "Change nothing"
        ],
        "body_abstract": ""
      }
    }
  ]
}
```

#### Generated output
```java
public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        return price * quantity * (1 + taxRate);
    }
}
```

### Case 13: bad_empty_mutations (PASS)

- **Input:** code (46 chars) + plan with 0 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 0/0 present
- **Anti-pattern violations:** None ✓
- **Duration:** 0.99s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Empty mutations list. Generator had nothing to change — returned original code (correct behavior). 

#### Plan fed to Generator
```json
{
  "target_class": "A",
  "ast_mutations": []
}
```

#### Generated output
```java
public class A {
    void m() { int x = 1; }
}
```

### Case 14: bad_hallucinated_add (PASS)

- **Input:** code (46 chars) + plan with 1 mutations
- **Syntax:** Valid ✓
- **Planned elements:** 1/1 present
  - ADD_METHOD(xyZzZzZzHelperMethod) — present ✓
- **Anti-pattern violations:** None ✓
- **Duration:** 1.73s
- **Verdict:** PASS

#### What happened
All planned elements created, syntax valid, no anti-pattern violations. 

#### Why this likely happened
Hallucinated ADD_METHOD name. Generator created the method — treats all plan entries as authoritative. 

#### Plan fed to Generator
```json
{
  "target_class": "A",
  "ast_mutations": [
    {
      "action": "ADD_METHOD",
      "target": "xyZzZzZzHelperMethod",
      "details": {
        "modifiers": [
          "private"
        ],
        "type": "void",
        "parameters": [],
        "logic_changes": [
          "Do something"
        ],
        "body_abstract": ""
      }
    }
  ]
}
```

#### Generated output
```java
public class A {
    void m() { int x = 1; }

    private void xyZzZzZzHelperMethod() {
        Do something;
    }
}
```

---

## Cross-Case Analysis

### Generator succeeds reliably when:

| Pattern | Pass rate | Cases |
|---------|-----------|-------|
| Single mutation plan | 5/7 | gen_flatten_orderprocessor, gen_flatten_simple_ifs, gen_rename_field, gen_decompose_simple, gen_split_simple_loop, bad_missing_target, bad_hallucinated_add |
| RENAME_SYMBOL plan | 2/2 | gen_rename_field, gen_rename_variables |
| Short code (< 400 chars) | 9/10 | gen_extract_tax_helper, gen_flatten_simple_ifs, gen_rename_field, gen_extract_pi_constant, gen_extract_mod_constant, gen_decompose_simple, gen_split_simple_loop, bad_missing_target, bad_empty_mutations, bad_hallucinated_add |
| ADD_CONSTANT plan | 2/2 | gen_extract_pi_constant, gen_extract_mod_constant |

### Generator struggles when:

| Pattern | Pass rate | Cases |
|---------|-----------|-------|
| Multi-mutation plan (> 4 mutations) | N/A |  |
| DECOMPOSE_CONDITIONAL plan | 1/1 | gen_decompose_simple |
| FLATTEN_CONDITIONAL with exceptions | N/A |  |

---

## Raw Data

Full results as JSON saved to: `test_results/generator_isolated_results.json`