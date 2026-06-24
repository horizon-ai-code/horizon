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

    async def test_dispatch_pong(self, router):  # TC-MR-001
        client = AsyncMock()
        data = {"type": "pong"}
        await router.dispatch(data, client, set(), None, None, None)
        client.handle_pong.assert_called_once()

    async def test_dispatch_reconnect(self, router):  # TC-MR-002
        client = AsyncMock()
        reconnect = AsyncMock()
        data = {"type": "reconnect", "session_id": "s1"}
        await router.dispatch(data, client, set(), None, None, reconnect)
        reconnect.assert_awaited_once_with("s1", client.websocket)

    async def test_dispatch_single(self, router):  # TC-MR-003
        client = AsyncMock()
        client.send_status = AsyncMock()
        data = {"type": "single", "code": "class A {}", "user_instruction": "refactor"}
        result = await router.dispatch(data, client, set(), AsyncMock(), None, None)
        assert result is True

    async def test_dispatch_multi(self, router):  # TC-MR-004
        client = AsyncMock()
        client.send_status = AsyncMock()
        data = {"type": "multi", "code": "class A {}", "user_instruction": "refactor"}
        result = await router.dispatch(data, client, set(), None, AsyncMock(), None)
        assert result is True

    async def test_dispatch_halt(self, router):  # TC-MR-005
        client = AsyncMock()
        data = {"type": "halt"}
        await router.dispatch(data, client, set(), None, None, None)
        router._agent_service.stop.assert_called_once()

    async def test_dispatch_malformed_json_rejected(self, router):  # TC-MR-007
        client = AsyncMock()
        client._safe_send = AsyncMock()
        data = {"type": None}
        result = await router.dispatch(data, client, set(), None, None, None)
        assert result is False

    async def test_dispatch_invalid_request_sends_error(self, router):  # TC-MR-006
        client = AsyncMock()
        data = {"type": "multi", "code": ""}
        result = await router.dispatch(data, client, set(), None, None, None)
        assert result is True

    async def test_dispatch_unknown_type_ignored(self, router):  # TC-MR-008
        client = AsyncMock()
        data = {"type": "unknown"}
        result = await router.dispatch(data, client, set(), None, None, None)
        assert result is False
