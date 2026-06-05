"""Full pipeline test: 12 cases, one per intent, using real Orchestrator."""
import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List

sys.path.insert(0, ".")

from app.modules.agent_service import AgentService
from app.modules.orchestrator import Orchestrator
from app.modules.validator import Validator
from app.utils.types import ExitStatus


TEST_CASES: List[Dict[str, Any]] = [
    # ========== CONTROL_FLOW ==========
    {
        "name": "FLATTEN_CONDITIONAL_search",
        "code": """public boolean search(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return true;

        if (nums[mid] == nums[left]) {
            left++;
        } else if (nums[mid] > nums[left]) {
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else {
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
    }
    return false;
}""",
        "instruction": "Flatten the nested if-else in the search method using guard clauses with early returns. Each guard clause should handle one distinct case at the top and return immediately.",
    },
    {
        "name": "DECOMPOSE_CONDITIONAL_isMatch",
        "code": """public boolean isMatch(String s, String p) {
    int m = s.length(), n = p.length();
    int i = 0, j = 0, asterisk = -1, match = 0;
    while (i < m) {
        if (j < n && (s.charAt(i) == p.charAt(j) || p.charAt(j) == '?')) {
            i++; j++;
        } else if (j < n && p.charAt(j) == '*') {
            match = i;
            asterisk = j++;
        } else if (asterisk != -1) {
            i = ++match;
            j = asterisk + 1;
        } else {
            return false;
        }
    }
    while (j < n && p.charAt(j) == '*') j++;
    return j == n;
}""",
        "instruction": "Decompose the complex character matching condition `s.charAt(i) == p.charAt(j) || p.charAt(j) == '?'` by extracting it into a boolean variable `charMatch` before the while loop body.",
    },
    {
        "name": "CONSOLIDATE_CONDITIONAL_sortColors",
        "code": """public void sortColors(int[] nums) {
    int red = 0, white = 0, blue = nums.length - 1;
    while (white <= blue) {
        if (nums[white] == 0) {
            int temp = nums[red];
            nums[red++] = nums[white];
            nums[white++] = temp;
        } else if (nums[white] == 1) {
            white++;
        } else {
            int temp = nums[white];
            nums[white] = nums[blue];
            nums[blue--] = temp;
        }
    }
}""",
        "instruction": "Consolidate the three separate if-else branches for nums[white] == 0, 1, and 2 into a single switch statement with cases for each value.",
    },
    {
        "name": "REMOVE_CONTROL_FLAG_setZeroes",
        "code": """public void setZeroes(int[][] matrix) {
    int rows = matrix.length;
    int cols = matrix[0].length;
    boolean firstRow = false, firstCol = false;

    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            if (matrix[i][j] == 0) {
                if (i == 0) firstRow = true;
                if (j == 0) firstCol = true;
                matrix[i][0] = 0;
                matrix[0][j] = 0;
            }
        }
    }

    for (int i = 1; i < rows; i++) {
        for (int j = 1; j < cols; j++) {
            if (matrix[i][0] == 0 || matrix[0][j] == 0)
                matrix[i][j] = 0;
        }
    }

    if (firstRow) {
        for (int j = 0; j < cols; j++)
            matrix[0][j] = 0;
    }

    if (firstCol) {
        for (int i = 0; i < rows; i++)
            matrix[i][0] = 0;
    }
}""",
        "instruction": "Remove the firstRow and firstCol control flags. Instead, check matrix[0][j] and matrix[i][0] directly in the final zeroing loops by checking if any zero was marked in the first row/col.",
    },
    {
        "name": "REPLACE_LOOP_WITH_PIPELINE_grayCode",
        "code": """import java.util.ArrayList;
import java.util.List;

public List<Integer> grayCode(int n) {
    List<Integer> result = new ArrayList<>();
    for (int i = 0; i < (1 << n); i++) {
        result.add(i ^ (i >> 1));
    }
    return result;
}""",
        "instruction": "Replace the for-loop in grayCode with a Java Stream pipeline using IntStream.range, map, and boxed().collect(Collectors.toList()).",
    },
    {
        "name": "SPLIT_LOOP_sortColors",
        "code": """public void sortColors(int[] nums) {
    int red = 0, white = 0, blue = nums.length - 1;
    while (white <= blue) {
        if (nums[white] == 0) {
            int temp = nums[red];
            nums[red++] = nums[white];
            nums[white++] = temp;
        } else if (nums[white] == 1) {
            white++;
        } else {
            int temp = nums[white];
            nums[white] = nums[blue];
            nums[blue--] = temp;
        }
    }
}""",
        "instruction": "Split the single while loop that handles 0s, 1s, and 2s into three separate while loops: one for moving 0s to the front, one for the middle (1s), and one for 2s to the end.",
    },
    # ========== METHOD_MOVEMENT ==========
    {
        "name": "EXTRACT_METHOD_combine",
        "code": """import java.util.ArrayList;
import java.util.List;

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
}""",
        "instruction": "Extract the for-loop body inside backtrack into a private helper method called tryNext that takes (int i, int n, int k, List<Integer> current, List<List<Integer>> result).",
    },
    {
        "name": "INLINE_METHOD_isScramble",
        "code": """public boolean isScramble(String s1, String s2) {
    if (s1.equals(s2)) return true;
    if (sorted(s1).equals(sorted(s2)) == false) return false;

    for (int i = 1; i < s1.length(); i++) {
        if (isScramble(s1.substring(0, i), s2.substring(0, i)) && isScramble(s1.substring(i), s2.substring(i)))
            return true;
        if (isScramble(s1.substring(0, i), s2.substring(s2.length() - i)) && isScramble(s1.substring(i), s2.substring(0, s2.length() - i)))
            return true;
    }
    return false;
}

private String sorted(String s) {
    char[] chars = s.toCharArray();
    Arrays.sort(chars);
    return new String(chars);
}""",
        "instruction": "Inline the private sorted helper method directly into the two call sites in isScramble. Replace each sorted(...) call with the array sort + string construction logic inline.",
    },
    # ========== STATE_MANAGEMENT ==========
    {
        "name": "EXTRACT_VARIABLE_uniquePaths",
        "code": """public int uniquePathsWithObstacles(int[][] grid) {
    int m = grid.length;
    int n = grid[0].length;
    if (grid[0][0] == 1) return 0;

    grid[0][0] = 1;
    for (int i = 1; i < m; ++i)
        grid[i][0] = (grid[i][0] == 0 && grid[i - 1][0] == 1) ? 1 : 0;
    for (int i = 1; i < n; ++i)
        grid[0][i] = (grid[0][i] == 0 && grid[0][i - 1] == 1) ? 1 : 0;

    for (int i = 1; i < m; ++i)
        for (int j = 1; j < n; ++j)
            if (grid[i][j] == 0)
                grid[i][j] = grid[i - 1][j] + grid[i][j - 1];

    return grid[m - 1][n - 1];
}""",
        "instruction": "Extract the repeated expression `grid[i - 1][j] + grid[i][j - 1]` into a local variable `pathSum` inside the inner for loop.",
    },
    {
        "name": "INLINE_VARIABLE_search",
        "code": """public boolean search(int[] nums, int target) {
    int left = 0, right = nums.length - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return true;

        if (nums[mid] == nums[left]) {
            left++;
        } else if (nums[mid] > nums[left]) {
            if (nums[left] <= target && target < nums[mid]) {
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else {
            if (nums[mid] < target && target <= nums[right]) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
    }
    return false;
}""",
        "instruction": "Inline the local variable `mid` by replacing each occurrence of `mid` with `left + (right - left) / 2` directly in the expressions.",
    },
    {
        "name": "EXTRACT_CONSTANT_mySqrt",
        "code": """public int mySqrt(int x) {
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
}""",
        "instruction": "Extract the threshold values 0 and 1 in the base case check into named constants MIN_SQRT_INPUT and MAX_BASE_SMALL.",
    },
    {
        "name": "RENAME_SYMBOL_uniquePaths",
        "code": """public int uniquePathsWithObstacles(int[][] grid) {
    int m = grid.length;
    int n = grid[0].length;
    if (grid[0][0] == 1) return 0;

    grid[0][0] = 1;
    for (int i = 1; i < m; ++i)
        grid[i][0] = (grid[i][0] == 0 && grid[i - 1][0] == 1) ? 1 : 0;
    for (int i = 1; i < n; ++i)
        grid[0][i] = (grid[0][i] == 0 && grid[0][i - 1] == 1) ? 1 : 0;

    for (int i = 1; i < m; ++i)
        for (int j = 1; j < n; ++j)
            if (grid[i][j] == 0)
                grid[i][j] = grid[i - 1][j] + grid[i][j - 1];

    return grid[m - 1][n - 1];
}""",
        "instruction": "Rename m to rowCount and n to colCount throughout the entire method. Update every reference.",
    },
]


class MockDB:
    def __init__(self):
        self.sessions = {}
    def create_session(self, id=None, instruction="", original_code=""):
        self.sessions[id] = {}
    def log_status(self, **kw):
        pass
    def complete_session(self, **kw):
        pass
    def mark_as_halted(self, id):
        pass


class MockClient:
    def __init__(self, cid: str):
        self.id = cid
        self.statuses = []
        self.results = None
        self.log: List[Dict] = []
    async def send_status(self, role, content, phase=None, **kw):
        entry = {"role": role.value if hasattr(role, 'value') else str(role), "phase": phase, "content": str(content)[:500]}
        self.statuses.append((role, str(content)[:200]))
        self.log.append(entry)
    async def send_result(self, **kw):
        self.results = kw
        self.log.append({"event": "send_result", "data": {k: str(v)[:200] for k, v in kw.items()}})
    async def send_insights(self, insights):
        self.log.append({"event": "send_insights", "insights": str(insights)[:200]})


async def run_case(case: Dict[str, Any], index: int, total: int) -> Dict[str, Any]:
    case_name = case["name"]
    code = case["code"]
    instruction = case["instruction"]
    print(f"\n{'='*60}")
    print(f"[{index+1}/{total}] {case_name}")
    print(f"{'='*60}")
    print(f"Instruction: {instruction[:120]}...")

    agent = AgentService()
    validator = Validator()
    db = MockDB()

    orch = Orchestrator(agent, validator, db)
    orch.USE_SEQUENTIAL = True
    orch.SKIP_JUDGE = True

    client = MockClient(f"test-{case_name}")

    phase_log: List[Dict] = []
    t_start = time.time()
    try:
        await orch.execute_orchestration(client, code, instruction)
    except Exception as e:
        print(f"  Orchestration error: {e}")
        phase_log.append({"phase": "error", "error": str(e)[:300]})
    total_duration = int((time.time() - t_start) * 1000)

    state = getattr(orch, 'state', None)
    if state:
        original_cc = state.original_complexity
        working_code = state.working_code
        refactored_cc = validator.get_complexity(working_code)
        feedback = state.cumulative_feedback

        phase_log.append({
            "phase": "exit",
            "exit_status": state.exit_status.value if state.exit_status else "N/A",
            "strategy_iter": state.strategy_iter,
            "syntax_iter": state.syntax_iter,
            "current_phase": state.current_phase,
            "duration_ms": total_duration,
        })

        result = {
            "case": case_name,
            "instruction": instruction,
            "code": code,
            "exit_status": state.exit_status.value if state.exit_status else "N/A",
            "strategy_iter": state.strategy_iter,
            "syntax_iter": state.syntax_iter,
            "current_phase": state.current_phase,
            "total_duration_ms": total_duration,
            "original_cc": original_cc,
            "refactored_cc": refactored_cc,
            "cc_delta": refactored_cc - original_cc,
            "working_code_changed": working_code.strip() != code.strip(),
            "working_code_unchanged": working_code.strip() == code.strip(),
            "generated_code": working_code,
            "validation_findings": [
                {
                    "tier": str(f.failure_tier.value) if hasattr(f, 'failure_tier') else str(f),
                    "message": str(f.error_report.message) if hasattr(f, 'error_report') else str(f),
                }
                for f in feedback
            ] if feedback else [],
            "num_validation_findings": len(feedback),
            "mutation_index": state.mutation_index,
            "mutation_queue_len": len(state.mutation_queue) if hasattr(state, 'mutation_queue') else 0,
            "phase_log": phase_log,
        }

        if hasattr(state, 'gen_timings') and state.gen_timings:
            result["gen_timings"] = state.gen_timings
            ok_steps = sum(1 for t in state.gen_timings if t.get("status") == "OK")
            fail_steps = sum(1 for t in state.gen_timings if t.get("status") != "OK")
            result["gen_ok_steps"] = ok_steps
            result["gen_fail_steps"] = fail_steps
            total_gen = sum(t.get("time_ms", 0) for t in state.gen_timings)
            result["gen_total_time_ms"] = total_gen
        else:
            result["gen_timings"] = []
            result["gen_ok_steps"] = 0
            result["gen_fail_steps"] = 0
            result["gen_total_time_ms"] = 0

        if hasattr(state, 'intent_packet') and state.intent_packet:
            result["intent_packet"] = state.intent_packet
        if hasattr(state, 'active_plan') and state.active_plan:
            plan_copy = dict(state.active_plan)
            if "ast_mutations" in plan_copy:
                for m in plan_copy["ast_mutations"]:
                    dets = m.get("details")
                    if dets and isinstance(dets, dict) and "body_abstract" in dets:
                        dets["body_abstract"] = str(dets["body_abstract"])[:200]
            result["active_plan"] = plan_copy
    else:
        result = {
            "case": case_name,
            "instruction": instruction,
            "code": code,
            "error": "No state available",
            "total_duration_ms": total_duration,
            "phase_log": phase_log,
        }

    status = result.get('exit_status', '?')
    cc_delta = result.get('cc_delta', 0)
    gen_ok = result.get('gen_ok_steps', 0)
    gen_fail = result.get('gen_fail_steps', 0)
    findings = result.get('num_validation_findings', 0)
    unchanged = result.get('working_code_unchanged', False)
    print(f"  Status:   {status}{' (UNCHANGED)' if unchanged else ''}")
    print(f"  CC:       {result.get('original_cc', '?')} \u2192 {result.get('refactored_cc', '?')} (\u0394={cc_delta})")
    print(f"  Findings: {findings}")
    print(f"  Gen OK:   {gen_ok}/{gen_ok + gen_fail}")
    print(f"  Time:     {total_duration}ms")
    print(f"  Strategy: iter={result.get('strategy_iter', '?')}, syntax_iter={result.get('syntax_iter', '?')}")

    await agent.unload()
    return result


async def main() -> None:
    os.makedirs("test_results", exist_ok=True)

    print(f"\n{'='*60}")
    print("Full Pipeline Test \u2014 12 Cases (1 per Intent)")
    print(f"Mode: Orchestrator (USE_SEQUENTIAL=True, SKIP_JUDGE=True)")
    print(f"{'='*60}")

    all_results = []
    for i, case in enumerate(TEST_CASES):
        r = await run_case(case, i, len(TEST_CASES))
        all_results.append(r)

    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "total_cases": len(all_results),
        "config": {
            "USE_SEQUENTIAL": True,
            "SKIP_JUDGE": True,
        },
        "results": all_results,
    }
    output_path = "test_results/pipeline_12_results.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    status_ok = {"SUCCESS", "PROCESSING"}
    print(f"\n{'='*60}")
    print("SUMMARY \u2014 Full Pipeline 12 Cases")
    print(f"{'='*60}")
    cc_header = "CC \u0394"
    print(f"{'Case':40s} {'Status':15s} {cc_header:>5s} {'Findings':>9s} {'Gen OK':>7s} {'Time':>8s}")
    print("-" * 90)
    for r in all_results:
        findings = r.get('num_validation_findings', 0)
        cc_delta = r.get('cc_delta', 0)
        gen_ok = f"{r.get('gen_ok_steps', '?')}/{r.get('gen_ok_steps', 0) + r.get('gen_fail_steps', 0)}"
        status = r.get('exit_status', '?')
        if r.get('working_code_unchanged'):
            status += " (IDEN)"
        print(f"{r['case']:40s} {status:15s} {cc_delta:>+5d} {findings:>9d} {gen_ok:>7s} {r.get('total_duration_ms', 0):>8d}ms")

    passed = sum(1 for r in all_results if r.get('exit_status') in status_ok)
    failed = sum(1 for r in all_results if r.get('exit_status') not in status_ok and r.get('exit_status') != '?')
    print(f"\nTotal: {len(all_results)} | Pass: {passed} | Fail: {failed}")
    print(f"Results saved to {output_path}")


if __name__ == "__main__":
    asyncio.run(main())
