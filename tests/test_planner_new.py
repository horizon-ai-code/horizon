"""Isolated planner test with 5 new polish.json cases."""
import asyncio
import json
import os
import sys
import time
from typing import Any, Dict, List

sys.path.insert(0, ".")

import yaml
from llama_cpp import ChatCompletionRequestMessage

from app.modules.agent_service import AgentService
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.response_parser import ResponseParser
from app.utils.schemas import (
    ArchitectAnalysisResponse,
    ASTArchitectResponse,
    IntentClassifierResponse,
)


TEST_CASES: List[Dict[str, Any]] = [
    {
        "name": "RENAME_SWAP_PAIRS",
        "code": """public ListNode swapPairs(ListNode head) {
    if (head == null || head.next == null) return head;

    ListNode second = head.next;
    head.next = swapPairs(second.next);
    second.next = head;

    return second;
}""",
        "instruction": "Rename the method `swapPairs` to `swapAdjacentNodes` for clarity.",
        "expected_intent": "RENAME_SYMBOL",
    },
    {
        "name": "EXTRACT_FIND_SUBSTRING",
        "code": """import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public List<Integer> findSubstring(String s, String[] words) {
    if (s == null || s.length() == 0 || words == null || words.length == 0) return new ArrayList<>();

    Map<String, Integer> word_count = new HashMap<>();
    for (String word : words) {
        word_count.put(word, word_count.getOrDefault(word, 0) + 1);
    }

    int word_length = words[0].length();
    int total_words = words.length;
    int total_length = word_length * total_words;
    List<Integer> result = new ArrayList<>();

    for (int i = 0; i <= s.length() - total_length; i++) {
        Map<String, Integer> temp_word_count = new HashMap<>();
        for (int j = 0; j < total_words; j++) {
            String current_word = s.substring(i + j * word_length, i + (j + 1) * word_length);
            if (!word_count.containsKey(current_word)) break;
            temp_word_count.put(current_word, temp_word_count.getOrDefault(current_word, 0) + 1);
            if (temp_word_count.get(current_word) > word_count.get(current_word)) break;
            if (j + 1 == total_words) result.add(i);
        }
    }

    return result;
}""",
        "instruction": "Extract the inner loop's word validation logic into a separate helper method called isValidWordSequence. The helper should take the current index i, word_count map, word_length, total_words, and s as parameters and return boolean.",
        "expected_intent": "EXTRACT_METHOD",
    },
    {
        "name": "CONSTANT_COUNT_AND_SAY",
        "code": """public String countAndSay(int n) {
    if (n == 1) return "1";
    String previous = countAndSay(n-1);
    StringBuilder result = new StringBuilder();
    int count = 1;
    for (int i = 1; i < previous.length(); i++) {
        if (previous.charAt(i) == previous.charAt(i-1)) {
            count++;
        } else {
            result.append(count).append(previous.charAt(i-1));
            count = 1;
        }
    }
    result.append(count).append(previous.charAt(previous.length()-1));
    return result.toString();
}""",
        "instruction": "Extract the base case string literal '1' into a named constant BASE_CASE_STRING.",
        "expected_intent": "EXTRACT_CONSTANT",
    },
    {
        "name": "DECOMPOSE_JUMP_GAME",
        "code": """public int jump(int[] nums) {
    int jumps = 0, currentEnd = 0, currentFarthest = 0;

    for (int i = 0; i < nums.length - 1; i++) {
        currentFarthest = Math.max(currentFarthest, i + nums[i]);
        if (i == currentEnd) {
            jumps++;
            currentEnd = currentFarthest;
        }
    }
    return jumps;
}""",
        "instruction": "Decompose the jump condition `i == currentEnd` by extracting it into a boolean variable `needToJump`.",
        "expected_intent": "DECOMPOSE_CONDITIONAL",
    },
    {
        "name": "FLATTEN_EDIT_DISTANCE",
        "code": """public int minDistance(String word1, String word2) {
    int m = word1.length();
    int n = word2.length();
    int[][] dp = new int[m + 1][n + 1];

    for (int i = 0; i <= m; i++) {
        for (int j = 0; j <= n; j++) {
            if (i == 0) {
                dp[i][j] = j;
            } else if (j == 0) {
                dp[i][j] = i;
            } else if (word1.charAt(i - 1) == word2.charAt(j - 1)) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.min(Math.min(dp[i - 1][j], dp[i][j - 1]), dp[i - 1][j - 1]) + 1;
            }
        }
    }

    return dp[m][n];
}""",
        "instruction": "Flatten the nested if-else chain in the DP loop by using guard clauses with early assignment. Each branch should assign dp[i][j] and continue the loop immediately.",
        "expected_intent": "FLATTEN_CONDITIONAL",
    },
]


def load_configs():
    with open(MODELS_CONFIG_PATH) as f:
        model_config = yaml.safe_load(f)
    with open(PROMPTS_CONFIG_PATH) as f:
        prompts = yaml.safe_load(f)
    return model_config, prompts


async def test_planner_case(
    agent: AgentService,
    prompts: Dict,
    case: Dict[str, Any],
) -> Dict[str, Any]:
    case_name = case["name"]
    code = case["code"]
    instruction = case["instruction"]

    result = {
        "case": case_name,
        "expected_intent": case["expected_intent"],
        "code": code,
        "instruction": instruction,
    }

    # --- Step 1: Classifier ---
    prompt = f"<code>{code}</code>\n<instruction>{instruction}</instruction>"
    messages: List[ChatCompletionRequestMessage] = [
        {"role": "system", "content": prompts["planner"]["classifier"]},
        {"role": "user", "content": prompt},
    ]

    t0 = time.time()
    try:
        raw = await agent.generate(
            messages, temp=0.1, max_tokens=500, response_model=IntentClassifierResponse
        )
        classifier_text = raw["choices"][0]["message"].get("content") or ""
        cls_tokens = raw["usage"]["completion_tokens"]
        classifier_res = ResponseParser.extract_json(classifier_text, IntentClassifierResponse)
        intent_packet = classifier_res.intent_packet.model_dump()
        classifier_ok = True
        classifier_error = None
    except Exception as e:
        classifier_ok = False
        classifier_error = str(e)[:200]
        classifier_text = ""
        cls_tokens = 0
        intent_packet = None

    result["classifier_ok"] = classifier_ok
    result["classifier_error"] = classifier_error
    result["classifier_text"] = classifier_text
    result["classifier_tokens"] = cls_tokens

    if not classifier_ok or not intent_packet:
        result["time_ms"] = int((time.time() - t0) * 1000)
        return result

    await agent.clear_context()

    # --- Step 2: Architect Analysis ---
    analysis_prompt = (
        f"Intent Packet: {json.dumps(intent_packet)}\n"
        f"User Instruction: {instruction}\n"
        f"Code: <code>{code}</code>"
    )
    system_content = prompts["planner"]["architect_analysis"]
    intent_key = intent_packet.get("specific_intent", "")
    guidance = prompts["planner"]["analysis_guidance"].get(intent_key, "")
    if guidance:
        system_content += "\n" + guidance

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": analysis_prompt},
    ]

    try:
        raw = await agent.generate(
            messages, temp=0.1, max_tokens=1024, response_model=ArchitectAnalysisResponse
        )
        analysis_text = raw["choices"][0]["message"].get("content") or ""
        analysis_tokens = raw["usage"]["completion_tokens"]
        analysis_model = ResponseParser.extract_json(analysis_text, ArchitectAnalysisResponse)
        analysis = analysis_model.model_dump()
        analysis_ok = True
        analysis_error = None
    except Exception as e:
        analysis_ok = False
        analysis_error = str(e)[:200]
        analysis_text = ""
        analysis_tokens = 0
        analysis = None

    result["analysis_ok"] = analysis_ok
    result["analysis_error"] = analysis_error
    result["analysis_text"] = analysis_text
    result["analysis_tokens"] = analysis_tokens

    if not analysis:
        result["time_ms"] = int((time.time() - t0) * 1000)
        return result

    await agent.clear_context()

    # --- Step 3: Architect Synthesis ---
    arch_prompt = (
        f"Analysis: {json.dumps(analysis)}\n"
        f"Intent: {json.dumps(intent_packet)}\n"
        f"Instruction: {instruction}\n"
        f"Code: <code>{code}</code>"
    )
    system_content = prompts["planner"]["architect"]
    guidance = prompts["planner"]["synthesis_guidance"].get(intent_key, "")
    if guidance:
        system_content += "\n" + guidance

    messages = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": arch_prompt},
    ]

    raw_synthesis = None
    try:
        raw = await agent.generate(
            messages, temp=0.2, max_tokens=2048, response_model=ASTArchitectResponse
        )
        arch_text = raw["choices"][0]["message"].get("content") or ""
        arch_tokens = raw["usage"]["completion_tokens"]
        raw_synthesis = arch_text
        result["arch_raw_length"] = len(arch_text)

        parse_t0 = time.time()
        plan = None
        try:
            arch_res = ResponseParser.extract_json(arch_text, ASTArchitectResponse)
            plan = arch_res.ast_modification_plan.model_dump()
            mutations = plan.get("ast_mutations", [])
            parse_ok = True
            parse_error = None
            parse_time_ms = int((time.time() - parse_t0) * 1000)
        except Exception as e:
            parse_ok = False
            parse_error = str(e)[:300]
            mutations = []
            parse_time_ms = int((time.time() - parse_t0) * 1000)

        result["parse_ok"] = parse_ok
        result["parse_error"] = parse_error
        result["parse_time_ms"] = parse_time_ms
        result["raw_mutation_count"] = len(mutations)
        result["arch_tokens"] = arch_tokens
        result["truncated"] = "EOF while parsing" in (parse_error or "")

        if mutations:
            seen = set()
            repeats = 0
            for m in mutations:
                key = (m.get("action"), m.get("target"))
                if key in seen:
                    repeats += 1
                else:
                    seen.add(key)
            result["repeated_mutations"] = repeats
            result["unique_mutations"] = len(seen)
            result["mutations_capped"] = len(mutations) > 8
        else:
            result["repeated_mutations"] = 0
            result["unique_mutations"] = 0
            result["mutations_capped"] = False

        actions = {}
        for m in mutations:
            action = m.get("action", "?")
            actions[action] = actions.get(action, 0) + 1
        result["action_breakdown"] = actions

        result["intent_packet"] = intent_packet
        result["plan"] = plan

    except Exception as e:
        result["parse_ok"] = False
        result["parse_error"] = str(e)[:300]
        result["arch_tokens"] = 0
        result["raw_mutation_count"] = 0
        result["truncated"] = "truncat" in str(e).lower() or "EOF" in str(e)
        result["repeated_mutations"] = 0
        result["unique_mutations"] = 0
        result["mutations_capped"] = False
        result["action_breakdown"] = {}
        result["plan"] = None

    if raw_synthesis:
        result["arch_preview"] = raw_synthesis[:500]

    result["time_ms"] = int((time.time() - t0) * 1000)
    return result


async def main() -> None:
    os.makedirs("test_results", exist_ok=True)

    model_config, prompts = load_configs()
    agent = AgentService()

    print(f"\n{'='*60}")
    print("Planner-Only Output Test — New Cases")
    print(f"Model: {model_config['planner']['filename']}")
    print(f"{'='*60}")

    await agent.load(model_config["planner"])

    all_results = []
    for i, case in enumerate(TEST_CASES):
        print(f"\n--- [{i+1}/{len(TEST_CASES)}] {case['name']} ---")
        result = await test_planner_case(agent, prompts, case)
        all_results.append(result)

        status = "PASS" if result.get("parse_ok") else "FAIL"
        prefix = " TRUNCATED!" if result.get("truncated") else ""
        print(f"  Classifier:  {'OK' if result.get('classifier_ok') else 'FAIL'}")
        print(f"  Analysis:    {'OK' if result.get('analysis_ok') else 'FAIL'}")
        print(f"  Synthesis:   {status}{prefix}")
        print(f"  Mutations:   {result.get('raw_mutation_count', '?')} raw, "
              f"{result.get('unique_mutations', '?')} unique, "
              f"{result.get('repeated_mutations', '?')} repeats")
        print(f"  Tokens:      arch={result.get('arch_tokens', '?')}, "
              f"total_time={result.get('time_ms', '?')}ms")
        if result.get("parse_error"):
            print(f"  Error:       {result['parse_error']}")
        if result.get("action_breakdown"):
            print(f"  Actions:     {result['action_breakdown']}")
        print()

    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model": model_config["planner"]["filename"],
        "total_cases": len(all_results),
        "results": all_results,
    }
    output_path = "test_results/planner_new_outputs.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print("SUMMARY — Planner New Cases")
    print(f"{'='*60}")
    for r in all_results:
        print(f"  {r['case']:30s} | "
              f"Class={'OK' if r.get('classifier_ok') else 'FAIL':4s} | "
              f"Synth={'OK' if r.get('parse_ok') else 'FAIL':4s} | "
              f"Mut={r.get('raw_mutation_count', 0):2d} raw, "
              f"{r.get('unique_mutations', 0):2d} uniq | "
              f"Time={r.get('time_ms', 0):5d}ms")
    print(f"\nResults saved to {output_path}")

    await agent.unload()


if __name__ == "__main__":
    asyncio.run(main())
