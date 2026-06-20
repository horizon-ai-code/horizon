import json
from typing import Any, Callable

from llama_cpp import ChatCompletionRequestMessage
from pydantic import ValidationError

from app.modules.orchestration_config import OrchestrationConfig
from app.utils.ast_matcher import ASTMatcher
from app.utils.response_parser import ResponseParser
from app.utils.schemas import (
    ArchitectAnalysisResponse,
    ASTArchitectResponse,
    IntentClassifierResponse,
)
from app.utils.types import FailureTier, Role

Notifier = Callable[[Any, Role, str, str | None], None]


class Phase2Strategy:
    def __init__(self, agent_service, config: OrchestrationConfig, prompts: dict[str, Any], notify: Notifier):
        self._agent = agent_service
        self._config = config
        self._prompts = prompts
        self._notify = notify

    async def run(self, client, state) -> None:
        state.strategy_iter_incremented = False

        if not state.intent_packet:
            await self._classify(client, state)

        await self._agent.clear_context()
        await self._analyze(client, state)
        await self._agent.clear_context()
        await self._synthesize(client, state)

        if state.active_plan is None:
            return

        self._enrich(state)
        self._deduplicate(state)

        self._notify(
            client, Role.Planner, "Modification plan generated.", json.dumps(state.active_plan),
        )
        state.current_phase = 3

    async def _classify(self, client, state) -> None:
        self._notify(
            client, Role.Planner,
            f"Strategy: Classifying intent (Strategy Iter {state.strategy_iter})...",
            None,
        )
        await self._agent.swap(self._config.planner)

        prompt = f"<code>{state.base_code}</code>\n<instruction>{state.user_instruction}</instruction>"
        messages: list[ChatCompletionRequestMessage] = [
            {"role": "system", "content": self._prompts["planner"]["classifier"]},
            {"role": "user", "content": prompt},
        ]

        raw = await self._agent.generate(
            messages, temp=0.1, max_tokens=self._config.orchestration.classifier_max_tokens,
            response_model=IntentClassifierResponse,
        )
        response_text = raw["choices"][0]["message"].get("content") or ""
        print(f"\n--- Planner Classifier Output ---\n{response_text}\n-------------------------------")

        classifier_res = ResponseParser.extract_json(response_text, IntentClassifierResponse)
        state.intent_packet = classifier_res.intent_packet.model_dump()

        self._notify(
            client, Role.Planner,
            f"Intent Classified: {state.intent_packet['specific_intent']}",
            json.dumps(state.intent_packet),
        )

    async def _analyze(self, client, state) -> None:
        self._notify(client, Role.Planner, "Strategy: Analyzing code structure...", None)

        analysis_prompt = (
            f"Intent Packet: {json.dumps(state.intent_packet)}\n"
            f"User Instruction: {state.user_instruction}\n"
            f"Code: <code>{state.base_code}</code>"
        )

        system_content = self._prompts["planner"]["architect_analysis"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self._prompts["planner"]["analysis_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": analysis_prompt},
        ]

        raw = await self._agent.generate(
            messages, temp=0.1, max_tokens=self._config.orchestration.analysis_max_tokens,
            response_model=ArchitectAnalysisResponse,
        )
        analysis_text = raw["choices"][0]["message"].get("content") or ""
        print(f"\n--- Planner Analysis Output ---\n{analysis_text}\n-------------------------------")

        try:
            analysis_model = ResponseParser.extract_json(analysis_text, ArchitectAnalysisResponse)
            state.architect_analysis = analysis_model.model_dump()
        except (ValidationError, ValueError, json.JSONDecodeError):
            state.architect_analysis = {}

        self._notify(
            client, Role.Planner, "Structure analysis complete.",
            json.dumps(state.architect_analysis),
        )

    async def _synthesize(self, client, state) -> None:
        self._notify(client, Role.Planner, "Strategy: Designing mutation plan...", None)

        arch_prompt = (
            f"Analysis: {json.dumps(state.architect_analysis)}\n"
            f"Intent: {json.dumps(state.intent_packet)}\n"
            f"Instruction: {state.user_instruction}\n"
            f"Code: <code>{state.base_code}</code>"
        )
        if state.cumulative_feedback:
            arch_prompt += (
                f"\n\n### PREVIOUS ATTEMPT FEEDBACK\n{json.dumps(state.cumulative_feedback, indent=2)}"
            )
            suggestions = self._translate_feedback(state)
            if suggestions:
                arch_prompt += "\n\n### HOW TO FIX\n" + "\n".join(suggestions)

        system_content = self._prompts["planner"]["architect"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self._prompts["planner"]["synthesis_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": arch_prompt},
        ]

        for _attempt in range(2):
            temp = 0.2 if _attempt == 0 else 0.5
            try:
                raw = await self._agent.generate(
                    messages, temp=temp, max_tokens=4096,
                    response_model=ASTArchitectResponse,
                )
                arch_text = raw["choices"][0]["message"].get("content") or ""
                header = "--- Planner Architect Output ---"
                if _attempt > 0:
                    header = f"--- Planner Architect Output (Retry {_attempt}) ---"
                print(f"\n{header}\n{arch_text}\n------------------------------")
                architect_res = ResponseParser.extract_json(arch_text, ASTArchitectResponse)
                plan = architect_res.ast_modification_plan.model_dump()
                mutations = plan.get("ast_mutations", [])
                if len(mutations) > self._config.orchestration.mutation_cap:
                    plan["ast_mutations"] = mutations[:self._config.orchestration.truncation_size]
                    print(f"  WARNING: Architect generated {len(mutations)} mutations — truncated to {self._config.orchestration.truncation_size}")
                state.active_plan = plan
                return
            except (ValidationError, ValueError):
                if _attempt == 0:
                    print("  Architect attempt 1 failed. Retrying with temp=0.5...")
                    await self._agent.clear_context()
                else:
                    print("  Architect failed on both attempts. Falling back to strategy retry.")
                    state.add_feedback({
                        "failure_tier": FailureTier.TIER_1_SYNTAX,
                        "error": "Architect failed to produce valid mutation plan on both attempts.",
                    })
                    if not state.strategy_iter_incremented:
                        state.strategy_iter += 1
                        state.strategy_iter_incremented = True
                    state.current_phase = 2
                    return

    def _enrich(self, state) -> None:
        if state.active_plan is None:
            raise RuntimeError("Architect produced no plan but pipeline continued")
        intent_key = state.intent_packet.get("specific_intent", "") if state.intent_packet else None
        target_method = state.intent_packet.get("scope_anchor", {}).get("member", "") if state.intent_packet else None
        enriched = ASTMatcher.enrich_mutations(
            state.base_code,
            state.active_plan.get("ast_mutations", []),
            intent=intent_key,
            target_method=target_method,
        )
        state.active_plan["ast_mutations"] = enriched
        state.active_plan["enriched_by"] = "ASTMatcher"

    def _deduplicate(self, state) -> None:
        deduped = []
        seen = set()
        for m in state.active_plan.get("ast_mutations", []):
            key = (m.get("action"), m.get("target"))
            if key not in seen:
                seen.add(key)
                deduped.append(m)
        cap = self._config.orchestration.deduplication_cap
        if len(deduped) > cap:
            print(f"WARNING: Truncated plan: {len(deduped)} → {cap} mutations")
            deduped = deduped[:cap]
        state.active_plan["ast_mutations"] = deduped

    @staticmethod
    def _translate_feedback(state) -> list[str]:
        suggestions = []
        for fb in state.cumulative_feedback:
            tier = str(fb.get("failure_tier", ""))
            err = str(fb.get("error", "") or fb.get("error_report", {}).get("message", ""))
            if "INTENT_MATH" in tier:
                if "conditional" in err.lower() or "consolidat" in err.lower():
                    suggestions.append(
                        "- INTENT_MATH FAILED: Conditional count did not change. "
                        "Try a different approach to consolidation — merge the loop bodies "
                        "into a single pass rather than keeping them separate. "
                        "Use MODIFY_METHOD with a specific body_abstract describing the merge."
                    )
                elif "loop" in err.lower() or "split" in err.lower():
                    suggestions.append(
                        "- INTENT_MATH FAILED: Loop count did not increase. "
                        "Create explicit separate methods or loops using SPLIT_BODY "
                        "for each operation you want to split from the original loop."
                    )
                elif "nesting" in err.lower() or "flatten" in err.lower():
                    suggestions.append(
                        "- INTENT_MATH FAILED: Nesting depth did not decrease. "
                        "Move nested conditions to the method top as guard clauses "
                        "using early return/throw. Invert the conditions."
                    )
                elif "variable" in err.lower() or "extract" in err.lower():
                    suggestions.append(
                        "- INTENT_MATH FAILED: Variable/constant count did not change. "
                        "Use ADD_DECLARATION with scope='local' for variables "
                        "or scope='static_final' for constants. Declare before use."
                    )
                else:
                    suggestions.append(
                        "- INTENT_MATH FAILED: The structural changes were not detected. "
                        "Try a different mutation strategy — change scope (local vs field), "
                        "use ADD_DECLARATION or SPLIT_BODY instead of ADD_FIELD."
                    )
            elif "COMPLEXITY" in tier:
                suggestions.append(
                    "- CC INCREASED: Reduce unnecessary class-level fields or helper methods. "
                    "Use local variables inside the method body instead. "
                    f"Original CC was {state.original_complexity}."
                )
            elif "BOUNDARY" in tier:
                suggestions.append(
                    "- BOUNDARY VIOLATION: A method outside the target scope was modified. "
                    "Restrict ALL mutations to only the methods listed in primary_targets. "
                    "Do not touch any other method."
                )
            elif "SYNTAX" in tier:
                suggestions.append(
                    "- SYNTAX ERROR: Generated code had invalid Java syntax. "
                    "Ensure all braces, semicolons, and type declarations are correct."
                )
        return suggestions
