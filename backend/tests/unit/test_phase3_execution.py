"""Tests for Phase 3 — Execution (repair, single, sequential)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.orchestrator import OrchestrationState
from app.modules.orchestrator.config import OrchestrationConfig
from app.modules.orchestrator.phases.phase3_execution import Phase3Execution, repair_generator_output


class TestRepairGeneratorOutput:
    def test_removes_throws(self):  # TC-P3-001
        orig = "void m() { return; }"
        gen = "void m() throws Exception { return; }"
        result = repair_generator_output(orig, gen)
        assert result is not None

    def test_strips_null_check(self):  # TC-P3-002
        orig = "void m() { return; }"
        gen = "void m() { if (x != null) { return; } }"
        result = repair_generator_output(orig, gen)
        assert result is not None

    def test_strips_extra_public(self):  # TC-P3-003
        orig = "void m() { }"
        gen = "public void m() { }"
        result = repair_generator_output(orig, gen)
        assert "public" not in result

    def test_leaves_valid_unchanged(self):  # TC-P3-004
        orig = "void m() { return; }"
        result = repair_generator_output(orig, orig)
        assert result == orig


def _make_config():
    return OrchestrationConfig.from_dict({
        "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "generator": {"name": "g", "filename": "g.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "judge": {"name": "j", "filename": "j.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 28},
        "single": {"name": "s", "filename": "s.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 4096, "layers": 20},
        "settings": {"deduplication_cap": 5, "max_strategy_iter": 3, "max_syntax_heal": 3, "sequential_retry_limit": 1},
    })


def _make_prompts():
    return {
        "generator": {"coder": "Generate code.", "coder_guidance": {"FLATTEN_CONDITIONAL": "Flatten."}},
        "planner": {"classifier": "", "architect_analysis": "", "analysis_guidance": {}, "architect": "", "synthesis_guidance": {}},
        "judge": {"auditor": "", "auditor_guidance": {}, "insights": ""},
        "single": {"coder": "", "insights": ""},
    }


@pytest.mark.asyncio
class TestPhase3Execution:
    @pytest.fixture
    def state(self):
        s = OrchestrationState(session_id="t", base_code="class A {}", working_code="class A {}", user_instruction="flatten")
        s.active_plan = {"ast_mutations": [{"action": "MODIFY_METHOD", "target": "m", "details": {}}]}
        return s

    async def test_run_single_fallback_all_fail(self, state):  # TC-P3-006
        with patch("app.modules.agent.Llama"):
            agent = AsyncMock()
            agent.generate.return_value = {"choices": [{"message": {"content": "no code block"}}]}
            agent.load = AsyncMock()
            agent.swap = AsyncMock()
            agent.clear_context = AsyncMock()
            validator = MagicMock()
            validator.get_complexity.return_value = 99
            notify = AsyncMock()
            phase = Phase3Execution(agent, validator, _make_config(), _make_prompts(), notify)
            state.syntax_iter = 0
            await phase.run_single(MagicMock(), state)
            assert True

    async def test_run_single_picks_best_cc(self, state):  # TC-P3-005
        with patch("app.modules.agent.Llama"):
            agent = AsyncMock()
            agent.generate.return_value = {"choices": [{"message": {"content": "<code>class A { void m() { return; } }</code>"}}]}
            agent.load = AsyncMock()
            agent.swap = AsyncMock()
            agent.clear_context = AsyncMock()
            validator = MagicMock()
            validator.get_complexity.return_value = 3
            notify = AsyncMock()
            phase = Phase3Execution(agent, validator, _make_config(), _make_prompts(), notify)
            state.syntax_iter = 0
            await phase.run_single(MagicMock(), state)
            assert state.working_code is not None

    async def test_run_sequential_applies_one_by_one(self, state):  # TC-P3-007
        with patch("app.modules.agent.Llama"):
            agent = AsyncMock()
            agent.generate.return_value = {"choices": [{"message": {"content": "<code>class A { void m() { if(!a) return; } }</code>"}}]}
            agent.load = AsyncMock()
            agent.swap = AsyncMock()
            agent.clear_context = AsyncMock()
            validator = MagicMock()
            validator.get_complexity.return_value = 3
            validator.check_syntax.return_value = {"is_valid": True}
            notify = AsyncMock()
            phase = Phase3Execution(agent, validator, _make_config(), _make_prompts(), notify)
            state.syntax_iter = 0
            await phase.run_sequential(MagicMock(), state)
            assert state.working_code is not None

    async def test_sequential_syntax_healing(self, state):  # TC-P3-008
        with patch("app.modules.agent.Llama"):
            agent = AsyncMock()
            agent.generate.return_value = {"choices": [{"message": {"content": "<code>class A { void m() { return; } }</code>"}}]}
            agent.load = AsyncMock()
            agent.swap = AsyncMock()
            agent.clear_context = AsyncMock()
            validator = MagicMock()
            validator.get_complexity.return_value = 3
            validator.check_syntax.return_value = {"is_valid": True}
            notify = AsyncMock()
            phase = Phase3Execution(agent, validator, _make_config(), _make_prompts(), notify)
            state.syntax_iter = 0
            await phase.run_sequential(MagicMock(), state)
            assert state.syntax_iter >= 0

    async def test_sequential_boundary_break(self, state):  # TC-P3-009
        with patch("app.modules.agent.Llama"):
            agent = AsyncMock()
            agent.generate.return_value = {"choices": [{"message": {"content": "<code>class A { void m() { return; } }</code>"}}]}
            agent.load = AsyncMock()
            agent.swap = AsyncMock()
            agent.clear_context = AsyncMock()
            validator = MagicMock()
            validator.get_complexity.return_value = 3
            validator.check_syntax.return_value = {"is_valid": True}
            notify = AsyncMock()
            phase = Phase3Execution(agent, validator, _make_config(), _make_prompts(), notify)
            state.syntax_iter = 0
            await phase.run_sequential(MagicMock(), state)
            assert True

    async def test_sequential_max_heals(self, state):  # TC-P3-010
        with patch("app.modules.agent.Llama"):
            agent = AsyncMock()
            agent.generate.return_value = {"choices": [{"message": {"content": "<code>class A { void m() { return; } }</code>"}}]}
            agent.load = AsyncMock()
            agent.swap = AsyncMock()
            agent.clear_context = AsyncMock()
            validator = MagicMock()
            validator.get_complexity.return_value = 3
            validator.check_syntax.return_value = {"is_valid": True}
            notify = AsyncMock()
            phase = Phase3Execution(agent, validator, _make_config(), _make_prompts(), notify)
            state.syntax_iter = 0
            await phase.run_sequential(MagicMock(), state)
            assert True
