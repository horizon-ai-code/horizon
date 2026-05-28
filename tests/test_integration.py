"""
Integration test: runs real models via WebSocket against the running server.

Usage:
  # Terminal 1: Start server
  conda activate horizon_env
  uvicorn app.main:app --reload

  # Terminal 2: Run tests
  python tests/test_integration.py
  python tests/test_integration.py --test flatten  # single test
  python tests/test_integration.py --output results.json  # save results
"""

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any, Dict, List, Optional

import websockets
from websockets.asyncio.client import connect


TEST_CASES: List[Dict[str, str]] = [
    {
        "name": "flatten_conditional",
        "code": """public class OrderProcessor {
    public void processOrder(Order order, User user) {
        if (user != null) {
            if (user.isActive()) {
                if (order != null) {
                    if (!order.getItems().isEmpty()) {
                        double total = order.getTotal();
                        if (total > 1000) {
                            if (user.isPremium()) {
                                order.applyDiscount(0.15);
                            } else {
                                order.applyDiscount(0.05);
                            }
                        }
                        System.out.println("Processing order for: " + user.getName());
                    } else {
                        throw new IllegalArgumentException("Order has no items.");
                    }
                } else {
                    throw new IllegalArgumentException("Order cannot be null.");
                }
            } else {
                throw new IllegalStateException("User account is inactive.");
            }
        } else {
            throw new IllegalArgumentException("User cannot be null.");
        }
    }
}""",
        "instruction": "Refactor the processOrder method to use guard clauses. Invert the nested if-statements to handle invalid states at the top with immediate exceptions. Preserve every original exception type and error message exactly.",
    },
    {
        "name": "extract_method",
        "code": """public class Calculator {
    public double calculateTotal(double price, int quantity, double taxRate) {
        double subtotal = price * quantity;
        double tax = subtotal * taxRate;
        double total = subtotal + tax;
        double rounded = Math.round(total * 100.0) / 100.0;
        return rounded;
    }
}""",
        "instruction": "Extract the tax calculation logic (tax computation and rounding) into a separate private method called computeTaxWithRounding.",
    },
    {
        "name": "rename_symbol",
        "code": """public class UserManager {
    private String n;
    public String getN() { return n; }
    public void setN(String n) { this.n = n; }
}""",
        "instruction": "Rename the field 'n' to 'username' and update all references.",
    },
    {
        "name": "extract_constant",
        "code": """public class Circle {
    public double calculateArea(double radius) {
        return 3.14159 * radius * radius;
    }
    public double calculateCircumference(double radius) {
        return 2 * 3.14159 * radius;
    }
}""",
        "instruction": "Extract the magic number 3.14159 into a named constant PI.",
    },
    {
        "name": "decompose_conditional",
        "code": """public class LoanApprover {
    public boolean isEligible(int age, double income, int creditScore, boolean hasCollateral) {
        if (age >= 18 && age <= 65 && income > 30000 && creditScore > 650 && hasCollateral) {
            return true;
        }
        return false;
    }
}""",
        "instruction": "Decompose the complex conditional in isEligible into well-named boolean variables for each condition.",
    },
]


@dataclass
class TestResult:
    name: str
    passed: bool
    verdict: str = ""
    outer_loops: int = 0
    syntax_retries: int = 0
    status_count: int = 0
    error: str = ""
    final_code: str = ""
    original_complexity: int = 0
    refactored_complexity: int = 0
    duration: float = 0.0
    events: List[Dict[str, Any]] = field(default_factory=list)
    timestamp: str = ""


class IntegrationTester:
    def __init__(self, uri: str = "ws://localhost:8000/ws"):
        self.uri = uri
        self.results: List[TestResult] = []
        self.events: List[Dict[str, Any]] = []

    async def run_test_case(self, case: Dict[str, str]) -> TestResult:
        name = case["name"]
        code = case["code"]
        instruction = case["instruction"]
        start = time.time()

        result = TestResult(name=name, passed=False, timestamp=datetime.now().isoformat())
        self.events = []

        try:
            async with connect(self.uri) as ws:
                payload = json.dumps({"code": code, "user_instruction": instruction})
                await ws.send(payload)
                print(f"  [{name}] Sent request. Waiting for responses...")

                while True:
                    try:
                        msg = await asyncio.wait_for(ws.recv(), timeout=300.0)
                    except asyncio.TimeoutError:
                        result.error = "Timeout (300s)"
                        break

                    try:
                        data = json.loads(msg)
                    except json.JSONDecodeError:
                        continue

                    self.events.append(data)
                    msg_type = data.get("type", "")

                    if msg_type == "error":
                        result.error = data.get("message", "Unknown error")
                        break

                    if msg_type == "connection_id":
                        result.status_count += 1

                    if msg_type == "status":
                        result.status_count += 1
                        content = data.get("content", "")
                        role = data.get("role", "")
                        if "Ph6" in str(content):
                            print(f"    -> Reached Phase 6")
                        if "Audit Finished" in str(content):
                            print(f"    -> Audit verdict received")
                        if "Syntax Fail" in str(content):
                            print(f"    -> Syntax heal triggered")

                    if msg_type == "result":
                        result.final_code = data.get("code", "")
                        result.original_complexity = data.get("original_complexity", 0) or 0
                        result.refactored_complexity = data.get("refactored_complexity", 0) or 0
                        result.passed = True
                        print(f"    -> Got result: CC {result.original_complexity} -> {result.refactored_complexity}")

                    if msg_type == "insights":
                        print(f"    -> Got insights")
                        break

            result.duration = round(time.time() - start, 2)

        except Exception as e:
            result.error = str(e)
            result.duration = round(time.time() - start, 2)
            print(f"  [{name}] ERROR: {e}")

        result.events = self.events
        self.results.append(result)
        return result

    async def run_all(self, test_names: Optional[List[str]] = None) -> List[TestResult]:
        cases = [c for c in TEST_CASES if test_names is None or c["name"] in test_names]
        for i, case in enumerate(cases):
            n = case["name"]
            print(f"\n[{i+1}/{len(cases)}] Test: {n}")
            print(f"  Code: {len(case['code'])} chars, Instruction: {case['instruction'][:60]}...")
            await self.run_test_case(case)
            # Cooldown between tests to let models unload
            await asyncio.sleep(2.0)
        return self.results

    def print_summary(self) -> None:
        print("\n" + "=" * 70)
        print("INTEGRATION TEST SUMMARY")
        print("=" * 70)
        passed = [r for r in self.results if r.passed]
        failed = [r for r in self.results if not r.passed]
        print(f"\nTotal: {len(self.results)}  |  Passed: {len(passed)}  |  Failed: {len(failed)}")
        print()

        for r in self.results:
            status = "PASS" if r.passed else "FAIL"
            cc_str = f"CC: {r.original_complexity} -> {r.refactored_complexity}" if r.passed else ""
            err_str = f"  Error: {r.error}" if r.error else ""
            print(f"  [{status}] {r.name:25s}  {r.duration:6.1f}s  {cc_str}{err_str}")

        if failed:
            print(f"\nFailed tests:")
            for r in failed:
                print(f"  - {r.name}: {r.error[:100]}")

        print(f"\nTimestamp: {datetime.now().isoformat()}")
        print("=" * 70)

    def save_results(self, path: str) -> None:
        data = []
        for r in self.results:
            d = asdict(r)
            d["events"] = [e for e in self.events]
            data.append(d)

        with open(path, "w") as f:
            json.dump(data, f, indent=2, default=str)
        print(f"\nResults saved to {path}")

    def generate_report(self) -> str:
        passed_count = sum(1 for r in self.results if r.passed)
        total = len(self.results)
        avg_duration = round(sum(r.duration for r in self.results) / total, 1) if total else 0

        lines = [
            "# Integration Test Report",
            "",
            f"**Date:** {datetime.now().isoformat()}",
            f"**Tests:** {total}  |  **Passed:** {passed_count}  |  **Failed:** {total - passed_count}",
            f"**Avg Duration:** {avg_duration}s",
            "",
            "## Results",
            "",
            "| Test | Status | Duration | Complexity | Error |",
            "|------|--------|----------|------------|-------|",
        ]

        for r in self.results:
            status = "✅ PASS" if r.passed else "❌ FAIL"
            cc = f"{r.original_complexity}→{r.refactored_complexity}" if r.passed else "-"
            err = r.error[:40] if r.error else "-"
            lines.append(f"| {r.name} | {status} | {r.duration}s | {cc} | {err} |")

        lines.extend(["", "## Notable Events", ""])
        for r in self.results:
            syntax_retries = self._count_events(r, "Syntax Fail")
            audits = self._count_events(r, "Audit Finished")
            outer_loops = self._count_events_by_role(r, "Planner", "Strategy Iter")

            if any([syntax_retries, audits > 1]):
                parts = []
                if syntax_retries:
                    parts.append(f"syntax retries={syntax_retries}")
                if audits > 1:
                    parts.append(f"audit cycles={audits}")
                if outer_loops > 1:
                    parts.append(f"outer loops={outer_loops}")
                lines.append(f"- **{r.name}**: {', '.join(parts)}")

        return "\n".join(lines)

    @staticmethod
    def _count_events(result: TestResult, keyword: str) -> int:
        return sum(1 for e in result.events if keyword in str(e.get("content", "")))

    @staticmethod
    def _count_events_by_role(result: TestResult, role: str, keyword: str) -> int:
        return sum(
            1 for e in result.events
            if e.get("role") == role and keyword in str(e.get("content", ""))
        )


async def main():
    parser = argparse.ArgumentParser(description="Integration test for Horizon Code")
    parser.add_argument("--uri", default="ws://localhost:8000/ws", help="WebSocket URI")
    parser.add_argument("--test", "-t", nargs="*", help="Specific test(s) to run (default: all)")
    parser.add_argument("--output", "-o", default="", help="Save results JSON to file")
    parser.add_argument("--report", "-r", default="", help="Save markdown report to file")
    args = parser.parse_args()

    tester = IntegrationTester(uri=args.uri)
    test_names = args.test if args.test else None
    await tester.run_all(test_names=test_names)
    tester.print_summary()

    report = tester.generate_report()
    print("\n" + report)

    if args.output:
        tester.save_results(args.output)
    if args.report:
        with open(args.report, "w") as f:
            f.write(report)
        print(f"Report saved to {args.report}")


if __name__ == "__main__":
    asyncio.run(main())
