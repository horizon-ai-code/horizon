"""Tests for MessageRouter — WebSocket message dispatch."""

from unittest.mock import AsyncMock

import pytest

from app.modules.connection.router import MessageRouter


@pytest.mark.asyncio
class TestMessageRouter:
    @pytest.fixture
    def router(self):
        agent = AsyncMock()
        return MessageRouter(agent)

    async def test_dispatch_pong(self, router):
        client = AsyncMock()
        data = {"type": "pong"}
        await router.dispatch(data, client, set(), None, None, None)
        client.handle_pong.assert_called_once()

    async def test_dispatch_halt(self, router):
        client = AsyncMock()
        data = {"type": "halt"}
        await router.dispatch(data, client, set(), None, None, None)
        router._agent_service.stop.assert_called_once()

    async def test_dispatch_unknown_type_ignored(self, router):
        client = AsyncMock()
        data = {"type": "unknown"}
        result = await router.dispatch(data, client, set(), None, None, None)
        assert result is False
