"""Judge auditor test — reads generator outputs, runs judge audit."""
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
from app.utils.schemas import StructuralAuditorResponse


def load_configs():
    with open(MODELS_CONFIG_PATH) as f:
        model_config = yaml.safe_load(f)
    with open(PROMPTS_CONFIG_PATH) as f:
        prompts = yaml.safe_load(f)
    return model_config, prompts


async def run_judge_case(
    agent: AgentService,
    prompts: Dict,
    gen_result: Dict[str, Any],
) -> Dict[str, Any]:
    case_name = gen_result["case"]
    original_code = gen_result.get("code", gen_result.get("original_code", ""))
    generated_code = gen_result.get("generated_code", "")
    instruction = gen_result.get("instruction", "")

    result = {
        "case": case_name,
        "expected_intent": gen_result.get("expected_intent", ""),
        "instruction": instruction,
    }

    if not generated_code or not gen_result.get("final_syntax_ok", False):
        result["verdict"] = "SKIP"
        result["issues"] = ["No valid generated code to audit"]
        return result

    if generated_code.strip() == original_code.strip():
        result["verdict"] = "REVISE"
        result["issues"] = ["Code is identical to original — plan was not executed"]
        result["duration_ms"] = 0
        return result

    # Build plan context summary
    intent = gen_result.get("expected_intent", "")
    mutations = gen_result.get("mutations", [])
    mutation_actions = [m.get("action", "?") for m in mutations]
    mutation_targets = [m.get("target", "?") for m in mutations]

    plan_summary = f"Intent: {intent}."
    mutations_list = (
        f"Mutations: {', '.join(f'{a}({t})' for a, t in zip(mutation_actions, mutation_targets))}"
        if mutation_actions
        else "Mutations: none"
    )

    audit_prompt = (
        f"## Plan Context\n{plan_summary}\n{mutations_list}\n\n"
        f"## Code\n"
        f"Original: <code>{original_code}</code>\n"
        f"Refactored: <code>{generated_code}</code>\n"
        f"Instruction: {instruction}"
    )

    system_content = prompts["judge"]["auditor"]
    if intent:
        guidance = prompts["judge"].get("auditor_guidance", {}).get(intent, "")
        if guidance:
            system_content += "\n" + guidance

    messages: List[ChatCompletionRequestMessage] = [
        {"role": "system", "content": system_content},
        {"role": "user", "content": audit_prompt},
    ]

    t0 = time.time()
    try:
        raw = await agent.generate(
            messages,
            temp=0.1,
            max_tokens=1500,
            response_model=StructuralAuditorResponse,
        )
        audit_text = raw["choices"][0]["message"].get("content") or ""
        duration_ms = int((time.time() - t0) * 1000)

        audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)
        result["verdict"] = audit_res.verdict
        result["issues"] = audit_res.issues
        result["audit_scratchpad"] = audit_res.audit_scratchpad.model_dump()
        result["parse_ok"] = True
        result["parse_error"] = None
    except Exception as e:
        duration_ms = int((time.time() - t0) * 1000)
        result["verdict"] = "PARSE_ERROR"
        result["issues"] = [str(e)[:200]]
        result["parse_ok"] = False
        result["parse_error"] = str(e)[:300]

    result["duration_ms"] = duration_ms
    return result


async def main() -> None:
    os.makedirs("test_results", exist_ok=True)

    model_config, prompts = load_configs()

    # Load generator outputs
    gen_path = "test_results/generator_new_outputs.json"
    if not os.path.exists(gen_path):
        print(f"ERROR: {gen_path} not found. Run test_generator_new.py first.")
        sys.exit(1)

    with open(gen_path) as f:
        gen_data = json.load(f)

    print(f"\n{'='*60}")
    print("Judge Auditor Test — New Cases")
    print(f"Model: {model_config['judge']['filename']}")
    print(f"Cases: {gen_data.get('total_cases', 0)}")
    print(f"{'='*60}")

    agent = AgentService()
    await agent.load(model_config["judge"])

    all_results = []
    for i, gr in enumerate(gen_data.get("results", [])):
        print(f"\n--- [{i+1}/{len(gen_data['results'])}] {gr['case']} ---")
        result = await run_judge_case(agent, prompts, gr)
        all_results.append(result)

        verdict = result.get("verdict", "?")
        issues = result.get("issues", [])
        print(f"  Verdict:   {verdict}")
        print(f"  Issues:    {len(issues)}")
        if issues:
            for iss in issues[:3]:
                print(f"    - {iss}")
        print(f"  Duration:  {result.get('duration_ms', 0)}ms")
        print()

    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model": model_config["judge"]["filename"],
        "total_cases": len(all_results),
        "results": all_results,
    }
    output_path = "test_results/judge_new_outputs.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print("SUMMARY — Judge Auditor New Cases")
    print(f"{'='*60}")
    print(f"{'Case':30s} {'Verdict':12s} {'Issues':>7s} {'Parse':>6s} {'Time':>8s}")
    print("-" * 70)
    for r in all_results:
        verdict = r.get("verdict", "?")
        issues = len(r.get("issues", []))
        parse_ok = "OK" if r.get("parse_ok", False) else "FAIL"
        dur = r.get("duration_ms", 0)
        print(f"{r['case']:30s} {verdict:12s} {issues:>7d} {parse_ok:>6s} {dur:>8d}ms")
    print(f"\nResults saved to {output_path}")

    await agent.unload()


if __name__ == "__main__":
    asyncio.run(main())
