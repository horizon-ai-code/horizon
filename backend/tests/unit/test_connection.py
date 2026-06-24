"""Tests for ClientConnection — WebSocket messaging and heartbeat."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from app.modules.connection import ClientConnection
from app.utils.types import Role


@pytest.mark.asyncio
class TestClientConnection:
    @pytest.fixture
    def client(self):
        ws = AsyncMock()
        return ClientConnection(ws, MagicMock())

    async def test_send_status(self, client):
        await client.send_status(Role.Planner, "Analyzing...")
        client.websocket.send_json.assert_awaited()

    async def test_send_result_includes_models(self, client):
        await client.send_result(
            final_code="code",
            original_complexity=10,
            refactored_complexity=5,
            performance_metrics={},
            planner_model="Model-A",
            generator_model="Model-B",
            judge_model="Model-C",
        )
        client.websocket.send_json.assert_awaited()

    async def test_send_halt_notification(self, client):
        await client.send_halt_notification()
        client.websocket.send_json.assert_awaited()

    def test_is_stale_true_after_2_missed(self, client):
        client._missed_pongs = 2
        assert client.is_stale is True

    def test_is_stale_false_within_limit(self, client):
        client._missed_pongs = 1
        assert client.is_stale is False

    def test_handle_pong_resets_counter(self, client):
        client._missed_pongs = 1
        client.handle_pong()
        assert client._missed_pongs == 0

    async def test_send_status_proceeds_when_fresh(self, client):
        client._missed_pongs = 0
        await client.send_status(Role.System, "test")
        client.websocket.send_json.assert_awaited()
