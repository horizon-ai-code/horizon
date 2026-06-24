"""Tests for AgentService — LLM lifecycle and token counting."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.modules.agent import AgentService, InterruptedError


class TestCountTokens:
    def test_from_usage_data(self):
        chunks = [{"usage": {"completion_tokens": 42}}]
        count = AgentService._count_tokens(chunks, "some content")
        assert count == 42

    def test_fallback_when_no_usage(self):
        content = "x" * 100
        count = AgentService._count_tokens([], content)
        assert count == 25


@pytest.mark.asyncio
class TestGenerate:
    async def test_stop_raises_interrupted(self):
        with patch("app.modules.agent.Llama") as _:
            agent = AgentService()
            await agent.load({"filename": "test.gguf", "layers": 0, "context_size": 4096})
            agent.model = MagicMock()
            agent.generate = AsyncMock(side_effect=InterruptedError)
            agent.stop()
            with pytest.raises(InterruptedError):
                await agent.generate([], temp=0.1, max_tokens=4096, response_model=dict, stream=False)

    async def test_swap_new_config(self):
        with patch("app.modules.agent.Llama"):
            agent = AgentService()
            await agent.swap({"filename": "test.gguf", "layers": 20, "context_size": 4096})
            assert agent.model is not None

    async def test_unload_releases_vram(self):
        agent = AgentService()
        agent.model = MagicMock()
        with patch("gc.collect") as mock_gc:
            await agent.unload()
            assert agent.model is None
            mock_gc.assert_called_once()
