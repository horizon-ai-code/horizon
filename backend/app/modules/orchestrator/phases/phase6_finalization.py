import json
from collections.abc import Awaitable, Callable
from typing import Any

from llama_cpp import ChatCompletionRequestMessage
from pydantic import ValidationError

from app.utils.code_utils import strip_outer_wrapper
from app.utils.response_parser import ResponseParser
from app.utils.schemas import RefactorInsightsResponse
from app.utils.types import ExitStatus, Role

Notifier = Callable[[Any, Role, str, str | None], Awaitable[None]]


class Phase6Finalization:
    def __init__(self, db, agent_service, validator, config, prompts: dict[str, Any], notify: Notifier):
        self._db = db
        self._agent = agent_service
        self._validator = validator
        self._config = config
        self._prompts = prompts
        self._notify = notify

    async def run(self, client, state, metrics: dict[str, Any], phase_data: dict | None = None) -> None:
        state.working_code = strip_outer_wrapper(state.working_code, state.base_code)

        await self._notify(
            client, Role.System,
            f"Finalization: Finalizing session (Status: {state.exit_status})...",
            None,
        )

        final_code = state.working_code if state.exit_status == ExitStatus.SUCCESS else state.base_code

        await client.send_result(
            final_code=final_code,
            original_complexity=state.original_complexity,
            refactored_complexity=self._validator.get_complexity(final_code),
            performance_metrics=metrics,
            exit_status=state.exit_status.value,
            planner_model=self._config.planner.name,
            generator_model=self._config.generator.name,
            judge_model=self._config.judge.name,
        )

        insights: Any = []
        if state.exit_status == ExitStatus.SUCCESS:
            await self._notify(client, Role.Judge, "Generating insights...", None)
            try:
                insights = await self._generate_insights(
                    state.base_code, state.working_code,
                    state.original_complexity,
                    self._validator.get_complexity(state.working_code),
                )
            except Exception as e:
                print(f"Error generating insights: {e}")
                insights = "Refactoring successful (Insights generation failed)."
        else:
            abort_reasons = {
                ExitStatus.ABORT_STRATEGY: [
                    {"title": "Max Retries Exceeded", "details": "Refactoring aborted after reaching the maximum number of strategy retries."},
                    {"title": "Process Halted", "details": "The system attempted multiple refactoring strategies but could not produce valid code."},
                    {"title": "Safe Rollback", "details": "The refactoring has been safely aborted and your original code has been fully restored."},
                    {"title": "Recommendation", "details": "Try breaking the requested task into smaller, simpler chunks."}
                ],
                ExitStatus.ABORT_INPUT: [
                    {"title": "Pre-existing Errors", "details": "The baseline code provided contains syntax or semantic errors."},
                    {"title": "Process Halted", "details": "Refactoring cannot proceed safely on broken code."},
                    {"title": "Safe Rollback", "details": "Your original code has been fully preserved."},
                    {"title": "Action Required", "details": "Please ensure the code cleanly compiles before attempting to refactor."}
                ],
                ExitStatus.ABORT_SYNTAX: [
                    {"title": "Syntax Error", "details": "The AI introduced syntax errors that it was unable to resolve during self-correction loops."},
                    {"title": "Process Halted", "details": "The generation process exceeded maximum correction attempts."},
                    {"title": "Safe Rollback", "details": "The refactoring has been safely aborted and your original code has been fully restored."},
                    {"title": "Recommendation", "details": "Try breaking the requested task into smaller, simpler chunks."}
                ],
                ExitStatus.ABORT_SEMANTIC: [
                    {"title": "Validation Failed", "details": "The AI-generated code passed syntax checks but failed semantic validation."},
                    {"title": "Context Missing", "details": "This typically occurs due to missing imports, undefined variables, or type mismatches."},
                    {"title": "Safe Rollback", "details": "The refactoring has been safely aborted and your original code has been fully restored."},
                    {"title": "Recommendation", "details": "Consider providing more explicit context or constraints in your request."}
                ],
            }
            insights = abort_reasons.get(
                state.exit_status,
                f"Refactoring aborted ({state.exit_status}). Original code restored."
            )

        await client.send_insights(insights)

        self._db.complete_session(
            id=state.session_id,
            refactored_code=final_code,
            insights=json.dumps(insights) if not isinstance(insights, str) else insights,
            original_complexity=state.original_complexity,
            refactored_complexity=self._validator.get_complexity(final_code),
            performance_metrics=metrics,
            exit_status=state.exit_status.value,
            final_intent=json.dumps(state.intent_packet),
            final_plan=json.dumps(state.active_plan),
            outer_loops=state.strategy_iter,
            inner_loops=state.syntax_iter,
            planner_model=self._config.planner.name,
            generator_model=self._config.generator.name,
            judge_model=self._config.judge.name,
            phase_states=json.dumps(phase_data) if phase_data else None,
        )

    async def _generate_insights(self, user_code: str, refactored_code: str,
                                  original_complexity: int, refactored_complexity: int) -> Any:
        await self._agent.swap(self._config.judge)

        prompt = (
            f"--- ORIGINAL CODE ---\n{user_code}\n\n"
            f"--- REFACTORED CODE ---\n{refactored_code}\n\n"
            f"Original Complexity: {original_complexity}\n"
            f"Refactored Complexity: {refactored_complexity}\n"
        )
        messages: list[ChatCompletionRequestMessage] = [
            {"role": "system", "content": self._prompts["judge"]["insights"]},
            {"role": "user", "content": prompt},
        ]

        raw_reponse = await self._agent.generate(
            messages=messages, temp=0.1, max_tokens=1000, stream=False,
            response_model=RefactorInsightsResponse,
        )
        text = raw_reponse["choices"][0]["message"].get("content") or ""
        print(f"\n--- Judge Insights Output ---\n{text}\n---------------------------")

        try:
            insights_res = ResponseParser.extract_json(text, RefactorInsightsResponse)
            return [i.model_dump() for i in insights_res.insights]
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            print(f"Failed to parse insights JSON: {e}")
            return [{"title": "Refactoring Summary", "details": text.strip()}]
