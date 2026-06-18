"""Verification tests for connection_manager.py changes.

Covers: _safe_send, exit_status, bidirectional heartbeat, stale detection.
"""
import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock

from fastapi import WebSocketDisconnect

from app.modules.connection_manager import ClientConnection
from app.modules.context_manager import DatabaseManager


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


class TestHeartbeat(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_websocket = AsyncMock()
        self.client_connection = ClientConnection(self.mock_websocket, MagicMock())

    async def test_heartbeat_sends_ping(self):
        """start_heartbeat begins sending ping messages."""
        ClientConnection.HEARTBEAT_INTERVAL = 0.01
        await self.client_connection.start_heartbeat()
        await asyncio.sleep(0.03)
        await self.client_connection.stop_heartbeat()
        self.mock_websocket.send_json.assert_called()
        sent = self.mock_websocket.send_json.call_args[0][0]
        self.assertEqual(sent["type"], "ping")

    async def test_heartbeat_increments_missed_pongs(self):
        """When no pong received, missed_pongs increments each interval."""
        ClientConnection.HEARTBEAT_INTERVAL = 0.01
        await self.client_connection.start_heartbeat()
        await asyncio.sleep(0.03)
        await self.client_connection.stop_heartbeat()
        self.assertGreaterEqual(self.client_connection._missed_pongs, 1)

    async def test_handle_pong_resets_missed_pongs(self):
        """handle_pong resets the missed counter."""
        self.client_connection._missed_pongs = 2
        self.client_connection.handle_pong()
        self.assertEqual(self.client_connection._missed_pongs, 0)

    async def test_is_stale_false_initially(self):
        """A freshly created connection is not stale."""
        self.assertFalse(self.client_connection.is_stale)

    async def test_is_stale_true_after_max_misses(self):
        """is_stale is True when missed_pongs >= MAX_MISSED_PONGS."""
        self.client_connection._missed_pongs = ClientConnection.MAX_MISSED_PONGS
        self.assertTrue(self.client_connection.is_stale)

    async def test_stop_heartbeat_cancels_task(self):
        """stop_heartbeat clears the heartbeat task reference."""
        await self.client_connection.start_heartbeat()
        self.assertIsNotNone(self.client_connection._heartbeat_task)
        await self.client_connection.stop_heartbeat()
        self.assertIsNone(self.client_connection._heartbeat_task)

    async def test_heartbeat_uses_safe_send(self):
        """Heartbeat ping uses _safe_send — disconnect doesn't crash."""
        self.mock_websocket.send_json.side_effect = WebSocketDisconnect()
        ClientConnection.HEARTBEAT_INTERVAL = 0.01
        await self.client_connection.start_heartbeat()
        await asyncio.sleep(0.03)
        await self.client_connection.stop_heartbeat()


    async def test_heartbeat_increments_after_send(self):
        """_missed_pongs increments after ping is sent, not before."""
        db = MagicMock(spec=DatabaseManager)
        ws = AsyncMock()
        conn = ClientConnection(ws, db)
        conn.HEARTBEAT_INTERVAL = 0.01
        conn.MAX_MISSED_PONGS = 3
        await conn.start_heartbeat()
        await asyncio.sleep(0.02)
        await conn.stop_heartbeat()
        self.assertLess(conn._missed_pongs, 3)
        self.assertGreater(conn._missed_pongs, 0)


class TestReconnectHeartbeat(unittest.IsolatedAsyncioTestCase):
    async def test_client_connection_start_heartbeat_exists(self):
        """ClientConnection has start_heartbeat method."""
        db = MagicMock(spec=DatabaseManager)
        ws = AsyncMock()
        conn = ClientConnection(ws, db)
        assert hasattr(conn, 'start_heartbeat')
        assert hasattr(conn, 'stop_heartbeat')
        assert hasattr(conn, 'is_stale')
