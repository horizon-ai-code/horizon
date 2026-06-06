"""Verification tests for connection_manager.py changes."""
import unittest
from unittest.mock import AsyncMock, MagicMock
from fastapi import WebSocketDisconnect
from app.modules.connection_manager import ClientConnection


class TestSafeSend(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_websocket = AsyncMock()
        self.client_connection = ClientConnection(self.mock_websocket, MagicMock())

    async def test_safe_send_success(self):
        """_safe_send calls send_json with the correct message."""
        await self.client_connection._safe_send({"type": "test"})
        self.mock_websocket.send_json.assert_awaited_once_with({"type": "test"})

    async def test_safe_send_disconnect_does_not_crash(self):
        """_safe_send catches WebSocketDisconnect — proves it actually attempted send."""
        self.mock_websocket.send_json.side_effect = WebSocketDisconnect()
        await self.client_connection._safe_send({"type": "test"})
        self.mock_websocket.send_json.assert_awaited_once()

    async def test_send_result_includes_exit_status(self):
        """send_result payload contains exit_status field."""
        await self.client_connection.send_result(
            final_code="code", original_complexity=5,
            refactored_complexity=3, performance_metrics={},
            exit_status="ABORT_STRATEGY",
        )
        sent = self.mock_websocket.send_json.call_args[0][0]
        self.assertIn("exit_status", sent)
        self.assertEqual(sent["exit_status"], "ABORT_STRATEGY")
