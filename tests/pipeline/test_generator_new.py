"""Generator + Validator test — reads planner outputs, runs generator sequentially."""
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
from app.modules.validator import Validator
from app.utils.ast_matcher import ASTMatcher
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.response_parser import ResponseParser


def load_configs():
    with open(MODELS_CONFIG_PATH) as f:
        model_config = yaml.safe_load(f)
    with open(PROMPTS_CONFIG_PATH) as f:
        prompts = yaml.safe_load(f)
    return model_config, prompts


def _order_mutations(mutations: List[Dict]) -> List[Dict]:
    def sort_key(m):
        action = m.get("action", "")
        if action.startswith("ADD_"):
            return 0
        if action.startswith("MODIFY_"):
            return 1
        return 2
    return sorted(mutations, key=sort_key)


async def run_generator_case(
    agent: AgentService,
    validator: Validator,
    prompts: Dict,
    model_cfg: Dict,
    planner_result: Dict[str, Any],
) -> Dict[str, Any]:
    case_name = planner_result["case"]
    code = planner_result["code"]
    instruction = planner_result["instruction"]
    plan = planner_result.get("plan")

    result = {
        "case": case_name,
        "expected_intent": planner_result.get("expected_intent", ""),
        "instruction": instruction,
        "original_code": code,
        "planner_parse_ok": planner_result.get("parse_ok", False),
    }

    if not plan:
        result["error"] = "No plan from planner"
        return result

    mutations = plan.get("ast_mutations", [])
    if not mutations:
        result["error"] = "Empty mutation list"
        return result

    intent_str = planner_result.get("intent_packet", {}).get("specific_intent", "")
    enriched_mutations = ASTMatcher.enrich_mutations(code, mutations, intent_str)
    ordered_mutations = _order_mutations(enriched_mutations)

    result["mutations"] = ordered_mutations
    result["mutation_count"] = len(ordered_mutations)

    # Generator: Sequential Mutation Application
    await agent.swap(model_cfg["generator"])
    await agent.clear_context()

    system_content = prompts["generator"]["coder"]
    intent_guidance = prompts["generator"]["coder_guidance"].get(intent_str, "")
    if intent_guidance:
        system_content += "\n" + intent_guidance

    working_code = code
    gen_timings: List[Dict] = []
    step_attempts = 0
    global_fail = False
    mut_idx = 0

    while mut_idx < len(ordered_mutations):
        if global_fail:
            break

        mutation = ordered_mutations[mut_idx]
        action = mutation.get("action", "")
        target = mutation.get("target", "")
        details = mutation.get("details", {})

        mutation_text = f"{action} {target}\n" f"Details: {json.dumps(details, indent=2)}"

        context = ""
        if action.startswith("MODIFY_") and mut_idx > 0:
            added_items = [m for m in ordered_mutations[:mut_idx] if m.get("action", "").startswith("ADD_")]
            if added_items:
                context = "\nPreviously added items (must be referenced in updated method):\n"
                for item in added_items:
                    d = item.get("details", {})
                    extra = f" ({d.get('type', '')})" if d.get("type") else ""
                    if d.get("value"):
                        extra += f" = {d['value']}"
                    context += f"  - {item['action']} {item['target']}{extra}\n"

        user_prompt = (
            f"Current Code:\n<code>{working_code}</code>\n\n"
            f"Apply ONLY this mutation ({mut_idx + 1}/{len(ordered_mutations)}):\n"
            f"{mutation_text}\n{context}\n"
            f"Output ONLY the complete updated code in <code> tags. Do NOT change anything except this mutation."
        )

        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_prompt},
        ]

        t0 = time.time()
        raw = await agent.generate(messages, temp=0.1, max_tokens=3072)
        gen_time_ms = int((time.time() - t0) * 1000)

        coder_text = raw["choices"][0]["message"].get("content") or ""
        new_code = ResponseParser.extract_xml(coder_text, "code")

        timing_entry = {"step": mut_idx + 1, "action": action, "target": target, "time_ms": gen_time_ms}

        if not new_code:
            step_attempts += 1
            timing_entry["status"] = "NO_CODE_BLOCK"
            timing_entry["error"] = "No <code> block"
            gen_timings.append(timing_entry)
            if step_attempts <= 3:
                print(f"  Step {mut_idx+1}: NO_CODE_BLOCK \u2014 retry {step_attempts}/3")
                continue
            global_fail = True
            print(f"  Step {mut_idx+1}: NO_CODE_BLOCK \u2014 exhausted")
            break

        syntax_res = validator.check_syntax(new_code)
        if not syntax_res["is_valid"]:
            step_attempts += 1
            timing_entry["status"] = "SYNTAX_FAIL"
            errors = syntax_res.get("errors", ["Unknown"])
            timing_entry["error"] = str(errors[0]) if errors else "Unknown"
            gen_timings.append(timing_entry)
            if step_attempts <= 3:
                print(f"  Step {mut_idx+1}: SYNTAX_FAIL \u2014 retry {step_attempts}/3")
                continue
            global_fail = True
            print(f"  Step {mut_idx+1}: SYNTAX_FAIL \u2014 exhausted")
            break

        target_scopes = [target]
        intent_packet = planner_result.get("intent_packet", {})
        member = intent_packet.get("scope_anchor", {}).get("member", "")
        if member and member not in target_scopes:
            target_scopes.append(member)

        boundary_finding = validator.verify_boundary(working_code, new_code, target_scopes)
        if boundary_finding:
            step_attempts += 1
            timing_entry["status"] = "BOUNDARY_FAIL"
            timing_entry["error"] = boundary_finding.error_report.message
            gen_timings.append(timing_entry)
            if step_attempts <= 3:
                print(f"  Step {mut_idx+1}: BOUNDARY_FAIL \u2014 retry {step_attempts}/3")
                continue
            global_fail = True
            print(f"  Step {mut_idx+1}: BOUNDARY_FAIL \u2014 exhausted")
            break

        working_code = new_code
        step_attempts = 0
        timing_entry["status"] = "OK"
        gen_timings.append(timing_entry)
        mut_idx += 1
        print(f"  Step {mut_idx}/{len(ordered_mutations)}: {action} {target} \u2014 OK ({gen_time_ms}ms)")

    result["gen_timings"] = gen_timings
    result["gen_ok_steps"] = sum(1 for t in gen_timings if t.get("status") == "OK")
    result["gen_fail_steps"] = sum(1 for t in gen_timings if t.get("status") != "OK")
    result["gen_total_time_ms"] = sum(t.get("time_ms", 0) for t in gen_timings)
    result["generated_code"] = working_code
    result["code_changed"] = working_code.strip() != code.strip()

    # Validator: Basic checks
    findings = []
    final_syntax = validator.check_syntax(working_code)
    result["final_syntax_ok"] = final_syntax["is_valid"]
    if not final_syntax["is_valid"]:
        result["final_syntax_error"] = str(final_syntax.get("errors", ["Unknown"])[0])
        findings.append(f"syntax_fail: {result['final_syntax_error']}")

    original_cc = validator.get_complexity(code)
    refactored_cc = validator.get_complexity(working_code)
    result["original_cc"] = original_cc
    result["refactored_cc"] = refactored_cc
    result["cc_delta"] = refactored_cc - original_cc

    result["validation_findings"] = findings
    result["num_validation_findings"] = len(findings)

    return result


async def main() -> None:
    os.makedirs("test_results", exist_ok=True)

    model_config, prompts = load_configs()

    planner_path = "test_results/planner_new_outputs.json"
    if not os.path.exists(planner_path):
        print(f"ERROR: {planner_path} not found. Run test_planner_new.py first.")
        sys.exit(1)

    with open(planner_path) as f:
        planner_data = json.load(f)

    print(f"\n{'='*60}")
    print("Generator + Validator Test \u2014 New Cases")
    print(f"Model: {model_config['generator']['filename']}")
    print(f"Cases: {planner_data.get('total_cases', 0)}")
    print(f"{'='*60}")

    agent = AgentService()
    validator = Validator()

    await agent.load(model_config["generator"])

    all_results = []
    for i, pr in enumerate(planner_data.get("results", [])):
        print(f"\n--- [{i+1}/{len(planner_data['results'])}] {pr['case']} ---")
        result = await run_generator_case(agent, validator, prompts, model_config, pr)
        all_results.append(result)

        gen_ok = result.get("gen_ok_steps", 0)
        gen_fail = result.get("gen_fail_steps", 0)
        total_steps = gen_ok + gen_fail
        print(f"  Generator: {gen_ok}/{total_steps} OK steps")
        print(f"  Final CC:  {result.get('original_cc', '?')} \u2192 {result.get('refactored_cc', '?')} (\u0394={result.get('cc_delta', '?')})")
        print(f"  Syntax:    {'OK' if result.get('final_syntax_ok') else 'FAIL'}")
        print(f"  Changed:   {result.get('code_changed', False)}")
        print()

    output = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "model": model_config["generator"]["filename"],
        "total_cases": len(all_results),
        "results": all_results,
    }
    output_path = "test_results/generator_new_outputs.json"
    with open(output_path, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print("SUMMARY \u2014 Generator + Validator New Cases")
    print(f"{'='*60}")
    cc_header = "CC \u0394"
    print(f"{'Case':30s} {'Gen OK':>7s} {'Syntax':>7s} {cc_header:>5s} {'Changed':>8s} {'Time':>8s}")
    print("-" * 70)
    for r in all_results:
        gen_ok = f"{r.get('gen_ok_steps', 0)}/{r.get('gen_ok_steps', 0) + r.get('gen_fail_steps', 0)}"
        syntax = "OK" if r.get('final_syntax_ok') else "FAIL"
        cc_delta = r.get('cc_delta', 0)
        changed = "YES" if r.get('code_changed') else "NO"
        gen_time = r.get('gen_total_time_ms', 0)
        print(f"{r['case']:30s} {gen_ok:>7s} {syntax:>7s} {cc_delta:>+5d} {changed:>8s} {gen_time:>8d}ms")
    print(f"\nResults saved to {output_path}")

    await agent.unload()


if __name__ == "__main__":
    asyncio.run(main())
