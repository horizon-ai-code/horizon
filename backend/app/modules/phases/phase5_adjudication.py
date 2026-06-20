import json
from typing import Any, Awaitable, Callable

from llama_cpp import ChatCompletionRequestMessage
from pydantic import ValidationError

from app.utils.code_utils import strip_outer_wrapper
from app.utils.response_parser import ResponseParser
from app.utils.schemas import StructuralAuditorResponse
from app.utils.types import ExitStatus, FailureTier, Role

Notifier = Callable[[Any, Role, str, str | None], Awaitable[None]]


class Phase5Adjudication:
    def __init__(self, agent_service, validator, config, prompts: dict[str, Any], notify: Notifier):
        self._agent = agent_service
        self._validator = validator
        self._config = config
        self._prompts = prompts
        self._notify = notify

    async def run(self, client, state) -> None:
        await self._notify(client, Role.Judge, "Adjudication: Running final audit...", None)
        await self._agent.swap(self._config.judge)

        def _normalize(code: str) -> str:
            no_imports = "\n".join(line for line in code.splitlines() if not line.strip().startswith("import "))
            return strip_outer_wrapper(no_imports, state.base_code)

        judge_base = _normalize(state.base_code)
        judge_refac = _normalize(state.working_code)

        intent = ""
        target_class = ""
        target_method = ""
        if state.intent_packet:
            intent = state.intent_packet.get("specific_intent", "")
            scope = state.intent_packet.get("scope_anchor", {})
            target_class = scope.get("target_class", "")
            target_method = scope.get("member", "")

        mutations = state.active_plan.get("ast_mutations", []) if state.active_plan else []
        mutation_actions = [m.get("action", "?") for m in mutations]
        mutation_targets = [m.get("target", "?") for m in mutations]

        plan_summary = f"Intent: {intent}. Target: {target_class}.{target_method}."
        mutations_list = (
            f"Mutations: {', '.join(f'{a}({t})' for a, t in zip(mutation_actions, mutation_targets, strict=False))}"
            if mutation_actions else "Mutations: none"
        )

        audit_prompt = (
            f"## Plan Context\n{plan_summary}\n{mutations_list}\n\n"
            f"## Code\n"
            f"Original: <code>{judge_base}</code>\n"
            f"Refactored: <code>{judge_refac}</code>\n"
            f"Intent: {json.dumps(state.intent_packet)}"
        )
        system_content = self._prompts["judge"]["auditor"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self._prompts["judge"].get("auditor_guidance", {}).get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: list[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": audit_prompt},
        ]

        for _jattempt in range(2):
            jtemp = 0.1 if _jattempt == 0 else 0.3
            jmax = 1500 if _jattempt == 0 else 2048
            try:
                raw = await self._agent.generate(
                    messages, temp=jtemp, max_tokens=jmax,
                    response_model=StructuralAuditorResponse,
                )
                audit_text = raw["choices"][0]["message"].get("content") or ""
                jheader = "--- Judge Auditor Output ---"
                if _jattempt > 0:
                    jheader = f"--- Judge Auditor Output (Retry {_jattempt}) ---"
                print(f"\n{jheader}\n{audit_text}\n--------------------------")
                audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)
                break
            except (ValidationError, ValueError):
                if _jattempt == 0:
                    print("  Judge attempt 1 failed (truncated). Retrying with temp=0.3, max_tokens=2048...")
                    await self._agent.clear_context()
                else:
                    print("  Judge failed on both attempts. Falling back to strategy retry.")
                    state.add_feedback({
                        "failure_tier": FailureTier.TIER_3_JUDGE,
                        "error": "Judge auditor failed to produce valid verdict on both attempts.",
                    })
                    if not state.strategy_iter_incremented:
                        state.strategy_iter += 1
                        state.strategy_iter_incremented = True
                    state.current_phase = 2
                    return

        if audit_res.verdict == "REVISE" and audit_res.issues:
            issue = audit_res.issues[0]
            if issue.issue_type == "IDENTICAL_CODE":
                if self._validator.has_structural_change(state.base_code, state.working_code):
                    print("WARNING: Judge hallucinated IDENTICAL_CODE — overriding to ACCEPT")
                    audit_res.verdict = "ACCEPT"
                    audit_res.issues = []
            elif issue.issue_type == "LOGIC_DRIFT":
                if not self._validator.has_structural_change(state.base_code, state.working_code):
                    print("WARNING: Judge hallucinated LOGIC_DRIFT — overriding to ACCEPT")
                    audit_res.verdict = "ACCEPT"
                    audit_res.issues = []

        await self._notify(
            client, Role.Judge,
            f"Audit Finished: {audit_res.verdict}",
            json.dumps(audit_res.model_dump()),
        )

        if audit_res.verdict == "ACCEPT":
            state.exit_status = ExitStatus.SUCCESS
            state.current_phase = 6
        else:
            await self._notify(client, Role.Judge, "Audit requested revision.", None)
            state.add_feedback({
                "failure_tier": FailureTier.TIER_3_JUDGE,
                "error": [i.model_dump() for i in audit_res.issues],
            })
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.current_phase = 2
