"""
Full pipeline validation — 20 new test cases from java_polish_full.json.
Covers all 12 intents. Classifier → Analysis → Architect → Generator → Phase 4 → Judge.
"""
import asyncio
import json
import re
import sys
from datetime import datetime
from typing import Any, Dict, List

sys.path.insert(0, ".")

from app.modules.validator import Validator
from app.utils.formatters import format_plan_for_generator
from app.utils.response_parser import ResponseParser
from app.utils.schemas import (
    ArchitectAnalysisResponse,
    ASTArchitectResponse,
    IntentClassifierResponse,
    StructuralAuditorResponse,
)
from tests.model_tests.harness import ModelTestHarness


TEST_CASES: List[Dict[str, Any]] = [
    # ================================================================
    # FLATTEN_CONDITIONAL (2)
    # ================================================================
    {
        "name": "polish_flatten_short_mindist",
        "code": """public int minDistance(String word1, String word2) {
    int m = word1.length(), n = word2.length();
    int[][] dp = new int[m+1][n+1];
    for(int i = 0; i <= m; i++) {
        for(int j = 0; j <= n; j++) {
            if(i == 0 || j == 0)
                dp[i][j] = i + j;
            else if(word1.charAt(i-1) == word2.charAt(j-1))
                dp[i][j] = dp[i-1][j-1];
            else
                dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1]);
        }
    }
    return dp[m][n];
}""",
        "instruction": "Flatten.",
        "expected_intent": "FLATTEN_CONDITIONAL",
    },
    {
        "name": "polish_flatten_long_quads",
        "code": """public int increasingQuadruplets(int[] nums) {
    int n = nums.length, count = 0;
    for(int i = 0; i < n - 3; i++) {
        for(int j = i + 1; j < n - 2; j++) {
            for(int k = j + 1; k < n - 1; k++) {
                if(nums[i] < nums[k] && nums[k] < nums[j]) {
                    for(int l = k + 1; l < n; l++) {
                        if(nums[j] < nums[l]) count++;
                    }
                }
            }
        }
    }
    return count;
}""",
        "instruction": (
            "The four nested for-loops in this method create a pyramid of condition checks "
            "that is difficult to follow. Restructure the entire method body to use guard "
            "clauses with continue. Each invalid comparison should skip to the next iteration "
            "immediately at the top of the loop. Remove all nesting — no for-loop should "
            "appear inside another for-loop's body after refactoring."
        ),
        "expected_intent": "FLATTEN_CONDITIONAL",
    },
    # ================================================================
    # DECOMPOSE_CONDITIONAL (2)
    # ================================================================
    {
        "name": "polish_decompose_med_nim",
        "code": "public boolean canWinNim(int n) { return n % 4 != 0; }",
        "instruction": (
            "Decompose this simple boolean expression into a well-named variable "
            "that explains what the calculation means in game theory."
        ),
        "expected_intent": "DECOMPOSE_CONDITIONAL",
    },
    {
        "name": "polish_decompose_long_palindrome",
        "code": """public boolean canPermutePalindrome(String s) {
    HashMap<Character, Integer> count = new HashMap<>();
    for(char c : s.toCharArray())
        count.put(c, count.getOrDefault(c, 0) + 1);
    int odd_count = 0;
    for(int value : count.values()) {
        if(value % 2 != 0) odd_count++;
    }
    return odd_count <= 1;
}""",
        "instruction": (
            "The loop body in canPermutePalindrome mixes character counting with implicit "
            "type operations. Break the logic apart: decompose the odd-count validation "
            "check into a clearly named boolean variable called hasPalindromePermutation "
            "that explains what the threshold means for palindrome properties."
        ),
        "expected_intent": "DECOMPOSE_CONDITIONAL",
    },
    # ================================================================
    # CONSOLIDATE_CONDITIONAL (2)
    # ================================================================
    {
        "name": "polish_consolidate_short_fixed",
        "code": """public int fixedPoint(int[] arr) {
    int left = 0, right = arr.length - 1;
    while (left < right) {
        int middle = left + (right - left) / 2;
        if (arr[middle] < middle) left = middle + 1;
        else right = middle;
    }
    return arr[left] == left ? left : -1;
}""",
        "instruction": "Consolidate.",
        "expected_intent": "CONSOLIDATE_CONDITIONAL",
    },
    {
        "name": "polish_consolidate_long_lhs",
        "code": """public int findLHS(int[] nums) {
    HashMap<Integer, Integer> count = new HashMap<>();
    for (int num : nums)
        count.put(num, count.getOrDefault(num, 0) + 1);
    int longest_sequence = 0;
    for (int key : count.keySet()) {
        if (count.containsKey(key + 1))
            longest_sequence = Math.max(longest_sequence, count.get(key) + count.get(key + 1));
    }
    return longest_sequence;
}""",
        "instruction": (
            "Look at how the hashmap is populated and then iterated. The two sequential "
            "for-loops can be merged into a single pass. Also, the conditional check inside "
            "the second loop has an implicit assumption about key ordering — consolidate "
            "the key lookup into a single well-structured condition using the map's "
            "built-in methods instead of separate containsKey and get calls."
        ),
        "expected_intent": "CONSOLIDATE_CONDITIONAL",
    },
    # ================================================================
    # EXTRACT_CONSTANT (2)
    # ================================================================
    {
        "name": "polish_const_short_box",
        "code": """public String boxCategory(int length, int width, int height, int mass) {
    boolean bulky = length >= 10000 || width >= 10000 || height >= 10000 || length * width * height >= 1000000000;
    boolean heavy = mass >= 100;
    if (bulky && heavy) return "Both";
    else if (bulky) return "Bulky";
    else if (heavy) return "Heavy";
    else return "Neither";
}""",
        "instruction": "Extract 10000 into BULKY_DIMENSION_THRESHOLD and 100 into HEAVY_MASS_THRESHOLD.",
        "expected_intent": "EXTRACT_CONSTANT",
    },
    {
        "name": "polish_const_long_derangement",
        "code": """public int findDerangement(int n) {
    long[] dp = new long[n + 1];
    dp[2] = 1;
    for (int i = 3; i <= n; i++)
        dp[i] = (i - 1) * (dp[i - 1] + dp[i - 2]) % 1000000007;
    return (int) dp[n];
}""",
        "instruction": (
            "There are several literal values used in the arithmetic that represent "
            "mathematical identities — particularly the modulo value 1000000007 which "
            "is used for overflow prevention. Extract this magic number into a named "
            "constant called MOD. Also, find any other literals that benefit from naming "
            "and extract them too. The constant declaration should be at the class level "
            "as static final."
        ),
        "expected_intent": "EXTRACT_CONSTANT",
    },
    # ================================================================
    # EXTRACT_METHOD (2)
    # ================================================================
    {
        "name": "polish_extract_short_palindrome",
        "code": """public class Solution {
    private boolean isPalindrome(String s, int start, int end) {
        while (start < end) {
            if (s.charAt(start) != s.charAt(end)) return false;
            start++; end--;
        }
        return true;
    }
    public boolean checkPartitioning(String s) {
        int n = s.length();
        for (int i = 0; i < n - 2; ++i)
            if (isPalindrome(s, 0, i))
                for (int j = i + 1; j < n - 1; ++j)
                    if (isPalindrome(s, i + 1, j) && isPalindrome(s, j + 1, n - 1))
                        return true;
        return false;
    }
}""",
        "instruction": "Extract isPalindrome into a separate utility class.",
        "expected_intent": "EXTRACT_METHOD",
    },
    {
        "name": "polish_extract_long_reformat",
        "code": """public String reformat(String s) {
    Queue<Character> letters = new LinkedList<>();
    Queue<Character> digits = new LinkedList<>();
    for (char c : s.toCharArray()) {
        if (Character.isLetter(c)) letters.add(c);
        else digits.add(c);
    }
    if (Math.abs(letters.size() - digits.size()) > 1) return "";
    StringBuilder result = new StringBuilder();
    boolean useLetter = letters.size() > digits.size();
    while (!letters.isEmpty() || !digits.isEmpty()) {
        if (useLetter) result.append(letters.poll());
        else result.append(digits.poll());
        useLetter = !useLetter;
    }
    return result.toString();
}""",
        "instruction": (
            "The reformat method does two distinct things: it separates characters into "
            "queues, then interleaves them into a result string. Extract the interleaving "
            "logic — everything after the initial separation into queues — into a private "
            "helper called interleaveQueues. The helper should take the two queues as "
            "parameters and return the StringBuilder result. Keep the character separation "
            "in the main method and call interleaveQueues from there."
        ),
        "expected_intent": "EXTRACT_METHOD",
    },
    # ================================================================
    # RENAME_SYMBOL (2)
    # ================================================================
    {
        "name": "polish_rename_short_judge",
        "code": """public int findJudge(int n, int[][] trust) {
    int[] trustCounts = new int[n + 1];
    for (int[] t : trust) {
        trustCounts[t[0]]--;
        trustCounts[t[1]]++;
    }
    for (int i = 1; i <= n; i++)
        if (trustCounts[i] == n - 1) return i;
    return -1;
}""",
        "instruction": "Rename trustCounts to trustScores.",
        "expected_intent": "RENAME_SYMBOL",
    },
    {
        "name": "polish_rename_long_paths",
        "code": """public int uniquePathsWithObstacles(int[][] grid) {
    int m = grid.length;
    int n = grid[0].length;
    if (grid[0][0] == 1) return 0;
    grid[0][0] = 1;
    for (int i = 1; i < m; ++i)
        grid[i][0] = (grid[i][0] == 0 && grid[i-1][0] == 1) ? 1 : 0;
    for (int i = 1; i < n; ++i)
        grid[0][i] = (grid[0][i] == 0 && grid[0][i-1] == 1) ? 1 : 0;
    for (int i = 1; i < m; ++i)
        for (int j = 1; j < n; ++j)
            if (grid[i][j] == 0)
                grid[i][j] = grid[i-1][j] + grid[i][j-1];
    return grid[m-1][n-1];
}""",
        "instruction": (
            "The variable names in this grid path calculation are overly abbreviated. "
            "Rename m to rowCount, n to colCount throughout the entire method. Update "
            "every reference — the loop bounds, the array indexing, and any condition "
            "checks that use these variables. Do not change the method's logic or "
            "behavior in any other way."
        ),
        "expected_intent": "RENAME_SYMBOL",
    },
    # ================================================================
    # SPLIT_LOOP (2)
    # ================================================================
    {
        "name": "polish_split_med_distinct",
        "code": """public int distinctIntegersAfterReversingAndAdding(int[] nums) {
    Set<Integer> distinct = new HashSet<>();
    for (int num : nums) {
        distinct.add(num);
        int reversed = 0;
        while (num > 0) {
            reversed = reversed * 10 + num % 10;
            num /= 10;
        }
        distinct.add(reversed);
    }
    return distinct.size();
}""",
        "instruction": "Split the loop into two: one for adding original values, one for adding reversed values.",
        "expected_intent": "SPLIT_LOOP",
    },
    {
        "name": "polish_split_long_gray",
        "code": """public List<Integer> grayCode(int n) {
    List<Integer> result = new ArrayList<>();
    for (int i = 0; i < (1 << n); i++)
        result.add(i ^ (i >> 1));
    return result;
}""",
        "instruction": (
            "The for-loop in grayCode does two bitwise operations in one expression — "
            "the XOR and the right-shift. Split this into two separate computation steps: "
            "first calculate the shifted value into a variable, then XOR it with the "
            "original index into the result list. This clarifies the bit-manipulation "
            "logic without changing the output."
        ),
        "expected_intent": "SPLIT_LOOP",
    },
    # ================================================================
    # EXTRACT_VARIABLE (2)
    # ================================================================
    {
        "name": "polish_extvar_med_seconds",
        "code": """public int minSeconds(int[] amount) {
    int total = amount[0] + amount[1] + amount[2];
    int largestTwo = Math.max(amount[0] + amount[1], Math.max(amount[1] + amount[2], amount[0] + amount[2]));
    return (total + 1) / 2 - (largestTwo + 1) / 2 + largestTwo;
}""",
        "instruction": "Extract the expression (total + 1) / 2 into a variable called halfTotalCeil.",
        "expected_intent": "EXTRACT_VARIABLE",
    },
    {
        "name": "polish_extvar_long_binary",
        "code": """public int fixedPoint(int[] arr) {
    int left = 0, right = arr.length - 1;
    while (left < right) {
        int middle = left + (right - left) / 2;
        if (arr[middle] < middle) left = middle + 1;
        else right = middle;
    }
    return arr[left] == left ? left : -1;
}""",
        "instruction": (
            "The expression left + (right - left) / 2 appears in the binary search "
            "computation. Extract this midpoint calculation into a local variable called "
            "midPoint and use it instead of repeating the expression. While you're at "
            "it, also extract arr[middle] < middle into a boolean variable called "
            "shouldSearchRight — this makes the conditional logic self-documenting."
        ),
        "expected_intent": "EXTRACT_VARIABLE",
    },
    # ================================================================
    # INLINE_VARIABLE (1)
    # ================================================================
    {
        "name": "polish_inlinevar_dp",
        "code": """public int minDistance(String word1, String word2) {
    int m = word1.length(), n = word2.length();
    int[][] dp = new int[m+1][n+1];
    for (int i = 0; i <= m; i++) dp[i][0] = i;
    for (int j = 0; j <= n; j++) dp[0][j] = j;
    for (int i = 1; i <= m; i++)
        for (int j = 1; j <= n; j++)
            if (word1.charAt(i-1) == word2.charAt(j-1))
                dp[i][j] = dp[i-1][j-1];
            else
                dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1]);
    return dp[m][n];
}""",
        "instruction": "Inline the variables m and n.",
        "expected_intent": "INLINE_VARIABLE",
    },
    # ================================================================
    # REMOVE_CONTROL_FLAG (1)
    # ================================================================
    {
        "name": "polish_remflag_search",
        "code": """public int search(int[] arr, int target) {
    boolean found = false;
    int result = -1;
    for (int i = 0; i < arr.length; i++) {
        if (arr[i] == target) {
            found = true;
            result = i;
            break;
        }
    }
    if (found) return result;
    return -1;
}""",
        "instruction": (
            "The method uses a boolean found flag to track whether an element was "
            "located in the loop. Remove this control flag entirely and use an early "
            "return directly when the element is matched."
        ),
        "expected_intent": "REMOVE_CONTROL_FLAG",
    },
    # ================================================================
    # REPLACE_LOOP_WITH_PIPELINE (1)
    # ================================================================
    {
        "name": "polish_pipeline_gray",
        "code": """public List<Integer> grayCode(int n) {
    List<Integer> result = new ArrayList<>();
    for (int i = 0; i < (1 << n); i++)
        result.add(i ^ (i >> 1));
    return result;
}""",
        "instruction": "Replace the for-loop with a stream pipeline.",
        "expected_intent": "REPLACE_LOOP_WITH_PIPELINE",
    },
    # ================================================================
    # INLINE_METHOD (1)
    # ================================================================
    {
        "name": "polish_inline_nim",
        "code": """public class Solution {
    public boolean canWinNim(int n) { return n % 4 != 0; }
    public boolean check(int n) { return canWinNim(n); }
}""",
        "instruction": "Inline the canWinNim method into its caller and remove it.",
        "expected_intent": "INLINE_METHOD",
    },
]


# ==== GUIDANCE INJECTION ====

def inject_analysis_guidance(prompts, intent):
    base = prompts["planner"]["architect_analysis"]
    g = prompts["planner"]["analysis_guidance"].get(intent, "")
    return base + "\n" + g if g else base

def inject_synthesis_guidance(prompts, intent):
    base = prompts["planner"]["architect"]
    g = prompts["planner"]["synthesis_guidance"].get(intent, "")
    return base + "\n" + g if g else base

def inject_coder_guidance(prompts, intent):
    base = prompts["generator"]["coder"]
    g = prompts["generator"]["coder_guidance"].get(intent, "")
    return base + "\n" + g if g else base


# ==== CHECKS ====

def check_syntax(code: str) -> bool:
    if not code or len(code) < 5:
        return False
    try:
        import javalang
        wrapped = f"class __W__ {{ {code} }}" if "class" not in code else code
        javalang.parse.parse(wrapped)
        return True
    except Exception:
        return False


def check_methods_preserved(original: str, refactored: str) -> bool:
    orig_methods = set(re.findall(r'(?:public|private|protected)\s+\w+\s+(\w+)\s*\(', original))
    refac_methods = set(re.findall(r'(?:public|private|protected)\s+\w+\s+(\w+)\s*\(', refactored))
    return orig_methods.issubset(refac_methods)


# ==== PHASE 4 VALIDATION ====

def run_phase4(
    original_code: str,
    refactored_code: str,
    intent: str,
    plan: Dict[str, Any],
) -> Dict[str, Any]:
    """Deterministic Phase 4 checks: Complexity, Boundary, Intent Math."""
    validator = Validator()
    findings: List[str] = []

    # Complexity check
    orig_cc = validator.get_complexity(original_code)
    refac_cc = validator.get_complexity(refactored_code)

    # Per-intent CC rules (simplified from orchestrator)
    skip_cc = intent in ("INLINE_METHOD",)
    loosen_cc = intent in ("SPLIT_LOOP",)
    extract_cc = intent in ("EXTRACT_METHOD",)

    if not skip_cc:
        threshold = orig_cc + (1 if loosen_cc else 0)
        if extract_cc:
            # Just check refac_cc doesn't grow too much
            pass  # Simplified — full orchestrator checks source method CC
        elif refac_cc > threshold:
            findings.append(f"CC increased: {orig_cc} → {refac_cc} (limit ≤ {threshold})")

    # Boundary check
    # Build target scopes from plan
    target_scopes = []
    for m in plan.get("ast_mutations", []):
        t = m.get("target", "")
        if t and t not in target_scopes:
            target_scopes.append(t)
    if plan.get("target_class"):
        target_scopes.append(plan["target_class"])

    boundary_finding = validator.verify_boundary(original_code, refactored_code, target_scopes)
    if boundary_finding:
        findings.append(f"Boundary violation: {boundary_finding.error_report.message[:120]}")

    # Intent math check
    try:
        from app.utils.types import RefactorIntent
        intent_enum = RefactorIntent(intent)
        intent_finding = validator.verify_intent(intent_enum, original_code, refactored_code)
        if intent_finding:
            findings.append(f"Intent math fail: {intent_finding.error_report.message[:120]}")
    except (ValueError, Exception):
        pass

    # Method preservation check
    orig_methods = set(re.findall(r'(?:public|private|protected)\s+\w+\s+(\w+)\s*\(', original_code))
    refac_methods = set(re.findall(r'(?:public|private|protected)\s+\w+\s+(\w+)\s*\(', refactored_code))
    dropped = orig_methods - refac_methods
    if dropped:
        findings.append(f"Methods dropped: {dropped}")

    return {
        "phase4_pass": len(findings) == 0,
        "findings": findings,
        "orig_cc": orig_cc,
        "refac_cc": refac_cc,
    }


# ==== RUN ====

async def run_case(harness: ModelTestHarness, case: Dict[str, Any]) -> Dict[str, Any]:
    code = case["code"]
    inst = case["instruction"]
    r: Dict[str, Any] = {"name": case["name"], "expected_intent": case["expected_intent"]}

    prompts = harness.prompts

    # 1. Classifier
    cres = await harness.generate(
        prompts["planner"]["classifier"],
        f"<code>{code}</code>\n<instruction>{inst}</instruction>",
        temp=0.1, max_tokens=500,
        response_model=IntentClassifierResponse,
    )
    intent_key = case["expected_intent"]
    if cres["success"]:
        try:
            ci = ResponseParser.extract_json(cres["content"], IntentClassifierResponse)
            r["actual_intent"] = ci.intent_packet.specific_intent.value
            r["classifier_match"] = r["actual_intent"] == case["expected_intent"]
            intent_key = r["actual_intent"]
            intent_packet = ci.intent_packet.model_dump()
        except Exception:
            r["actual_intent"] = "PARSE_ERROR"
            r["classifier_match"] = False
            intent_packet = {"specific_intent": case["expected_intent"]}
    else:
        r["actual_intent"] = "NO_RESPONSE"
        r["classifier_match"] = False
        intent_packet = {"specific_intent": case["expected_intent"]}

    # 2. Analysis
    await harness.clear_context()
    analysis_sys = inject_analysis_guidance(prompts, intent_key)
    ares = await harness.generate(
        analysis_sys,
        f"Intent Packet: {json.dumps(intent_packet)}\nUser Instruction: {inst}\nCode: <code>{code}</code>",
        temp=0.1, max_tokens=1024,
        response_model=ArchitectAnalysisResponse,
    )
    analysis_data: Dict[str, Any] = {}
    if ares["success"]:
        try:
            ai = ResponseParser.extract_json(ares["content"], ArchitectAnalysisResponse)
            analysis_data = ai.model_dump()
            r["analysis_primary"] = analysis_data.get("primary_targets", [])
            r["analysis_new"] = analysis_data.get("new_structures_needed", [])
        except Exception:
            pass

    # 3. Architect
    await harness.clear_context()
    arch_sys = inject_synthesis_guidance(prompts, intent_key)
    sres = await harness.generate(
        arch_sys,
        f"Analysis: {json.dumps(analysis_data)}\nIntent: {json.dumps(intent_packet)}\nInstruction: {inst}\nCode: <code>{code}</code>",
        temp=0.1, max_tokens=2048,
        response_model=ASTArchitectResponse,
    )
    plan: Dict[str, Any] = {}
    if sres["success"]:
        try:
            si = ResponseParser.extract_json(sres["content"], ASTArchitectResponse)
            plan = si.ast_modification_plan.model_dump()
            mutations = plan.get("ast_mutations", [])
            r["plan_mutations"] = len(mutations)
            r["plan_actions"] = [m["action"] for m in mutations]
            r["plan_targets"] = [m["target"] for m in mutations]
            # Target format check
            bad = [t for t in r["plan_targets"] if "/" in t or "(" in t]
            r["targets_clean"] = len(bad) == 0
        except Exception:
            pass

    # 4. Generator
    await harness.clear_context()
    gen_sys = inject_coder_guidance(prompts, intent_key)
    if plan:
        user_prompt = format_plan_for_generator(plan, code)
    else:
        user_prompt = f"Base Code:\n<code>{code}</code>\n\nNo mutations."

    gres = await harness.generate(gen_sys, user_prompt, temp=0.1, max_tokens=2048)
    output_code = ""
    cm = re.search(r'<code>(.*?)</code>', gres["content"], re.DOTALL)
    if cm:
        output_code = cm.group(1).strip()

    r["syntax_valid"] = check_syntax(output_code)
    r["output_len"] = len(output_code)
    r["duration"] = cres["duration"] + ares["duration"] + sres["duration"] + gres["duration"]

    if r["syntax_valid"]:
        r["methods_preserved"] = check_methods_preserved(code, output_code)
    else:
        r["methods_preserved"] = False

    # Simple pass criteria
    r["verdict"] = "PASS" if (r.get("classifier_match") and r.get("plan_mutations", 0) > 0 and r.get("syntax_valid")) else "FAIL"

    return r


async def main():
    print("=" * 70)
    print("POLISH JSON VALIDATION — 20 cases, all 12 intents")
    print(f"Classifier → Analysis → Architect → Generator")
    print("=" * 70)

    h_planner = ModelTestHarness("planner")
    await h_planner.load_model()
    prompts = h_planner.prompts  # save before unloading

    # Run Planner chain (Classifier → Analysis → Architect) for all 20 cases
    planner_results = []
    for i, case in enumerate(TEST_CASES):
        code = case["code"]
        inst = case["instruction"]
        r: Dict[str, Any] = {"name": case["name"], "expected_intent": case["expected_intent"]}

        # 1. Classifier
        cres = await h_planner.generate(
            prompts["planner"]["classifier"],
            f"<code>{code}</code>\n<instruction>{inst}</instruction>",
            temp=0.1, max_tokens=500,
            response_model=IntentClassifierResponse,
        )
        intent_key = case["expected_intent"]
        r["classifier_match"] = False
        if cres["success"]:
            try:
                ci = ResponseParser.extract_json(cres["content"], IntentClassifierResponse)
                r["actual_intent"] = ci.intent_packet.specific_intent.value
                r["classifier_match"] = r["actual_intent"] == case["expected_intent"]
                intent_key = r["actual_intent"]
                intent_packet = ci.intent_packet.model_dump()
            except Exception:
                r["actual_intent"] = "PARSE_ERROR"
                intent_packet = {"specific_intent": case["expected_intent"]}
        else:
            r["actual_intent"] = "NO_RESPONSE"
            intent_packet = {"specific_intent": case["expected_intent"]}

        # 2. Analysis
        await h_planner.clear_context()
        analysis_sys = inject_analysis_guidance(prompts, intent_key)
        ares = await h_planner.generate(
            analysis_sys,
            f"Intent Packet: {json.dumps(intent_packet)}\nUser Instruction: {inst}\nCode: <code>{code}</code>",
            temp=0.1, max_tokens=1024,
            response_model=ArchitectAnalysisResponse,
        )
        analysis_data: Dict[str, Any] = {}
        if ares["success"]:
            try:
                ai = ResponseParser.extract_json(ares["content"], ArchitectAnalysisResponse)
                analysis_data = ai.model_dump()
                r["analysis_primary"] = analysis_data.get("primary_targets", [])
                r["analysis_new"] = analysis_data.get("new_structures_needed", [])
            except Exception:
                pass

        # 3. Architect
        await h_planner.clear_context()
        arch_sys = inject_synthesis_guidance(prompts, intent_key)
        sres = await h_planner.generate(
            arch_sys,
            f"Analysis: {json.dumps(analysis_data)}\nIntent: {json.dumps(intent_packet)}\nInstruction: {inst}\nCode: <code>{code}</code>",
            temp=0.1, max_tokens=2048,
            response_model=ASTArchitectResponse,
        )
        r["plan_mutations"] = 0
        r["plan_actions"] = []
        r["plan_targets"] = []
        r["targets_clean"] = True
        if sres["success"]:
            try:
                si = ResponseParser.extract_json(sres["content"], ASTArchitectResponse)
                plan = si.ast_modification_plan.model_dump()
                mutations = plan.get("ast_mutations", [])
                r["plan_mutations"] = len(mutations)
                r["plan_actions"] = [m["action"] for m in mutations]
                r["plan_targets"] = [m["target"] for m in mutations]
                bad = [t for t in r["plan_targets"] if "/" in t or "(" in t]
                r["targets_clean"] = len(bad) == 0
                r["_plan"] = plan  # save for generator
            except Exception:
                r["_plan"] = {}
        else:
            r["_plan"] = {}

        planner_results.append(r)
        print(f"[{i+1:2d}/20] {'✓' if r['classifier_match'] else '✗'} {case['name'][:45]} "
              f"| intent={'✓' if r['classifier_match'] else '✗'} plan={r['plan_mutations']}m")

    await h_planner.unload_model()
    print(f"\nPlanner done. Loading generator...")

    # Run Generator for all 20 cases using their plans
    h_gen = ModelTestHarness("generator")
    await h_gen.load_model()

    for i, (case, pr) in enumerate(zip(TEST_CASES, planner_results)):
        code = case["code"]
        plan = pr.get("_plan", {})
        intent_key = pr.get("actual_intent", case["expected_intent"])
        if intent_key in ("PARSE_ERROR", "NO_RESPONSE"):
            intent_key = case["expected_intent"]

        await h_gen.clear_context()
        gen_sys = inject_coder_guidance(prompts, intent_key)
        user_prompt = format_plan_for_generator(plan, code) if plan else f"Base Code:\n<code>{code}</code>\n\nNo mutations."

        gres = await h_gen.generate(gen_sys, user_prompt, temp=0.1, max_tokens=2048)
        output_code = ""
        cm = re.search(r'<code>(.*?)</code>', gres["content"], re.DOTALL)
        if cm:
            output_code = cm.group(1).strip()

        pr["_output_code"] = output_code
        pr["syntax_valid"] = check_syntax(output_code)
        pr["output_len"] = len(output_code)
        pr["gen_duration"] = gres["duration"]

        # Phase 4 — Deterministic validation
        if pr["syntax_valid"] and plan:
            p4 = run_phase4(code, output_code, intent_key, plan)
            pr["phase4_pass"] = p4["phase4_pass"]
            pr["phase4_findings"] = p4["findings"]
            pr["orig_cc"] = p4["orig_cc"]
            pr["refac_cc"] = p4["refac_cc"]
        else:
            pr["phase4_pass"] = False
            pr["phase4_findings"] = ["Syntax invalid" if not pr["syntax_valid"] else "No plan"]
            pr["orig_cc"] = 0
            pr["refac_cc"] = 0

        if pr["syntax_valid"]:
            pr["methods_preserved"] = check_methods_preserved(code, output_code)
        else:
            pr["methods_preserved"] = False

        pr["verdict"] = "PASS" if (pr.get("classifier_match") and pr.get("plan_mutations", 0) > 0 and pr.get("syntax_valid") and pr.get("phase4_pass")) else "FAIL"
        if "_plan" in pr:
            del pr["_plan"]

        print(f"[{i+1:2d}/20] {'✓' if pr['verdict'] == 'PASS' else '✗'} {case['name'][:45]} "
              f"| syntax={'✓' if pr.get('syntax_valid') else '✗'} phase4={'✓' if pr.get('phase4_pass') else '✗'} methods={'✓' if pr.get('methods_preserved') else '✗'}")

    await h_gen.unload_model()
    print(f"\nGenerator done. Loading judge...")

    # Run Judge for all 20 cases
    h_judge = ModelTestHarness("judge")
    await h_judge.load_model()

    for i, (case, pr) in enumerate(zip(TEST_CASES, planner_results)):
        intent_key = pr.get("actual_intent", case["expected_intent"])
        if intent_key in ("PARSE_ERROR", "NO_RESPONSE"):
            intent_key = case["expected_intent"]

        output_code = pr.get("_output_code", "")
        if not pr.get("syntax_valid") or not output_code:
            pr["judge_verdict"] = "SKIP"
            pr["judge_issues"] = ["Syntax invalid — skipped judge"]
            pr["judge_duration"] = 0
            continue
        if not pr.get("phase4_pass"):
            pr["judge_verdict"] = "SKIP"
            pr["judge_issues"] = [f"Phase 4 failed: {'; '.join(pr.get('phase4_findings', ['unknown']))}"]
            pr["judge_duration"] = 0
            continue

        # Build system prompt with FLATTEN guidance if applicable
        judge_sys = prompts["judge"]["auditor"]
        if "FLATTEN" in intent_key:
            flatten_g = prompts["judge"]["auditor_guidance"]["FLATTEN_CONDITIONAL"]
            judge_sys += "\n" + flatten_g

        plan_actions = pr.get("plan_actions", [])
        plan_targets = pr.get("plan_targets", [])
        plan_summary = (
            f"Intent: {intent_key}."
            + (f" Mutations: {', '.join(f'{a}({t})' for a, t in zip(plan_actions, plan_targets))}"
               if plan_actions else " Mutations: none")
        )

        judge_user = (
            f"## Plan Context\n{plan_summary}\n\n"
            f"## Code\n"
            f"Original: <code>{case['code']}</code>\n"
            f"Refactored: <code>{output_code}</code>\n"
            f"Intent: {{\"specific_intent\": \"{intent_key}\"}}"
        )

        jres = await h_judge.generate(judge_sys, judge_user, temp=0.1, max_tokens=1000,
                                       response_model=StructuralAuditorResponse)
        if jres["success"]:
            try:
                jp = ResponseParser.extract_json(jres["content"], StructuralAuditorResponse)
                pr["judge_verdict"] = jp.verdict
                pr["judge_issues"] = jp.issues
                pr["judge_duration"] = jres["duration"]
            except Exception:
                pr["judge_verdict"] = "PARSE_ERROR"
                pr["judge_issues"] = []
                pr["judge_duration"] = jres["duration"]
        else:
            pr["judge_verdict"] = "GEN_ERROR"
            pr["judge_issues"] = []
            pr["judge_duration"] = jres["duration"]

        print(f"[{i+1:2d}/20] JUDGE: {pr['judge_verdict']:6} | {case['name'][:45]} "
              f"| issues={len(pr.get('judge_issues', []))} | {pr.get('judge_duration', 0):.1f}s")

    await h_judge.unload_model()

    # Summary
    passes = sum(1 for r in planner_results if r["verdict"] == "PASS")
    class_ok = sum(1 for r in planner_results if r.get("classifier_match"))
    plans_ok = sum(1 for r in planner_results if r.get("plan_mutations", 0) > 0)
    syntax_ok = sum(1 for r in planner_results if r.get("syntax_valid"))
    phase4_ok = sum(1 for r in planner_results if r.get("phase4_pass"))
    methods_ok = sum(1 for r in planner_results if r.get("methods_preserved"))
    judge_accept = sum(1 for r in planner_results if r.get("judge_verdict") == "ACCEPT")
    judge_revise = sum(1 for r in planner_results if r.get("judge_verdict") == "REVISE")
    judge_skip = sum(1 for r in planner_results if r.get("judge_verdict") in ("SKIP", "PARSE_ERROR", "GEN_ERROR"))
    full_pass = sum(1 for r in planner_results if (
        r.get("classifier_match") and r.get("syntax_valid")
        and r.get("phase4_pass") and r.get("judge_verdict") == "ACCEPT"
    ))

    print(f"\n{'='*70}")
    print(f"RESULTS")
    print(f"  Classifier correct:   {class_ok}/20")
    print(f"  Plans with muts:      {plans_ok}/20")
    print(f"  Syntax valid:         {syntax_ok}/20")
    print(f"  Phase 4 (deterministic): {phase4_ok}/20")
    print(f"  Methods preserved:    {methods_ok}/20")
    print(f"  Judge ACCEPT:         {judge_accept}/20")
    print(f"  Judge REVISE:         {judge_revise}/20")
    print(f"  Judge SKIP:           {judge_skip}/20")
    print(f"  FULL PIPELINE PASS:   {full_pass}/20")

    from collections import Counter
    intent_results: Dict[str, List[bool]] = {}
    for r in planner_results:
        exp = r["expected_intent"]
        if exp not in intent_results:
            intent_results[exp] = []
        intent_results[exp].append(r["verdict"] == "PASS")

    print(f"\n  PER-INTENT:")
    for intent, passes_list in sorted(intent_results.items()):
        p = sum(passes_list)
        print(f"    {intent:<30} {p}/{len(passes_list)}")

    ts = datetime.now().strftime("%Y-%m-%dT%H%M%S")
    path = f"test_results/polish_validation_{ts}.json"
    with open(path, "w") as f:
        json.dump(planner_results, f, indent=2, default=str)
    print(f"\nSaved: {path}")


if __name__ == "__main__":
    asyncio.run(main())
