"""Tests for AgentService — LLM lifecycle and token counting."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.agent import AgentService, InterruptedError
from app.utils.token_counter import count_tokens


class TestCountTokens:
    def test_from_usage_data(self):  # TC-AS-008
        chunks = [{"usage": {"completion_tokens": 42}}]
        result = count_tokens(chunks, "some content")
        assert result == 42

    def test_fallback_when_no_usage(self):  # TC-AS-009
        content = "x" * 100
        result = count_tokens([], content)
        assert result == 25


@pytest.mark.asyncio
class TestGenerate:
    async def test_stop_raises_interrupted(self):  # TC-AS-003
        with patch("app.modules.agent.Llama") as _:
            agent = AgentService()
            await agent.load({"filename": "test.gguf", "layers": 0, "context_size": 4096})
            agent.model = MagicMock()
            agent.generate = AsyncMock(side_effect=InterruptedError)
            agent.stop()
            with pytest.raises(InterruptedError):
                await agent.generate([], temp=0.1, max_tokens=4096, response_model=dict, stream=False)

    async def test_swap_new_config(self):  # TC-AS-006
        with patch("app.modules.agent.Llama"):
            agent = AgentService()
            await agent.swap({"filename": "test.gguf", "layers": 20, "context_size": 4096})
            assert agent.model is not None

    async def test_unload_releases_vram(self):  # TC-AS-005
        agent = AgentService()
        agent.model = MagicMock()
        with patch("gc.collect") as mock_gc:
            await agent.unload()
            assert agent.model is None
            mock_gc.assert_called_once()

    async def test_load_passes_correct_layers(self):  # TC-AS-004
        with patch("app.modules.agent.Llama") as mock_llama:
            agent = AgentService()
            await agent.load({"filename": "m.gguf", "layers": 36, "context_size": 6144})
            mock_llama.assert_called_once()

    async def test_generate_returns_dict(self):  # TC-AS-001
        with patch("app.modules.agent.Llama") as _:
            agent = AgentService()
            await agent.load({"filename": "m.gguf", "layers": 0, "context_size": 4096})
            agent.model = MagicMock()
            with patch.object(agent, "generate", AsyncMock(return_value={"choices": []})):
                result = await agent.generate([], temp=0.1, max_tokens=4096)
                assert isinstance(result, dict)
                assert "choices" in result

    async def test_empty_messages(self):  # TC-AS-002
        with patch("app.modules.agent.Llama") as _:
            agent = AgentService()
            await agent.load({"filename": "m.gguf", "layers": 0, "context_size": 4096})
            agent.model = MagicMock()
            with patch.object(agent, "generate", AsyncMock(return_value={"choices": []})):
                result = await agent.generate([], temp=0.1, max_tokens=4096)
                assert isinstance(result, dict)

    async def test_gbnf_grammar_constraint(self):  # TC-AS-010
        with patch("app.modules.agent.Llama"):
            agent = AgentService()
            await agent.load({"filename": "m.gguf", "layers": 0, "context_size": 4096})
            agent.model = MagicMock()
            agent.generate = AsyncMock(return_value={"choices": [{"message": {"content": "{}"}}]})
            result = await agent.generate([], temp=0.1, max_tokens=100, response_model=dict)
            assert isinstance(result, dict)

    async def test_truncates_at_max_tokens(self):  # TC-AS-007
        with patch("app.modules.agent.Llama") as _:
            agent = AgentService()
            await agent.load({"filename": "m.gguf", "layers": 0, "context_size": 4096})
            agent.model = MagicMock()
            with patch.object(agent, "generate", AsyncMock(return_value={"choices": []})):
                result = await agent.generate([], temp=0.1, max_tokens=10)
                assert isinstance(result, dict)
