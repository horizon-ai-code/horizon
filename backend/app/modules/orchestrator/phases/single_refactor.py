import json
from typing import Any, Awaitable, Callable

from app.utils.performance import PerformanceTracker
from app.utils.response_parser import ResponseParser
from app.utils.schemas import RefactorInsightsResponse
from app.utils.types import Role

Notifier = Callable[[Any, Role, str, str | None], Awaitable[None]]


class SingleRefactor:
    def __init__(self, agent_service, validator, db, config, prompts: dict[str, Any], notify: Notifier):
        self._agent = agent_service
        self._validator = validator
        self._db = db
        self._config = config
        self._prompts = prompts
        self._notify = notify

    async def run(self, client, user_code: str, user_instruction: str) -> None:
        cfg = self._config.single
        prompts = self._prompts["single"]

        tracker = PerformanceTracker()
        await tracker.start_tracking()

        self._db.create_session(
            id=client.id, instruction=user_instruction, original_code=user_code, mode="single",
        )

        await self._agent.swap(cfg)
        await self._agent.clear_context()

        orig_cc = self._validator.get_complexity(user_code)

        await self._notify(client, Role.Monolith, "Generating refactored code...", None)
        coder_prompt = f"<code>{user_code}</code>\n\nInstruction: {user_instruction}"
        messages = [
            {"role": "system", "content": prompts["coder"]},
            {"role": "user", "content": coder_prompt},
        ]
        raw = await self._agent.generate(messages, temp=0.1, max_tokens=4096)
        response_text = raw["choices"][0]["message"].get("content") or ""
        refactored = ResponseParser.extract_xml(response_text, "code") or user_code

        refac_cc = self._validator.get_complexity(refactored)

        await self._notify(client, Role.Monolith, "Generating insights...", None)
        await self._agent.clear_context()
        insight_prompt = f"Original: <code>{user_code}</code>\nRefactored: <code>{refactored}</code>"
        insight_messages = [
            {"role": "system", "content": prompts["insights"]},
            {"role": "user", "content": insight_prompt},
        ]
        raw2 = await self._agent.generate(
            insight_messages, temp=0.1, max_tokens=1000,
            response_model=RefactorInsightsResponse,
        )
        insight_text = raw2["choices"][0]["message"].get("content") or ""
        insights_res = ResponseParser.extract_json(insight_text, RefactorInsightsResponse)
        insight_dicts = [i.model_dump() for i in insights_res.insights]

        await tracker.stop_tracking()
        perf = tracker.get_metrics()

        await client.send_result(
            final_code=refactored, original_complexity=orig_cc, refactored_complexity=refac_cc,
            performance_metrics=perf, exit_status="SUCCESS", generator_model=cfg.name,
        )
        await client.send_insights(insight_dicts)

        self._db.complete_session(
            id=client.id, refactored_code=refactored, insights=json.dumps(insight_dicts),
            original_complexity=orig_cc, refactored_complexity=refac_cc,
            performance_metrics=perf, exit_status="SUCCESS", mode="single",
        )
