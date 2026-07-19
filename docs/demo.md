# Behavioral Equivalence Passed Results — Multi-Agent Pipeline

**14 entries** with `ber=1.0` (behavioral equivalence **passed**), `exit_status=SUCCESS`, compiled and tested.

---

## Summary

| Metric | Value |
|--------|-------|
| Total BER-passed entries | 14 |
| Total compiled SUCCESS exits | 113 |
| BER pass rate | 14/113 = 12.39% |
| BER failure rate | 99/113 = 87.61% |
| Average duration | 65866ms (65.9s) |
| Average CC delta | +0.00 |
| Average MI delta | -3.06 |

### By Intent

| Intent | Count |
|--------|-------|
| DECOMPOSE_CONDITIONAL | 3 |
| EXTRACT_CONSTANT | 2 |
| EXTRACT_METHOD | 2 |
| INLINE_METHOD | 2 |
| INLINE_VARIABLE | 1 |
| RENAME_SYMBOL | 4 |

### By Difficulty

| Difficulty | Count |
|------------|-------|
| Easy | 3 |
| Medium | 8 |
| Hard | 3 |

---

### 1060. INLINE_VARIABLE (Easy)

**Duration:** 35050ms | **CC delta:** +0 | **MI delta:** -0.62

| Field | Value |
|-------|-------|
| Intent | INLINE_VARIABLE |
| Difficulty | Easy |
| Duration | 35050ms |
| CC delta | +0 |
| MI delta | -0.62 |
| Gen steps | 2 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Inline the local variable original in the isArmstrong method by replacing each occurrence of original with the expression it holds. Remove the variable declaration after inlining.
```

**Source Code:**
```java
public class Solution {
    public boolean isArmstrong(int n) {
        int power_sum = 0;
        int original = n;
        int k = String.valueOf(n).length();
        while (n > 0) {
            int digit = n % 10;
            power_sum += Math.pow(digit, k);
            n /= 10;
        }
        return power_sum == original;
    }
}
```

### 424. RENAME_SYMBOL (Easy)

**Duration:** 38589ms | **CC delta:** +0 | **MI delta:** +0.00

| Field | Value |
|-------|-------|
| Intent | RENAME_SYMBOL |
| Difficulty | Easy |
| Duration | 38589ms |
| CC delta | +0 |
| MI delta | +0.00 |
| Gen steps | 2 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Rename the abbreviated variable names in the arrangeCoins method to descriptive names. Update every reference throughout the method.
```

**Source Code:**
```java
public class Solution {
    public int arrangeCoins(int n) {
        int k = 0;
        while (n > k) {
            k++;
            n -= k;
        }
        return k;
    }
}
```

### 302. RENAME_SYMBOL (Medium)

**Duration:** 39567ms | **CC delta:** +0 | **MI delta:** +0.00

| Field | Value |
|-------|-------|
| Intent | RENAME_SYMBOL |
| Difficulty | Medium |
| Duration | 39567ms |
| CC delta | +0 |
| MI delta | +0.00 |
| Gen steps | 2 |
| Strategy iter | 2 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 1 |

**Instruction:**
```
Rename the abbreviated variable names in the bulbSwitch method to descriptive names. Update every reference throughout the method.
```

**Source Code:**
```java
public class Solution {
    public int bulbSwitch(int n) {
        return (int)Math.sqrt(n);
    }
}
```

### 23. DECOMPOSE_CONDITIONAL (Medium)

**Duration:** 44659ms | **CC delta:** +0 | **MI delta:** -5.75

| Field | Value |
|-------|-------|
| Intent | DECOMPOSE_CONDITIONAL |
| Difficulty | Medium |
| Duration | 44659ms |
| CC delta | +0 |
| MI delta | -5.75 |
| Gen steps | 4 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Decompose the compound condition `head == null || head.next == null` in the swapPairs method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.
```

**Source Code:**
```java
public class Solution {
    public ListNode swapPairs(ListNode head) {
        if (head == null || head.next == null) return head;
    
        ListNode second = head.next;
        head.next = swapPairs(second.next);
        second.next = head;
    
        return second;
    }
}
```

### 1161. EXTRACT_CONSTANT (Hard)

**Duration:** 46793ms | **CC delta:** +0 | **MI delta:** +0.03

| Field | Value |
|-------|-------|
| Intent | EXTRACT_CONSTANT |
| Difficulty | Hard |
| Duration | 46793ms |
| CC delta | +0 |
| MI delta | +0.03 |
| Gen steps | 2 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Extract the magic number 1000000007 in the numberOfWays method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name.
```

**Source Code:**
```java
public class Solution {
    public int numberOfWays(int numPeople) {
        int MOD = 1000000007;
        int[] dp = new int[numPeople / 2 + 1];
        dp[0] = 1;
        for (int i = 1; i <= numPeople / 2; ++i) {
            for (int j = 1; j <= i; ++j) {
                dp[i] = (dp[i] + (int)(((long) dp[i - j] * dp[j - 1]) % MOD )) % MOD;
            }
        }
        return dp[numPeople / 2];
    }
}
```

### 610. EXTRACT_METHOD (Hard)

**Duration:** 54654ms | **CC delta:** +0 | **MI delta:** -6.76

| Field | Value |
|-------|-------|
| Intent | EXTRACT_METHOD |
| Difficulty | Hard |
| Duration | 54654ms |
| CC delta | +0 |
| MI delta | -6.76 |
| Gen steps | 5 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Extract the core logic in the newInteger method into a private helper method called computeNewInteger. The helper should encapsulate the main algorithmic work. Call computeNewInteger from newInteger and pass the necessary parameters. Return the computed result from the helper.
```

**Source Code:**
```java
public class Solution {
    public int newInteger(int n) {
        int result = 0, base = 1;
        while (n>0) {
            result += n % 9 * base;
            n /= 9;
            base *= 10;
        }
        return result;
    }
}
```

### 584. EXTRACT_CONSTANT (Medium)

**Duration:** 61151ms | **CC delta:** +0 | **MI delta:** +0.07

| Field | Value |
|-------|-------|
| Intent | EXTRACT_CONSTANT |
| Difficulty | Medium |
| Duration | 61151ms |
| CC delta | +0 |
| MI delta | +0.07 |
| Gen steps | 5 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Extract the magic number 1000000007 in the findDerangement method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name.
```

**Source Code:**
```java
public class Solution {
    public int findDerangement(int n) {
        final int MOD = 1000000007;
        long[] dp = new long[n + 1];
        dp[2] = 1;
        for (int i = 3; i <= n; ++i) {
            dp[i] = (i - 1) * (dp[i - 1] + dp[i - 2]) % MOD;
        }
        return (int)dp[n];
    }
}
```

### 76. INLINE_METHOD (Medium)

**Duration:** 61719ms | **CC delta:** +0 | **MI delta:** +0.00

| Field | Value |
|-------|-------|
| Intent | INLINE_METHOD |
| Difficulty | Medium |
| Duration | 61719ms |
| CC delta | +0 |
| MI delta | +0.00 |
| Gen steps | 0 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Inline the private backtrack helper method directly into its caller combine. Replace each call to backtrack(...) with the method body at the call site. Then remove the backtrack method declaration entirely.
```

**Source Code:**
```java
import java.util.ArrayList;
import java.util.List;

public class Solution {
    public List<List<Integer>> combine(int n, int k) {
        List<List<Integer>> result = new ArrayList<>();
        backtrack(n, k, 1, new ArrayList<>(), result);
        return result;
    }

    private void backtrack(int n, int k, int start, List<Integer> current, List<List<Integer>> result) {
        if (current.size() == k) {
            result.add(new ArrayList<>(current));
            return;
        }

        for (int i = start; i <= n; i++) {
            current.add(i);
            backtrack(n, k, i + 1, current, result);
            current.remove(current.size() - 1);
        }
    }
}
```

### 1113. INLINE_METHOD (Medium)

**Duration:** 66352ms | **CC delta:** +0 | **MI delta:** -13.89

| Field | Value |
|-------|-------|
| Intent | INLINE_METHOD |
| Difficulty | Medium |
| Duration | 66352ms |
| CC delta | +0 |
| MI delta | -13.89 |
| Gen steps | 0 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Inline the private gcd helper method directly into its caller nthUglyNumber. Replace each call to gcd(...) with the method body at the call site. Then remove the gcd method declaration entirely.
```

**Source Code:**
```java
public class Solution {
    public int nthUglyNumber(int n, int a, int b, int c) {
        long left = 1, right = (long) 2e9, gcd_ab = gcd(a, b), gcd_ac = gcd(a, c), gcd_bc = gcd(b, c);
        long lcm_ab = a / gcd_ab * b, lcm_ac = a / gcd_ac * c, lcm_bc = b / gcd_bc * c, lcm_abc = a / gcd_ab * lcm_bc;
    
        while (left < right) {
            long mid = left + (right - left) / 2;
            long count = mid / a + mid / b + mid / c - mid / lcm_ab - mid / lcm_ac - mid / lcm_bc + mid / lcm_abc;
            if (count < n) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        return (int) left;
    }

    private long gcd(long a, long b) {
        return b == 0 ? a : gcd(b, a % b);
    }
}
```

### 217. EXTRACT_METHOD (Hard)

**Duration:** 66793ms | **CC delta:** +0 | **MI delta:** -6.31

| Field | Value |
|-------|-------|
| Intent | EXTRACT_METHOD |
| Difficulty | Hard |
| Duration | 66793ms |
| CC delta | +0 |
| MI delta | -6.31 |
| Gen steps | 4 |
| Strategy iter | 1 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Extract the core logic in the countDigitOne method into a private helper method called computeCountDigitOne. The helper should encapsulate the main algorithmic work. Call computeCountDigitOne from countDigitOne and pass the necessary parameters. Return the computed result from the helper.
```

**Source Code:**
```java
public class Solution {
    public int countDigitOne(int n) {
        int count = 0;
        for(long i = 1; i <= n; i *= 10){
            long divider = i * 10;
            count += (n / divider) * i + Math.min(Math.max(n % divider - i + 1, 0), i);
        }
        return count;
    }
}
```

### 18. RENAME_SYMBOL (Medium)

**Duration:** 68492ms | **CC delta:** +0 | **MI delta:** +0.00

| Field | Value |
|-------|-------|
| Intent | RENAME_SYMBOL |
| Difficulty | Medium |
| Duration | 68492ms |
| CC delta | +0 |
| MI delta | +0.00 |
| Gen steps | 2 |
| Strategy iter | 2 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 1 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 2 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Rename val to value throughout the entire removeNthFromEnd method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables.
```

**Source Code:**
```java
public class ListNode {
    int val;
    ListNode next;
    ListNode(int x) { val = x; }
}

public class Solution {
    public 


    public ListNode removeNthFromEnd(ListNode head, int n) {
        ListNode first = head;
        ListNode second = head;
    
        for (int i = 0; i < n; i++) {
            first = first.next;
        }
    
        if (first == null) {
            head = head.next;
            return head;
        }
    
        while (first.next != null) {
            first = first.next;
            second = second.next;
        }

        second.next = second.next.next;
    
        return head;
    }
}
```

### 171. RENAME_SYMBOL (Medium)

**Duration:** 72496ms | **CC delta:** +0 | **MI delta:** +0.00

| Field | Value |
|-------|-------|
| Intent | RENAME_SYMBOL |
| Difficulty | Medium |
| Duration | 72496ms |
| CC delta | +0 |
| MI delta | +0.00 |
| Gen steps | 0 |
| Strategy iter | 3 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 2 |

**Instruction:**
```
Rename the abbreviated variable names in the trailingZeroes method to descriptive names. Update every reference throughout the method.
```

**Source Code:**
```java
public class Solution {
    public int trailingZeroes(int n) {
        int count = 0;
        while (n > 0) {
            n = n / 5;
            count += n;
        }
        return count;
    }
}
```

### 68. DECOMPOSE_CONDITIONAL (Easy)

**Duration:** 125241ms | **CC delta:** -1 | **MI delta:** -5.78

| Field | Value |
|-------|-------|
| Intent | DECOMPOSE_CONDITIONAL |
| Difficulty | Easy |
| Duration | 125241ms |
| CC delta | -1 |
| MI delta | -5.78 |
| Gen steps | 4 |
| Strategy iter | 2 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 0 |
| Tier 2C (Intent) | 0 |
| Tier 3 (Judge) | 1 |

**Instruction:**
```
Decompose the compound condition `x == 0 || x == 1` in the mySqrt method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.
```

**Source Code:**
```java
public class Solution {
    public int mySqrt(int x) {
        if (x == 0 || x == 1) return x;
        int start = 1, end = x, ans = 0;
        while (start <= end) {
            int mid = (start + end) / 2;
            if (mid * mid == x) return mid;
            if (mid <= x / mid) {
                start = mid + 1;
                ans = mid;
            } else {
                end = mid - 1;
            }
        }
        return ans;
    }
}
```

### 147. DECOMPOSE_CONDITIONAL (Medium)

**Duration:** 140572ms | **CC delta:** +1 | **MI delta:** -3.83

| Field | Value |
|-------|-------|
| Intent | DECOMPOSE_CONDITIONAL |
| Difficulty | Medium |
| Duration | 140572ms |
| CC delta | +1 |
| MI delta | -3.83 |
| Gen steps | 5 |
| Strategy iter | 2 |
| Tier 1 (Syntax) | 0 |
| Tier 2A (CC) | 0 |
| Tier 2B (Boundary) | 1 |
| Tier 2C (Intent) | 1 |
| Tier 3 (Judge) | 0 |

**Instruction:**
```
Decompose the compound condition `head == null || head.next == null` in the sortList method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable.
```

**Source Code:**
```java
public class ListNode {
    int val;
    ListNode next;
    ListNode(int x) { val = x; }
}

public class Solution {
    public 


    public ListNode sortList(ListNode head) {
        if (head == null || head.next == null) return head;

        ListNode slow = head, fast = head.next;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
        }

        ListNode mid = slow.next;
        slow.next = null;

        return merge(sortList(head), sortList(mid));
    }

    private ListNode merge(ListNode left, ListNode right) {
        if (left == null) return right;
        if (right == null) return left;
        if (left.val < right.val) {
            left.next = merge(left.next, right);
            return left;
        } else {
            right.next = merge(left, right.next);
            return right;
        }
    }
}
```
