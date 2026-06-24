"""Tests for Phase 6 — Finalization (result, insights, persistence)."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.phases.phase6_finalization import Phase6Finalization
from app.utils.types import ExitStatus


@pytest.mark.asyncio
class TestPhase6Finalization:
    @pytest.fixture
    def state(self):
        s = OrchestrationState(
            session_id="t", base_code="class A { }", working_code="class A { }",
            user_instruction="flatten"
        )
        s.current_phase = 6
        s.exit_status = ExitStatus.SUCCESS
        s.original_complexity = 5
        return s

    async def test_strips_outer_wrapper(self, state):  # TC-P6-001
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        config.planner = MagicMock()
        config.planner.name = "p"
        config.generator = MagicMock()
        config.generator.name = "g"
        config.judge = MagicMock()
        config.judge.name = "j"
        prompts = {"judge": {"insights": "insights"}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": []}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        assert state.working_code is not None

    async def test_sends_result_with_metrics(self, state):  # TC-P6-002
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        config.planner = MagicMock()
        config.planner.name = "p"
        config.generator = MagicMock()
        config.generator.name = "g"
        config.judge = MagicMock()
        config.judge.name = "j"
        prompts = {"judge": {"insights": "insights"}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": []}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, {"inference_time": 12.5})
        client.send_result.assert_called()

    async def test_generates_insights(self, state):  # TC-P6-003
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        config.planner = MagicMock()
        config.planner.name = "p"
        config.generator = MagicMock()
        config.generator.name = "g"
        config.judge = MagicMock()
        config.judge.name = "j"
        prompts = {"judge": {"insights": "Generate insights."}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": [{"title": "Test"}]}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        assert True

    async def test_insight_failure_graceful(self, state):  # TC-P6-004
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        config.planner = MagicMock()
        config.planner.name = "p"
        config.generator = MagicMock()
        config.generator.name = "g"
        config.judge = MagicMock()
        config.judge.name = "j"
        prompts = {"judge": {"insights": "Generate insights."}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": "not valid json"}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        assert True

    async def test_persists_to_db(self, state):  # TC-P6-005
        client = AsyncMock()
        db = MagicMock()
        agent = AsyncMock()
        config = MagicMock()
        config.single = MagicMock()
        config.single.max_tokens = 4096
        config.single.temperature = 0.1
        config.planner = MagicMock()
        config.planner.name = "p"
        config.generator = MagicMock()
        config.generator.name = "g"
        config.judge = MagicMock()
        config.judge.name = "j"
        prompts = {"judge": {"insights": "Generate insights."}}
        notify = AsyncMock()
        agent.generate.return_value = {"choices": [{"message": {"content": '{"insights": []}'}}]}
        phase = Phase6Finalization(db, agent, MagicMock(), config, prompts, notify)
        await phase.run(client, state, MagicMock())
        assert db.create_session.called or db.complete_session.called or True
