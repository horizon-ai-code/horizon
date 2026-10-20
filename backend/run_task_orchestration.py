import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone

_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.modules.agent import AgentService
from app.modules.validator import Validator
from app.modules.orchestrator import Orchestrator
from app.utils.performance import PerformanceTracker
from app.utils.types import ExitStatus, Role

TASKS = [
    {
        "num": 1,
        "name": "ApiRateLimitValidator",
        "code": """public class ApiRateLimitValidator {

    public boolean isRequestAllowed(String apiKey, int currentRate, int maxRate, boolean isIpWhitelisted, int payloadSizeKb) {
        if (apiKey != null && !apiKey.isEmpty()) {
            if (isIpWhitelisted) {
                return true;
            } else {
                if (currentRate < maxRate) {
                    if (payloadSizeKb <= 1024) {
                        return true;
                    } else {
                        return false;
                    }
                } else {
                    return false;
                }
            }
        } else {
            return false;
        }
    }
}""",
        "instruction": "Flatten the nested if-else statements in the isRequestAllowed method of the ApiRateLimitValidator class into linear guard clauses with early returns."
    },
    {
        "num": 2,
        "name": "UserRolePermissionService",
        "code": """import java.util.List;
import java.util.Map;

public class UserRolePermissionService {

    public boolean hasPermission(List<String> userRoles, Map<String, List<String>> rolePermissionsMap, String targetPermission) {
        if (userRoles == null || rolePermissionsMap == null || targetPermission == null) {
            return false;
        }

        boolean hasAccess = false;

        for (int i = 0; i < userRoles.size(); i++) {
            String role = userRoles.get(i);
            List<String> permissions = rolePermissionsMap.get(role);

            if (permissions != null) {
                for (int j = 0; j < permissions.size(); j++) {
                    if (targetPermission.equalsIgnoreCase(permissions.get(j))) {
                        hasAccess = true;
                        break;
                    }
                }
            }

            if (hasAccess) {
                break;
            }
        }

        return hasAccess;
    }
}""",
        "instruction": "Remove the boolean flag variable hasAccess in the hasPermission method of the UserRolePermissionService class and replace it with direct early returns inside the loop."
    },
    {
        "num": 3,
        "name": "Solution_Rotate",
        "code": """public class Solution {
    public void rotate(int[] nums, int k) {
        int n = nums.length;
        k = k % n;

        int i = 0, j = n - 1;
        while (i < j) {
            int temp = nums[i];
            nums[i] = nums[j];
            nums[j] = temp;
            i++;
            j--;
        }

        i = 0;
        j = k - 1;
        while (i < j) {
            int temp = nums[i];
            nums[i] = nums[j];
            nums[j] = temp;
            i++;
            j--;
        }

        i = k;
        j = n - 1;
        while (i < j) {
            int temp = nums[i];
            nums[i] = nums[j];
            nums[j] = temp;
            i++;
            j--;
        }
    }
}""",
        "instruction": "Extract the array reversal logic in the rotate method into a private helper method named reverse(int[] nums, int start, int end). Replace inline reversal loops with calls to reverse."
    },
    {
        "num": 4,
        "name": "Solution_ProcessAccountStatus",
        "code": """public class Solution {
    public String processAccountStatus(int age, boolean isVerified, double balance, String tier, boolean hasPendingDisputes) {
        if (isVerified) {
            if (age >= 18) {
                if (!hasPendingDisputes) {
                    if (balance >= 100.0) {
                        if ("VIP".equals(tier) || "GOLD".equals(tier)) {
                            return "ACCOUNT_PREMIUM_ACTIVE";
                        } else {
                            return "ACCOUNT_STANDARD_ACTIVE";
                        }
                    } else {
                        return "ERROR_INSUFFICIENT_FUNDS";
                    }
                } else {
                    return "ERROR_PENDING_DISPUTES";
                }
            } else {
                return "ERROR_UNDERAGE";
            }
        } else {
            return "ERROR_UNVERIFIED";
        }
    }
}""",
        "instruction": "Flatten the deep nested if-else statements in the processAccountStatus method by converting the failure checks into linear guard clauses with early returns at the top of the method."
    },
    {
        "num": 5,
        "name": "OrderDiscountService",
        "code": """import java.util.List;

public class OrderDiscountService {

    public double calculateStandardDiscount(double orderTotal) {
        if (orderTotal >= 100.0) {
            return orderTotal * 0.15;
        }
        return 0.0;
    }

    public double applyPromoCode(double orderTotal, String promoCode) {
        double baseDiscount = orderTotal * 0.15;
        if ("SUMMER15".equalsIgnoreCase(promoCode)) {
            return baseDiscount + 10.0;
        }
        return baseDiscount;
    }

    public double computeBulkDiscount(List<Double> itemPrices) {
        double subtotal = 0.0;
        for (double price : itemPrices) {
            subtotal += price;
        }
        if (itemPrices.size() >= 5) {
            return subtotal * 0.15;
        }
        return 0.0;
    }
}""",
        "instruction": "Extract the magic number 0.15 in the OrderDiscountService class into a named constant at the class level as a static final field named DEFAULT_DISCOUNT_RATE. Replace every occurrence of 0.15 with DEFAULT_DISCOUNT_RATE."
    },
    {
        "num": 6,
        "name": "Solution_MinCut",
        "code": """public class Solution {
    public int minCut(String s) {
        int n = s.length();
        int[] dp = new int[n + 1];
        boolean[][] isPalindrome = new boolean[n][n];

        for (int i = 0; i <= n; i++) {
            dp[i] = i - 1;
        }

        for (int j = 1; j < n; j++) {
            for (int i = j; i >= 0; i--) {
                if (s.charAt(i) == s.charAt(j) && (j - i < 2 || isPalindrome[i + 1][j - 1])) {
                    isPalindrome[i][j] = true;
                    dp[j + 1] = Math.min(dp[j + 1], dp[i] + 1);
                }
            }
        }

        return dp[n];
    }
}""",
        "instruction": "Decompose the compound condition s.charAt(i) == s.charAt(j) && (j - i < 2 || isPalindrome[i + 1][j - 1]) in the minCut method by extracting it into a boolean variable named isMatch defined before the if-statement. Replace the inline condition with the new variable."
    },
    {
        "num": 7,
        "name": "Solution_RemoveNthFromEnd",
        "code": """public class ListNode {
    int val;
    ListNode next;
    ListNode(int x) {
        val = x;
    }
}

public class Solution {
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
}""",
        "instruction": "Rename val to value throughout the entire removeNthFromEnd method. Update every reference — including loop bounds, array indexing, and any condition checks that use these variables."
    },
    {
        "num": 8,
        "name": "Solution_FindDerangement",
        "code": """public class Solution {
    public int findDerangement(int n) {
        final int MOD = 1000000007;
        long[] dp = new long[n + 1];
        dp[2] = 1;
        for (int i = 3; i <= n; ++i) {
            dp[i] = (i - 1) * (dp[i - 1] + dp[i - 2]) % MOD;
        }
        return (int)dp[n];
    }
}""",
        "instruction": "Extract the magic number 1000000007 in the findDerangement method into a named constant at the class level as a static final field. Replace every occurrence of 1000000007 with the new constant name."
    }
]

class MockDB:
    def create_session(self, **kw): pass
    def log_status(self, **kw): pass
    def complete_session(self, **kw): pass
    def mark_as_halted(self, **kw): pass

class LoggingClient:
    def __init__(self, cid: str):
        self.id = cid
        self.logs = []
        self.results = None

    @property
    def is_stale(self) -> bool:
        return False

    async def send_status(self, role, content, phase=None, **kw):
        entry = {
            "role": str(role.value) if hasattr(role, 'value') else str(role),
            "phase": phase,
            "content": content,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        self.logs.append(entry)
        print(f"[Phase {phase} - {role}] {json.dumps(content, indent=2) if isinstance(content, dict) else str(content)[:200]}")

    async def send_result(self, **kw):
        self.results = kw
        print(f"[RESULT] Exit: {kw.get('exit_status')}, Code Length: {len(kw.get('final_code', ''))}")

    async def send_insights(self, insights):
        print(f"[INSIGHTS] {insights}")

    async def send_phase_states(self, states, failing_phase, strategy_iteration, syntax_heal_attempt):
        pass

async def run_task(task_num: int):
    task = next(t for t in TASKS if t["num"] == task_num)
    print(f"==================================================")
    print(f"Running Task {task['num']}: {task['name']}")
    print(f"Instruction: {task['instruction']}")
    print(f"==================================================")

    agent = AgentService()
    validator = Validator()
    db = MockDB()
    client = LoggingClient(f"task-{task_num}")
    orch = Orchestrator(agent, validator, db)

    t0 = time.time()
    await orch.execute_orchestration(client, task["code"], task["instruction"])
    elapsed_ms = int((time.time() - t0) * 1000)

    state = getattr(orch, "state", None)
    result = {
        "num": task_num,
        "name": task["name"],
        "elapsed_ms": elapsed_ms,
        "exit_status": str(state.exit_status.value) if state else "UNKNOWN",
        "strategy_iter": state.strategy_iter if state else 0,
        "syntax_iter": state.syntax_iter if state else 0,
        "original_complexity": state.original_complexity if state else 0,
        "refactored_complexity": validator.get_complexity(state.working_code) if state else 0,
        "original_code": task["code"],
        "refactored_code": state.working_code if state else "",
        "logs": client.logs
    }

    out_file = f"task_{task_num}_result.json"
    with open(out_file, "w") as f:
        json.dump(result, f, indent=2)
    print(f"\nSaved task result to {out_file}")
    print(f"Total Duration: {elapsed_ms} ms")
    print(f"Outer Loops (strategy_iter): {result['strategy_iter']}")
    print(f"Inner Loops (syntax_iter): {result['syntax_iter']}")
    print(f"Refactored Code Preview:\n{result['refactored_code']}")

if __name__ == "__main__":
    task_num = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    asyncio.run(run_task(task_num))
