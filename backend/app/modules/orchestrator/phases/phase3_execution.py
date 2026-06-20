import json
import time as _time
from typing import Any, Awaitable, Callable

import javalang
from llama_cpp import ChatCompletionRequestMessage

from app.utils.code_utils import order_mutations
from app.utils.formatters import format_plan_for_generator
from app.utils.response_parser import ResponseParser
from app.utils.types import FailureTier, Role

Notifier = Callable[[Any, Role, str, str | None], Awaitable[None]]


def repair_generator_output(original: str, generated: str) -> str:
    """Strip common defensive additions from Generator output."""
    import re as _re

    result = generated

    # 1. Strip throws declarations added to method signatures
    orig_throws = set(_re.findall(r"throws\s+(\w+Exception)", original))
    gen_throws = set(_re.findall(r"throws\s+(\w+Exception)", result))
    for exc in gen_throws - orig_throws:
        result = _re.sub(r"\s*throws\s+" + _re.escape(exc) + r"(?=\s*\{)", "", result)

    # 2. Remove null checks not in original — robust to no-brace bodies
    orig_null_count = len(_re.findall(r"if\s*\(\s*\w+\s*==\s*null\s*\)", original))
    gen_null_checks = list(_re.finditer(r"if\s*\(\s*\w+\s*==\s*null\s*\)", result))
    extra_nulls = len(gen_null_checks) - orig_null_count
    if extra_nulls > 0:
        for match in reversed(gen_null_checks[-extra_nulls:]):
            start = match.start()
            end = start
            after = result[match.end():]
            after_stripped = after.lstrip()
            if after_stripped.startswith("{"):
                brace_pos = match.end() + (len(after) - len(after_stripped))
                depth = 0
                for i in range(brace_pos, len(result)):
                    if result[i] == "{":
                        depth += 1
                    elif result[i] == "}":
                        depth -= 1
                        if depth == 0:
                            end = i + 1
                            break
            else:
                semicolon = after.find(";")
                if semicolon >= 0:
                    end = match.end() + semicolon + 1
            if end > start:
                result = result[:start] + result[end:]

    # 3. Strip 'public' modifier from bare methods that weren't public
    org_pub_methods = set(_re.findall(r"public\s+\w+\s+(\w+)\s*\(", original))
    gen_pub_methods = set(_re.findall(r"public\s+\w+\s+(\w+)\s*\(", result))
    for method in gen_pub_methods - org_pub_methods:
        result = _re.sub(r"\bpublic\s+(\w+\s+" + _re.escape(method) + r"\s*\()", r"\1", result)

    return result


class Phase3Execution:
    def __init__(self, agent_service, validator, config, prompts: dict[str, Any], notify: Notifier):
        self._agent = agent_service
        self._validator = validator
        self._config = config
        self._prompts = prompts
        self._notify = notify

    async def run_single(self, client, state) -> None:
        """Phase 3: Plan Execution (single-shot generation with multi-sample)."""
        await self._notify(client, Role.Generator, "Execution: Implementing plan...", None)
        await self._agent.swap(self._config.generator)
        await self._agent.clear_context()

        if state.syntax_error_context:
            ctx = state.syntax_error_context
            coder_prompt = (
                f"Modification Plan: {json.dumps(state.active_plan)}\n\n"
                f"### PREVIOUS SYNTAX ERROR (Attempt {ctx['attempt']}/3)\n"
                f"{ctx['error']}\n\n"
                f"### CURRENT BROKEN CODE\n"
                f"<code>{ctx['broken_code']}</code>\n\n"
                f"Fix the syntax error above. Output only valid Java wrapped in <code> tags."
            )
        else:
            coder_prompt = format_plan_for_generator(state.active_plan or {}, state.base_code)

        system_content = self._prompts["generator"]["coder"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self._prompts["generator"]["coder_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: list[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": coder_prompt},
        ]

        heal_temp = 0.3 if state.syntax_error_context else 0.1
        retry_temp = 0.3 if state.strategy_iter > 1 else heal_temp
        gen_max_tokens = 3072

        samples: list[dict[str, Any]] = []
        gen_t0 = _time.time()
        for sample_temp in (retry_temp, 0.3, 0.5) if not state.syntax_error_context else (retry_temp,):
            raw = await self._agent.generate(messages, temp=sample_temp, max_tokens=gen_max_tokens)
            coder_text = raw["choices"][0]["message"].get("content") or ""
            sample_code = ResponseParser.extract_xml(coder_text, "code")
            if sample_code:
                sample_code = repair_generator_output(state.base_code, sample_code)
                syntax_ok = False
                try:
                    wrapped = f"class _W_ {{ {sample_code} }}" if "class" not in sample_code else sample_code
                    javalang.parse.parse(wrapped)
                    syntax_ok = True
                except (javalang.parser.JavaSyntaxError, javalang.tokenizer.LexerError):
                    pass
                cc = self._validator.get_complexity(sample_code) if syntax_ok else 999
                samples.append({"code": sample_code, "syntax_ok": syntax_ok, "cc": cc, "temp": sample_temp})

        if samples:
            def sample_score(s):
                if not s["syntax_ok"]:
                    return (-1000, 0)
                cc_delta = s["cc"] - state.original_complexity
                return (0, -cc_delta)

            best = max(samples, key=sample_score)
            print(
                f"\n--- Generator Multi-Sample ---\n"
                f"Tried {len(samples)} temps. Best: temp={best['temp']} CC={best['cc']} syntax={'OK' if best['syntax_ok'] else 'FAIL'}\n"
                f"----------------------------"
            )

            if best["syntax_ok"]:
                state.working_code = best["code"]
                state.syntax_iter = 0
                state.syntax_error_context = None
                gen_time_ms = int((_time.time() - gen_t0) * 1000)
                await self._notify(client, Role.Generator,
                                   f"Code refactored — 1 pass. {gen_time_ms}ms\n\n{best['code']}")
                state.current_phase = 4
                return
            else:
                state.syntax_iter += 1
                if state.syntax_iter <= 3:
                    state.syntax_error_context = {
                        "attempt": state.syntax_iter,
                        "error": "Multi-sample: all outputs had syntax errors.",
                        "broken_code": state.working_code or state.base_code,
                    }
                    state.current_phase = 3
                    return
                state.add_feedback({
                    "failure_tier": FailureTier.TIER_1_SYNTAX,
                    "error": "Multi-sample: no valid code after multiple attempts.",
                })
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.syntax_iter = 0
                state.current_phase = 2
                return

        # Fallback: no code blocks at all
        state.syntax_iter += 1
        if state.syntax_iter <= 3:
            state.syntax_error_context = {
                "attempt": state.syntax_iter,
                "error": "No <code> block found in generator output.",
                "broken_code": state.working_code,
            }
            state.current_phase = 3
            return
        state.add_feedback({
            "failure_tier": FailureTier.TIER_1_SYNTAX,
            "error": "No <code> block found after 3 attempts.",
        })
        if not state.strategy_iter_incremented:
            state.strategy_iter += 1
            state.strategy_iter_incremented = True
        state.syntax_iter = 0
        state.current_phase = 2

    async def run_sequential(self, client, state) -> None:
        """Apply mutations one at a time in sequence."""
        if state.active_plan is None:
            print("No active plan for sequential execution. Falling through to single-shot.")
            state.current_phase = 4
            return

        mutations = order_mutations(state.active_plan.get("ast_mutations", []))
        state.mutation_queue = mutations
        state.mutation_index = 0
        state.sequential_attempts = 0
        state.gen_timings = []

        await self._notify(client, Role.Generator, "Execution: Implementing plan...", None)
        await self._agent.swap(self._config.generator)
        await self._agent.clear_context()

        system_content = self._prompts["generator"]["coder"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self._prompts["generator"]["coder_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        while state.mutation_index < len(state.mutation_queue):
            mutation = state.mutation_queue[state.mutation_index]
            action = mutation.get("action", "")
            target = mutation.get("target", "")
            details = mutation.get("details", {})

            current_code = state.working_code
            mutation_text = f"{action} {target}\nDetails: {json.dumps(details, indent=2)}"

            context = ""
            if action.startswith("MODIFY_") and state.mutation_index > 0:
                added_items = [
                    m for m in state.mutation_queue[:state.mutation_index] if m.get("action", "").startswith("ADD_")
                ]
                if added_items:
                    context = "\nPreviously added items (must be referenced in updated method):\n"
                    for item in added_items:
                        d = item.get("details", {})
                        extra = f" ({d.get('type', '')})" if d.get("type") else ""
                        if d.get("value"):
                            extra += f" = {d['value']}"
                        context += f"  - {item['action']} {item['target']}{extra}\n"

            user_prompt = (
                f"Current Code:\n<code>{current_code}</code>\n\n"
                f"Apply ONLY this mutation ({state.mutation_index + 1}/{len(state.mutation_queue)}):\n"
                f"{mutation_text}\n{context}"
                f"\nOutput ONLY the complete updated code in <code> tags. "
                f"Do NOT change anything except this mutation."
            )

            if state.syntax_error_context:
                ctx = state.syntax_error_context
                user_prompt += (
                    f"\n\n### PREVIOUS ATTEMPT FAILED (Attempt {ctx['attempt']}/3)\n"
                    f"Error: {ctx['error']}\n"
                    f"Broken code:\n<code>{ctx['broken_code'][:2000]}</code>\n\n"
                    f"Fix the error above in this attempt."
                )

            messages: list[ChatCompletionRequestMessage] = [
                {"role": "system", "content": system_content},
                {"role": "user", "content": user_prompt},
            ]

            t0 = _time.time()
            raw = await self._agent.generate(messages, temp=0.1, max_tokens=3072)
            gen_time_ms = int((_time.time() - t0) * 1000)

            coder_text = raw["choices"][0]["message"].get("content") or ""
            new_code = ResponseParser.extract_xml(coder_text, "code")

            timing_entry = {
                "step": state.mutation_index + 1,
                "action": action,
                "target": target,
                "time_ms": gen_time_ms,
            }

            if not new_code:
                state.sequential_attempts += 1
                timing_entry["status"] = "NO_CODE_BLOCK"
                state.gen_timings.append(timing_entry)
                if state.sequential_attempts <= 3:
                    await self._notify(client, Role.Generator,
                                       f"No <code> block for {action} {target}. Retrying (attempt {state.sequential_attempts}/3)...")
                    continue
                state.working_code = state.base_code
                timing_entry["status"] = "EXHAUSTED"
                state.gen_timings.append(timing_entry)
                return

            syntax_res = self._validator.check_syntax(new_code)
            if not syntax_res["is_valid"]:
                state.sequential_attempts += 1
                timing_entry["status"] = "SYNTAX_FAIL"
                errors = syntax_res.get("errors", ["Unknown"])
                timing_entry["error"] = str(errors[0]) if errors else "Unknown"
                state.gen_timings.append(timing_entry)
                if state.sequential_attempts <= 3:
                    state.syntax_error_context = {
                        "attempt": state.sequential_attempts,
                        "error": str(errors[0]) if errors else "Unknown",
                        "broken_code": new_code,
                    }
                    await self._notify(client, Role.Generator,
                                       f"Syntax fail on {action} {target}. Healing (attempt {state.sequential_attempts}/3)...")
                    continue
                state.working_code = state.base_code
                return

            target_scopes = [target]
            if state.intent_packet:
                member = state.intent_packet["scope_anchor"].get("member", "")
                if member and member not in target_scopes:
                    target_scopes.append(member)

            boundary_finding = self._validator.verify_boundary(current_code, new_code, target_scopes)
            if boundary_finding:
                state.sequential_attempts += 1
                timing_entry["status"] = "BOUNDARY_FAIL"
                timing_entry["error"] = boundary_finding.error_report.message
                state.gen_timings.append(timing_entry)
                if state.sequential_attempts <= 3:
                    continue
                state.working_code = state.base_code
                return

            state.working_code = new_code
            state.sequential_attempts = 0
            state.syntax_error_context = None
            timing_entry["status"] = "OK"
            state.gen_timings.append(timing_entry)
            state.mutation_index += 1

            print(f"\n--- Sequential Step {state.mutation_index}/{len(state.mutation_queue)} ---")
            print(f"Action: {action} {target} | Time: {gen_time_ms}ms | Status: OK")

        state.syntax_iter = 0
        state.syntax_error_context = None
        total_time = sum(e["time_ms"] for e in state.gen_timings)
        applied = state.mutation_index
        total = len(state.mutation_queue)
        await self._notify(client, Role.Generator,
                           f"Code refactored — {applied}/{total} mutations. {total_time}ms\n\n{state.working_code}")
