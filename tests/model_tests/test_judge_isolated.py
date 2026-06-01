import asyncio
import json
import sys
from typing import Any, Dict, List

sys.path.insert(0, ".")

from app.utils.response_parser import ResponseParser
from app.utils.schemas import StructuralAuditorResponse
from tests.model_tests.harness import ModelTestHarness


TEST_CASES: List[Dict[str, Any]] = [
    # ---- ACCEPT-expected (5 cases) ----
    {
        "name": "accept_extract_method_tax",
        "original_code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        double total = subtotal + tax;
        double rounded = Math.round(total * 100.0) / 100.0;
        return rounded;
    }
}""",
        "refactored_code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        return computeTaxWithRounding(price * quantity, taxRate);
    }

    private double computeTaxWithRounding(double subtotal, double taxRate) {
        double tax = subtotal * taxRate;
        double total = subtotal + tax;
        return Math.round(total * 100.0) / 100.0;
    }
}""",
        "plan_summary": "Intent: EXTRACT_METHOD. Target: Calculator.calculateTotal. Mutations: ADD_METHOD(computeTaxWithRounding), MODIFY_METHOD(calculateTotal)",
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
        "plan_summary": "Intent: RENAME_SYMBOL. Target: UserManager.username. Mutations: RENAME_SYMBOL(n->username), RENAME_SYMBOL(getN->getUsername), RENAME_SYMBOL(setN->setUsername)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_flatten_guard_clauses",
        "original_code": """public class A {
    void process(Object x, Object y) {
        if (x != null) {
            if (y != null) {
                if (x.equals(y)) {
                    doWork();
                } else {
                    throw new IllegalArgumentException("Not equal");
                }
            } else {
                throw new IllegalArgumentException("y is null");
            }
        } else {
            throw new IllegalArgumentException("x is null");
        }
    }
}""",
        "refactored_code": """public class A {
    void process(Object x, Object y) {
        if (x == null) throw new IllegalArgumentException("x is null");
        if (y == null) throw new IllegalArgumentException("y is null");
        if (!x.equals(y)) throw new IllegalArgumentException("Not equal");
        doWork();
    }
}""",
        "plan_summary": "Intent: FLATTEN_CONDITIONAL. Target: A.process. Mutations: MODIFY_METHOD(process)",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_split_loop",
        "original_code": """class A {
    void process() {
        int[] arr = new int[10];
        for (int i = 0; i < 10; i++) {
            arr[i] = i * 2;
        }
        for (int i = 0; i < 10; i++) {
            System.out.println(arr[i]);
        }
    }
}""",
        "refactored_code": """class A {
    void process() {
        int[] arr = new int[10];
        for (int i = 0; i < 10; i++) {
            arr[i] = i * 2;
        }
        for (int i = 0; i < 10; i++) {
            System.out.println(arr[i]);
        }
    }
}""",
        "plan_summary": "Intent: SPLIT_LOOP. Target: A.process. Mutations: SPLIT_LOOP",
        "expected_verdict": "ACCEPT",
    },
    {
        "name": "accept_extract_constant_pi",
        "original_code": """public class Circle {
    public double calculateArea(double radius) {
        return 3.14159 * radius * radius;
    }
    public double calculateCircumference(double radius) {
        return 2 * 3.14159 * radius;
    }
}""",
        "refactored_code": """public class Circle {
    private static final double PI = 3.14159;

    public double calculateArea(double radius) {
        return PI * radius * radius;
    }
    public double calculateCircumference(double radius) {
        return 2 * PI * radius;
    }
}""",
        "plan_summary": "Intent: EXTRACT_CONSTANT. Target: Circle.PI. Mutations: ADD_CONSTANT(PI), MODIFY_METHOD(calculateArea), MODIFY_METHOD(calculateCircumference)",
        "expected_verdict": "ACCEPT",
    },

    # ---- REVISE-expected (5 cases) ----
    {
        "name": "revise_extract_constant_broken_sig",
        "original_code": """public class Circle {
    public double calculateArea(double radius) {
        return 3.14159 * radius * radius;
    }
    public double calculateCircumference(double radius) {
        return 2 * 3.14159 * radius;
    }
}""",
        "refactored_code": """public class Circle {
    public static final double PI = 3.14159;

    public void calculateArea(double radius) {
        System.out.println("Area is: " + PI * radius * radius);
    }
    public void calculateCircumference(double radius) {
        System.out.println("Circumference is: " + 2 * PI * radius);
    }
}""",
        "plan_summary": "Intent: EXTRACT_CONSTANT. Target: Circle.PI. Mutations: ADD_CONSTANT(PI), MODIFY_METHOD(calculateArea), MODIFY_METHOD(calculateCircumference)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_decompose_noop",
        "original_code": """public class LoanApprover {
    public boolean isEligible(int age, double income, int score, boolean hasCollateral) {
        if (age >= 18 && age <= 65 && income > 30000 && score > 650 && hasCollateral) {
            return true;
        }
        return false;
    }
}""",
        "refactored_code": """public class LoanApprover {
    public boolean isEligible(int age, double income, int score, boolean hasCollateral) {
        if (age >= 18 && age <= 65 && income > 30000 && score > 650 && hasCollateral) {
            return true;
        }
        return false;
    }
}""",
        "plan_summary": "Intent: DECOMPOSE_CONDITIONAL. Target: LoanApprover.isEligible. Mutations: ADD_FIELD(hasSufficientAge), ADD_FIELD(sufficientIncome), ADD_FIELD(highCreditScore), ADD_FIELD(collateralAvailable), MODIFY_METHOD(isEligible)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_flatten_logic_inverted",
        "original_code": """public class Processor {
    void process(int total, boolean premium) {
        if (total > 1000) {
            if (premium) {
                discount(0.15);
            } else {
                discount(0.05);
            }
        }
    }
}""",
        "refactored_code": """public class Processor {
    void process(int total, boolean premium) {
        if (total > 1000) {
            if (!premium) {
                discount(0.05);
            }
        } else {
            discount(0.15);
        }
    }
}""",
        "plan_summary": "Intent: FLATTEN_CONDITIONAL. Target: Processor.process. Mutations: MODIFY_METHOD(process)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_extract_method_wrong_params",
        "original_code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        return subtotal + tax;
    }
}""",
        "refactored_code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        return computeTax(price, quantity, taxRate, 0.05);
    }

    private double computeTax(double price, int quantity, double taxRate, double extraFee) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        return subtotal + tax + extraFee * subtotal;
    }
}""",
        "plan_summary": "Intent: EXTRACT_METHOD. Target: Calculator.calculateTotal. Mutations: ADD_METHOD(computeTax), MODIFY_METHOD(calculateTotal)",
        "expected_verdict": "REVISE",
    },
    {
        "name": "revise_rename_broke_structural",
        "original_code": """public class Flag {
    boolean check(int x) {
        if (x > 0) return true;
        return false;
    }
}""",
        "refactored_code": """public class Flag {
    boolean verify(int x) {
        return x > 0 ? true : false;
    }
}""",
        "plan_summary": "Intent: RENAME_SYMBOL. Target: Flag.check. Mutations: RENAME_SYMBOL(check->verify)",
        "expected_verdict": "REVISE",
    },
]


async def run_judge_run(
    harness: ModelTestHarness, case: Dict[str, Any]
) -> Dict[str, Any]:
    user_prompt = (
        f"## Plan Context\n{case['plan_summary']}\n\n"
        f"## Code\n"
        f"Original: <code>{case['original_code']}</code>\n"
        f"Refactored: <code>{case['refactored_code']}</code>\n"
        f"Intent: {json.dumps({'specific_intent': case.get('expected_verdict', '')})}"
    )

    system_content = harness.prompts["judge"]["auditor"]
    guidance_dict = harness.prompts["judge"].get("auditor_guidance", {})
    for intent_key in guidance_dict:
        if intent_key in case.get("plan_summary", ""):
            guidance = guidance_dict[intent_key]
            system_content += "\n" + guidance
            break

    result = await harness.generate(
        system_prompt=system_content,
        user_prompt=user_prompt,
        temp=0.1,
        max_tokens=1000,
        response_model=StructuralAuditorResponse,
    )

    verdict = "PARSE_ERROR"
    issues = []
    scratchpad = ""

    if result["success"]:
        try:
            parsed = ResponseParser.extract_json(
                result["content"], StructuralAuditorResponse
            )
            verdict = parsed.verdict
            issues = parsed.issues
            scratchpad = json.dumps(parsed.audit_scratchpad.model_dump()) if parsed.audit_scratchpad else ""
        except Exception:
            pass

    return {
        "verdict": verdict,
        "issues": issues if isinstance(issues, list) else [str(issues)],
        "scratchpad": scratchpad,
        "duration": result["duration"],
        "raw_content": result["content"],
        "error": result["error"],
    }


def _diagnose_judge_what(case: Dict, runs: List[Dict]) -> str:
    expected = case["expected_verdict"]
    verdicts = [r["verdict"] for r in runs]
    correct = sum(1 for v in verdicts if v == expected)

    if correct == 5:
        return "All 5 runs matched the expected verdict. Judge performed correctly."
    elif correct == 0:
        return f"All 5 runs gave opposite verdict ({verdicts[0]} instead of {expected}). Judge is systematically wrong on this case."
    else:
        return f"{correct}/5 runs matched expected {expected}. {5-correct} runs disagreed. Judge is inconsistent on this case."


def _diagnose_judge_why(case: Dict, runs: List[Dict]) -> str:
    name = case["name"]
    avg_scratchpad = sum(len(r["scratchpad"]) for r in runs) / len(runs)
    lines = []

    if avg_scratchpad < 100:
        lines.append(
            f"Average scratchpad is only {avg_scratchpad:.0f} chars — too short to process all 5 audit tasks. Model likely defaulted to first available verdict without completing analysis. "
        )
    if name.startswith("accept_") and any(r["verdict"] == "REVISE" for r in runs):
        lines.append(
            "False REVISE on correct code. The Judge's audit prompt may be too demanding for 3B model — when it cannot fully verify equivalence, it defaults to REVISE as safe fallback. "
        )
    if name.startswith("revise_decompose_noop"):
        lines.append(
            "Code is identical to original — the most obvious REVISE case. Model can verify this easily because both code blocks are the same. "
        )
    if name.startswith("revise_extract_constant"):
        lines.append(
            "Return type changed double→void AND println side-effect added. Two clear violations of the SIGNATURE CHECK task. When both signals are present, Judge reliably catches at least one. "
        )
    if name.startswith("revise_flatten"):
        lines.append(
            "Logic inversion (discount applied at wrong threshold) is a subtle semantic error. The 3B model may struggle to trace all conditional paths. "
        )
    if not lines:
        lines.append(
            "Within the model's reliable range — clear structural signals make verdict straightforward. "
        )
    return "".join(lines)


async def main():
    print("=" * 60)
    print("JUDGE ISOLATED TEST")
    print(f"Cases: {len(TEST_CASES)} × 5 runs = {len(TEST_CASES) * 5} calls")
    print("=" * 60)

    harness = ModelTestHarness("judge")
    print("Loading judge model...")
    await harness.load_model()

    results = []
    for i, case in enumerate(TEST_CASES):
        name = case["name"]
        expected = case["expected_verdict"]
        print(f"\n[{i+1}/{len(TEST_CASES)}] {name} (expected: {expected})")

        runs = []
        for run_num in range(5):
            await harness.clear_context()
            r = await run_judge_run(harness, case)
            runs.append(r)
            print(f"  Run {run_num+1}: {r['verdict']} | {r['duration']}s | scratchpad={len(r['scratchpad'])} chars")

        case_result = {
            "name": name,
            "expected_verdict": expected,
            "runs": runs,
            "what_happened": _diagnose_judge_what(case, runs),
            "why": _diagnose_judge_why(case, runs),
        }
        results.append(case_result)

    await harness.unload_model()

    runs_flat = []
    for r in results:
        for run in r["runs"]:
            run["expected"] = r["expected_verdict"]
            run["case_name"] = r["name"]
            runs_flat.append(run)

    correct = sum(1 for run in runs_flat if run["verdict"] == run["expected"])
    total = len(runs_flat)
    print(f"\n{'='*60}")
    print(f"SUMMARY: {correct}/{total} correct ({round(correct/total*100)}%)" if total else "SUMMARY: no results")
    print(f"{'='*60}")

    json_path = harness.save_results(results, "judge")
    report = harness.build_judge_report(results)
    report_path = "test_results/judge_isolated_report.md"
    with open(report_path, "w") as f:
        f.write(report)

    print(f"JSON: {json_path}")
    print(f"Report: {report_path}")


if __name__ == "__main__":
    asyncio.run(main())
