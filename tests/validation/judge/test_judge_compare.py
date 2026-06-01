"""
Judge guidance comparison — baseline vs definitions vs ICL.
All prompts hardcoded. No dependency on prompts.yaml.
"""
import asyncio
import json
import sys
import time
from datetime import datetime
from typing import Any, Dict, List

sys.path.insert(0, ".")

from app.utils.response_parser import ResponseParser
from app.utils.schemas import StructuralAuditorResponse
from tests.model_tests.harness import ModelTestHarness


# ============================================================
# BASE PROMPTS
# ============================================================

BASE_JUDGE = """### ROLE
Semantic Auditor. For the same inputs, do both versions produce the same outputs?

### TASK
Compare original and refactored code. Find concrete inputs.
Same inputs produce same outputs → ACCEPT. Any divergence → REVISE.

### RULES
- Standard refactoring idioms are ACCEPTABLE and encouraged.
- Changes explicitly listed in the plan mutations are EXPECTED — do not flag them.
- CRITICAL: If refactored code is IDENTICAL to original but plan lists mutations,
  verdict MUST be REVISE with issue "Plan was not executed: code unchanged."
- CRITICAL: If planned ADD_METHOD/ADD_FIELD/ADD_CONSTANT items are MISSING,
  verdict MUST be REVISE.

### OUTPUT FORMAT
Output ONLY JSON. No preamble.
{
  "audit_scratchpad": {
    "variable_trace": [{"original": "x", "refactored": "y", "mapping": null}],
    "logic_comparison": "For input X: original → Y, refactored → Y. Same."
  },
  "verdict": "ACCEPT",
  "issues": []
}"""


# ============================================================
# GUIDANCE — DEFINITIONS ONLY (no code examples)
# ============================================================

GUIDANCE_DEFS: Dict[str, str] = {
    "FLATTEN_CONDITIONAL": """### JUDGING FLATTEN_CONDITIONAL
Guard clauses with early return/throw are the EXPECTED result. The code
should look completely different — that is what flatten does.

EVALUATE THREE THINGS:
1. GUARD COUNT: Count throw/return statements in original. Count in refactored.
   Same count = guards preserved. Fewer = guards were merged → REVISE.
2. EXCEPTION IDENTITY: Every exception type (IllegalArgumentException, etc.)
   must match between original and refactored. Every error message string must
   match exactly — word for word. Different type or message → REVISE.
3. LOGIC EQUIVALENCE: Pick 2-3 inputs that hit distinct branches in the original.
   For each, does the refactored produce the same final action (throw, return,
   or continue to body)? Same for all → ACCEPT. Any divergence → REVISE.
Note: Guard clauses using || to combine multiple checks = MERGED → REVISE.""",

    "DECOMPOSE_CONDITIONAL": """### JUDGING DECOMPOSE_CONDITIONAL
The compound condition is replaced by named boolean variables or fields.

EVALUATE:
1. SIGNATURE: Method return type, name, parameter types and names — identical? No → REVISE.
2. NO INVENTED METHODS: Any new methods beyond ADD_FIELD? → REVISE.
3. LOGIC: Pick inputs across all condition branches. Same return values? → ACCEPT.""",

    "EXTRACT_CONSTANT": """### JUDGING EXTRACT_CONSTANT
A magic number is replaced by a static final constant.

EVALUATE:
1. CONSTANT: Is the constant declared at class level (static final)? No → REVISE.
2. METHOD COUNT: Every method from the original still present? Any dropped? → REVISE.
3. REPLACEMENT: Every occurrence of the literal replaced by the constant? Any missed? → REVISE.
4. SIGNATURE: Method signatures unchanged? Return types unchanged? → ACCEPT.""",

    "RENAME_SYMBOL": """### JUDGING RENAME_SYMBOL
Only identifier names change. Nothing else.

EVALUATE:
1. OLD NAME ABSENT: Does the old name appear anywhere in the output? → REVISE.
2. BEHAVIOR: Any logic, return value, or side effect changed beyond renaming? → REVISE.
3. ACCESSORS: If a field was renamed, are getters/setters also updated? → ACCEPT.""",

    "EXTRACT_METHOD": """### JUDGING EXTRACT_METHOD
Code moved into a new private helper. Original calls the helper.

EVALUATE:
1. HELPER EXISTS: Is the new method declared? Is it called from the original? No → REVISE.
2. SIGNATURE: Original method's return type and parameter names unchanged? No → REVISE.
3. PARAMS: Does the helper use ONLY the variables it needs, not all original params? → ACCEPT.
4. LOGIC: Pick inputs. Same output from original and refactored? → ACCEPT.""",

    "SPLIT_LOOP": """### JUDGING SPLIT_LOOP
One loop becomes multiple loops. Each does one thing. Same overall result.

EVALUATE:
1. MULTIPLE LOOPS: Multiple for/while loops where there was one? → ACCEPT.
2. NO NEW METHODS: Any new methods? → REVISE. Split stays in same method.
3. OUTPUT: Same array/collection values, same print statements? → ACCEPT.""",

    "CONSOLIDATE_CONDITIONAL": """### JUDGING CONSOLIDATE_CONDITIONAL
Duplicate conditional branches merged. Same outcomes preserved.

EVALUATE:
1. BRANCHES COMBINED: Were duplicate if/else branches merged into one check? → ACCEPT.
2. OUTCOMES: All original return values and side effects preserved? Any changed? → REVISE.""",

    "REMOVE_CONTROL_FLAG": """### JUDGING REMOVE_CONTROL_FLAG
Boolean flag variable eliminated. Direct break/return replaces it.

EVALUATE:
1. FLAG GONE: Is the boolean flag variable declaration removed? Still present? → REVISE.
2. BEHAVIOR: Same return values and loop behavior? → ACCEPT.""",

    "REPLACE_LOOP_WITH_PIPELINE": """### JUDGING REPLACE_LOOP_WITH_PIPELINE
For-loop replaced by stream operations (.stream().map().filter().collect()).

EVALUATE:
1. STREAM USED: Is there a .stream() or IntStream.range() call? No → REVISE.
2. SAME RESULT: Same elements in result, same order, same collection type? → ACCEPT.""",

    "INLINE_METHOD": """### JUDGING INLINE_METHOD
Method removed. Body copied to every call site.

EVALUATE:
1. TARGET REMOVED: Does the target method still exist? → REVISE.
2. CALL SITES: Does every call site now contain the method body? → ACCEPT.
3. BEHAVIOR: Same return values? → ACCEPT.""",

    "EXTRACT_VARIABLE": """### JUDGING EXTRACT_VARIABLE
Expression assigned to a named local variable. All occurrences replaced.

EVALUATE:
1. VARIABLE DECLARED: Is the new variable declared and assigned the expression? → ACCEPT.
2. REPLACEMENT: All occurrences of the expression replaced by the variable? → ACCEPT.
3. VALUE: Expression value or type changed? → REVISE.""",

    "INLINE_VARIABLE": """### JUDGING INLINE_VARIABLE
Local variable removed. Each use replaced by its value expression.

EVALUATE:
1. DECLARATION GONE: Variable declaration removed? Still present? → REVISE.
2. REPLACEMENT: Each variable use replaced by its assigned expression? → ACCEPT.
3. BEHAVIOR: Same result? → ACCEPT.""",
}

# ============================================================
# GUIDANCE — ICL CODE EXAMPLES (code patterns)
# ============================================================

GUIDANCE_ICL: Dict[str, str] = {
    "FLATTEN_CONDITIONAL": """### JUDGING FLATTEN_CONDITIONAL
Guard clauses with early return/throw are EXPECTED. Code should look
completely different — that is what flatten does.

ACCEPT example:
  Original:  void f(String s) { if(s!=null){ if(s.length()>0){ work(s); }
    } else { throw new IllegalArgumentException("null"); } }
  Refactored: void f(String s) { if(s==null) throw new IllegalArgumentException("null");
    work(s); }
  ✓ Guard clause at top. ✓ Exception type matches. ✓ Message "null" matches.
  ✓ Logic: null→throw, "abc"→work in both.

REVISE example — merged:
  Original:  void f(String s) { if(s!=null){ if(s.length()>0){ work(s); }
    } else { throw new IllegalArgumentException("null"); } }
  Refactored: void f(String s) { if(s==null||s.length()==0) throw new
    IllegalArgumentException("invalid"); work(s); }
  ✗ Guards merged with ||. ✗ Messages combined to "invalid".
  ✗ Exception count: 2→1.

REVISE example — logic lost:
  Original:  void f(int x){ if(x>0){ bonus(); discount(); } }
  Refactored: void f(int x){ if(x<=0) return; bonus(); }
  ✗ discount() never called. Logic not preserved.

CHECK: Every original throw becomes a separate guard? Same types and messages?
  Pick concrete inputs. Same action for each? → ACCEPT. Else → REVISE.""",

    "DECOMPOSE_CONDITIONAL": """### JUDGING DECOMPOSE_CONDITIONAL
Compound condition replaced by named booleans. Method signature unchanged.

ACCEPT example:
  Original:  boolean ok(int a){ if(a>=18&&a<=65) return true; return false; }
  Refactored: boolean ok(int a){ boolean isAdult=a>=18; boolean notRetired=a<=65;
    return isAdult&&notRetired; }
  ✓ Signature unchanged. ✓ Result same for a=20(true), a=10(false), a=70(false).

REVISE example — invented method:
  Original:  boolean ok(int a){ if(a>=18&&a<=65) return true; return false; }
  Refactored: boolean ok(int a){ init(a); return isAdult&&notRetired; }
    void init(int a){ isAdult=a>=18; notRetired=a<=65; }
  ✗ Extra init() method invented. Not in plan.

CHECK: Signature unchanged? No extra methods? Logic same for 3 inputs? → ACCEPT.""",

    "EXTRACT_CONSTANT": """### JUDGING EXTRACT_CONSTANT
Magic number replaced by static final constant.

ACCEPT example:
  Original:  double area(double r){ return 3.14*r*r; }
  Refactored: double area(double r){ return PI*r*r; } // PI=3.14 declared
  ✓ Constant declared at class level. ✓ Literal replaced. ✓ Logic identical.

REVISE example — method dropped:
  Original:  class C{ double area(double r){ return 3.14*r*r; }
    double circ(double r){ return 2*3.14*r; } }
  Refactored: class C{ double area(double r){ return PI*r*r; } }
    // circ() MISSING entirely
  ✗ Method disappeared.

CHECK: Constant declared? Every method still present? Signatures unchanged? → ACCEPT.""",

    "RENAME_SYMBOL": """### JUDGING RENAME_SYMBOL
Only identifier names change. Nothing else.

ACCEPT example:
  Original:  class U{ String n; String getN(){ return n; } }
  Refactored: class U{ String username; String getUsername(){ return username; } }
  ✓ Old name gone. ✓ Accessor renamed. ✓ Logic identical.

REVISE example — behavior changed:
  Original:  class U{ String n; String getN(){ return n; } }
  Refactored: class U{ String username; String getUsername(){ return username.toUpperCase(); } }
  ✗ toUpperCase() added — behavior changed beyond rename.

CHECK: Old name absent? Accessors updated? No logic changes beyond naming? → ACCEPT.""",

    "EXTRACT_METHOD": """### JUDGING EXTRACT_METHOD
Code moved into a new private helper. Original calls helper.

ACCEPT example:
  Original:  double f(double p,int q,double t){ double s=p*q; return s+s*t; }
  Refactored: double f(double p,int q,double t){ return compute(p*q,t); }
    private double compute(double s,double t){ return s+s*t; }
  ✓ Helper exists. ✓ Original calls it. ✓ Same output.

REVISE example — wrong params:
  Original:  same
  Refactored: double f(double p,int q,double t){ return compute(p,q,t); }
    private double compute(double p,int q,double t){ return p*q+p*q*t; }
  ✗ Helper copied ALL original params instead of only the ones it needs.

CHECK: Helper exists and is called? Original signature unchanged? Same output? → ACCEPT.""",

    "SPLIT_LOOP": """### JUDGING SPLIT_LOOP
One loop becomes multiple loops. Each does one thing. Same result.

ACCEPT example:
  Original:  void f(int[] a){ for(int i=0;i<a.length;i++){ a[i]*=2; print(a[i]); } }
  Refactored: void f(int[] a){ for(int i=0;i<a.length;i++) a[i]*=2;
    for(int i=0;i<a.length;i++) print(a[i]); }
  ✓ Two loops. ✓ Same values. ✓ Same prints.

CHECK: Multiple loops? Same output? No new methods? → ACCEPT.""",

    "CONSOLIDATE_CONDITIONAL": """### JUDGING CONSOLIDATE_CONDITIONAL
Duplicate branches merged. Same outcomes preserved.

ACCEPT example:
  Original:  String f(int x){ if(x==1) return "a"; if(x==2) return "a"; return "b"; }
  Refactored: String f(int x){ if(x==1||x==2) return "a"; return "b"; }
  ✓ Branches merged. ✓ Same return values.

CHECK: Duplicates combined? All return values preserved? → ACCEPT.""",

    "REMOVE_CONTROL_FLAG": """### JUDGING REMOVE_CONTROL_FLAG
Boolean flag eliminated. Direct break/return replaces it.

ACCEPT example:
  Original:  int f(int[] a,int t){ boolean found=false; int r=-1;
    for(int i=0;i<a.length;i++) if(a[i]==t){ found=true; r=i; break; }
    if(found) return r; return -1; }
  Refactored: int f(int[] a,int t){ for(int i=0;i<a.length;i++)
    if(a[i]==t) return i; return -1; }
  ✓ Flag gone. ✓ Same return values.

CHECK: Flag declaration removed? Return behavior identical? → ACCEPT.""",

    "REPLACE_LOOP_WITH_PIPELINE": """### JUDGING REPLACE_LOOP_WITH_PIPELINE
Loop replaced by stream operations. Same result, same order.

ACCEPT example:
  Original:  List<Integer> f(int[] a){ List<Integer> r=new ArrayList<>();
    for(int x:a) if(x>0) r.add(x); return r; }
  Refactored: List<Integer> f(int[] a){ return Arrays.stream(a).filter(x->x>0)
    .boxed().collect(Collectors.toList()); }
  ✓ Stream used. ✓ Same values. ✓ Same order.

CHECK: Loop replaced by .stream()? Same elements, order, type? → ACCEPT.""",

    "INLINE_METHOD": """### JUDGING INLINE_METHOD
Method removed. Body copied to every call site.

ACCEPT example:
  Original:  boolean canWin(int n){ return n%4!=0; }
    boolean check(int n){ return canWin(n); }
  Refactored: boolean check(int n){ return n%4!=0; }
  ✓ canWin removed. ✓ Body inlined at call site.

CHECK: Target method removed? Call sites have method body? Same behavior? → ACCEPT.""",

    "EXTRACT_VARIABLE": """### JUDGING EXTRACT_VARIABLE
Expression assigned to a named local variable. All occurrences replaced.

ACCEPT example:
  Original:  int f(int n){ return n*n+2*n*n; }
  Refactored: int f(int n){ int sq=n*n; return sq+2*sq; }
  ✓ Variable declared. ✓ All occurrences replaced.

CHECK: Variable declared? Expression assigned? All uses replaced? → ACCEPT.""",

    "INLINE_VARIABLE": """### JUDGING INLINE_VARIABLE
Variable removed. Each use replaced by its value expression.

ACCEPT example:
  Original:  int f(){ int x=5+3; return x*2; }
  Refactored: int f(){ return (5+3)*2; }
  ✓ Variable declaration removed. ✓ Expression inlined.

CHECK: Declaration gone? Uses replaced by expression? Same result? → ACCEPT.""",
}


# ============================================================
# TEST CASES (same as existing judge isolated test)
# ============================================================

TEST_CASES: List[Dict[str, Any]] = [
    {
        "name": "accept_extract_method_tax",
        "original_code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        return Math.round((subtotal + tax) * 100.0) / 100.0;
    }
}""",
        "refactored_code": """public class Calculator {
    private double computeTaxWithRounding(double subtotal, double taxRate) {
        double tax = subtotal * taxRate;
        return Math.round((subtotal + tax) * 100.0) / 100.0;
    }
    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        return computeTaxWithRounding(subtotal, taxRate);
    }
}""",
        "plan_context": "Intent: EXTRACT_METHOD. Target: Calculator.calculateTotal. Mutations: ADD_METHOD(computeTaxWithRounding), MODIFY_METHOD(calculateTotal)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_rename_symbol_field",
        "original_code": """public class UserManager {
    private String n;
    public String getN() { return n; }
    public void setN(String n) { this.n = n; }
}""",
        "refactored_code": """public class UserManager {
    private String username;
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}""",
        "plan_context": "Intent: RENAME_SYMBOL. Target: UserManager.n. Mutations: RENAME_SYMBOL(n→username), MODIFY_METHOD(getN), MODIFY_METHOD(setN)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_flatten_guard_clauses",
        "original_code": """void process(String s) {
    if (s != null) {
        if (!s.isEmpty()) {
            doWork(s);
        } else {
            throw new IllegalArgumentException("input empty");
        }
    } else {
        throw new IllegalArgumentException("input null");
    }
}""",
        "refactored_code": """void process(String s) {
    if (s == null) throw new IllegalArgumentException("input null");
    if (s.isEmpty()) throw new IllegalArgumentException("input empty");
    doWork(s);
}""",
        "plan_context": "Intent: FLATTEN_CONDITIONAL. Target: process. Mutations: MODIFY_METHOD(process)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_split_loop",
        "original_code": """void process(int[] arr) {
    for (int i = 0; i < arr.length; i++) {
        arr[i] *= 2;
        System.out.println(arr[i]);
    }
}""",
        "refactored_code": """void process(int[] arr) {
    for (int i = 0; i < arr.length; i++) {
        arr[i] *= 2;
    }
    for (int i = 0; i < arr.length; i++) {
        System.out.println(arr[i]);
    }
}""",
        "plan_context": "Intent: SPLIT_LOOP. Target: process. Mutations: MODIFY_METHOD(process)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_extract_constant_pi",
        "original_code": """public double calculateArea(double radius) {
    return 3.14159 * radius * radius;
}""",
        "refactored_code": """private static final double PI = 3.14159;
public double calculateArea(double radius) {
    return PI * radius * radius;
}""",
        "plan_context": "Intent: EXTRACT_CONSTANT. Target: calculateArea. Mutations: ADD_CONSTANT(PI), MODIFY_METHOD(calculateArea)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "revise_extract_constant_broken_sig",
        "original_code": """public class Circle {
    public double calculateArea(double r) { return 3.14159 * r * r; }
    public double calculateCircumference(double r) { return 2 * 3.14159 * r; }
}""",
        "refactored_code": """public class Circle {
    private static final double PI = 3.14159;
    public void calculateArea(double r) { System.out.println(PI * r * r); }
    public void calculateCircumference(double r) { System.out.println(2 * PI * r); }
}""",
        "plan_context": "Intent: EXTRACT_CONSTANT. Target: Circle.calculateArea. Mutations: ADD_CONSTANT(PI), MODIFY_METHOD(calculateArea), MODIFY_METHOD(calculateCircumference)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_decompose_noop",
        "original_code": """public class LoanApprover {
    public boolean isEligible(int age, double income, int creditScore, boolean hasCollateral) {
        if (age >= 18 && age <= 65 && income > 30000 && creditScore > 650 && hasCollateral) {
            return true;
        }
        return false;
    }
}""",
        "refactored_code": """public class LoanApprover {
    public boolean isEligible(int age, double income, int creditScore, boolean hasCollateral) {
        if (age >= 18 && age <= 65 && income > 30000 && creditScore > 650 && hasCollateral) {
            return true;
        }
        return false;
    }
}""",
        "plan_context": "Intent: DECOMPOSE_CONDITIONAL. Target: LoanApprover.isEligible. Mutations: ADD_FIELD(isAdult), ADD_FIELD(hasSufficientIncome), ADD_FIELD(hasGoodCredit), MODIFY_METHOD(isEligible)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_flatten_logic_inverted",
        "original_code": """public class Discount {
    void apply(int total, boolean premium) {
        if (total > 1000) {
            if (premium) {
                discount(0.15);
            } else {
                discount(0.05);
            }
        }
    }
}""",
        "refactored_code": """public class Discount {
    void apply(int total, boolean premium) {
        if (total <= 1000) return;
        if (!premium) discount(0.05);
    }
}""",
        "plan_context": "Intent: FLATTEN_CONDITIONAL. Target: Discount.apply. Mutations: MODIFY_METHOD(apply)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_extract_method_wrong_params",
        "original_code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        return Math.round((subtotal + tax) * 100.0) / 100.0;
    }
}""",
        "refactored_code": """public class Calculator {
    private double computeTaxWithRounding(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        return Math.round((subtotal + tax) * 100.0) / 100.0;
    }
    public double calculateTotal(double price, int quantity, double taxRate) {
        return computeTaxWithRounding(price, quantity, taxRate);
    }
}""",
        "plan_context": "Intent: EXTRACT_METHOD. Target: Calculator.calculateTotal. Mutations: ADD_METHOD(computeTaxWithRounding), MODIFY_METHOD(calculateTotal)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_rename_broke_structural",
        "original_code": """public int getValue(int x) {
    if (x > 0) {
        return x * 2;
    }
    return -1;
}""",
        "refactored_code": """public int computeValue(int input) {
    return input > 0 ? input * 2 : -1;
}""",
        "plan_context": "Intent: RENAME_SYMBOL. Target: getValue. Mutations: RENAME_SYMBOL(x→input), MODIFY_METHOD(getValue)",
        "expected_verdict": "REVISE",
    },
]


async def run_judge_test(
    harness: ModelTestHarness,
    system_prompt: str,
    guidance_dict: Dict[str, str],
    label: str,
) -> List[Dict[str, Any]]:
    results = []
    for case in TEST_CASES:
        # Determine intent from plan_context
        plan = case["plan_context"]
        intent = ""
        for intent_key in guidance_dict:
            if intent_key in plan:
                intent = intent_key
                break

        guidance = guidance_dict.get(intent, "")
        system = system_prompt + "\n" + guidance if guidance else system_prompt

        prompt = (
            f"## Plan Context\n{plan}\n\n"
            f"## Code\n"
            f"Original: <code>{case['original_code']}</code>\n"
            f"Refactored: <code>{case['refactored_code']}</code>"
        )

        for run_num in range(1, 6):
            result = await harness.generate(
                system, prompt,
                temp=0.1, max_tokens=1000,
                response_model=StructuralAuditorResponse,
            )
            r = {
                "name": case["name"],
                "expected_verdict": case["expected_verdict"],
                "run": run_num,
                "mode": label,
                "duration": result["duration"],
                "success": result["success"],
            }
            if result["success"]:
                try:
                    parsed = ResponseParser.extract_json(result["content"], StructuralAuditorResponse)
                    r["verdict"] = parsed.verdict
                    r["issues"] = parsed.issues
                    r["scratchpad_len"] = len(str(parsed.audit_scratchpad))
                except Exception:
                    r["verdict"] = "PARSE_ERROR"
            else:
                r["verdict"] = "GEN_ERROR"
            results.append(r)

        print(f"  {case['name'][:35]:35} {'✓' if results[-1]['verdict'] == case['expected_verdict'] else '✗'} | run5={results[-1]['verdict']}")

    return results


async def main():
    print("=" * 70)
    print("JUDGE GUIDANCE COMPARISON")
    print("Baseline → Definitions → ICL")
    print("10 cases × 5 runs × 3 modes = 150 calls")
    print("=" * 70)

    harness = ModelTestHarness("judge")
    await harness.load_model()

    all_results = []

    # MODE 1: Baseline — no guidance, simplified base prompt only
    print("\n--- MODE 1: BASELINE (simplified base, no guidance) ---")
    r1 = await run_judge_test(harness, BASE_JUDGE, {}, "baseline")
    all_results.extend(r1)

    # MODE 2: Definitions
    print("\n--- MODE 2: DEFINITIONS (rule-based criteria per intent) ---")
    r2 = await run_judge_test(harness, BASE_JUDGE, GUIDANCE_DEFS, "definitions")
    all_results.extend(r2)

    # MODE 3: ICL
    print("\n--- MODE 3: ICL (code examples per intent) ---")
    r3 = await run_judge_test(harness, BASE_JUDGE, GUIDANCE_ICL, "icl")
    all_results.extend(r3)

    await harness.unload_model()

    # ============================================================
    # COMPREHENSIVE REPORT
    # ============================================================
    print("\n" + "=" * 70)
    print("COMPREHENSIVE REPORT")
    print("=" * 70)

    for mode in ["baseline", "definitions", "icl"]:
        mode_results = [r for r in all_results if r["mode"] == mode]
        correct = sum(1 for r in mode_results if r["verdict"] == r["expected_verdict"])
        total = len(mode_results)
        print(f"\n  {mode.upper():12} {correct}/{total} ({correct/total*100:.0f}%)")

        # Per-case breakdown
        cases = {}
        for r in mode_results:
            n = r["name"]
            if n not in cases:
                cases[n] = {"total": 0, "correct": 0, "expected": r["expected_verdict"]}
            cases[n]["total"] += 1
            if r["verdict"] == r["expected_verdict"]:
                cases[n]["correct"] += 1

        for name, stats in sorted(cases.items()):
            print(f"    {name[:40]:40} {stats['correct']}/{stats['total']} (exp={stats['expected']})")

    # Intent-level comparison
    print(f"\n  INTENT-LEVEL COMPARISON:")
    intents = {}
    for r in all_results:
        name = r["name"]
        intent = name.split("_")[1] if "_" in name else name  # e.g., "flatten" from "accept_flatten_guard_clauses"
        # Better: use expected_verdict + first word after "accept_" or "revise_"
        parts = name.split("_", 2)
        if len(parts) >= 2:
            intent = parts[1]
        else:
            intent = name.split("_")[0]
        mode = r["mode"]
        key = (intent, r["expected_verdict"])
        if key not in intents:
            intents[key] = {}
        if mode not in intents[key]:
            intents[key][mode] = {"total": 0, "correct": 0}
        intents[key][mode]["total"] += 1
        if r["verdict"] == r["expected_verdict"]:
            intents[key][mode]["correct"] += 1

    for (intent, exp), modes in sorted(intents.items()):
        baseline_c = modes.get("baseline", {"correct": 0, "total": 0})
        defs_c = modes.get("definitions", {"correct": 0, "total": 0})
        icl_c = modes.get("icl", {"correct": 0, "total": 0})
        print(f"    {intent:25} {exp:6} | baseline={baseline_c['correct']}/{baseline_c['total']} "
              f"defs={defs_c['correct']}/{defs_c['total']} icl={icl_c['correct']}/{icl_c['total']}")

    ts = datetime.now().strftime("%Y-%m-%dT%H%M%S")
    path = f"test_results/judge_comparison_{ts}.json"
    with open(path, "w") as f:
        json.dump(all_results, f, indent=2, default=str)
    print(f"\nSaved: {path}")


if __name__ == "__main__":
    asyncio.run(main())
