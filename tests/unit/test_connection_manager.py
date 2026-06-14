import unittest
from unittest.mock import AsyncMock, MagicMock
from app.modules.connection_manager import ClientConnection
from app.utils.types import Role

class TestConnectionManager(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_websocket = AsyncMock()
        self.mock_db = MagicMock()
        self.client_connection = ClientConnection(self.mock_websocket, self.mock_db)

    async def test_send_halt_notification(self):
        """Test that send_halt_notification sends the correct message through WebSocket."""
        # 1. Action: Call the new method (which doesn't exist yet)
        await self.client_connection.send_halt_notification()

        # 2. Verification: Check that send_json was called with the expected payload
        expected_message = {
            "type": "status",
            "role": Role.System,
            "content": "Orchestration halted by user."
        }
        self.mock_websocket.send_json.assert_awaited_once_with(expected_message)

    async def test_send_result(self):
        """Test that send_result sends model names through WebSocket."""
        await self.client_connection.send_result(
            final_code="code",
            original_complexity=10,
            refactored_complexity=5,
            performance_metrics={},
            planner_model="Planner Model",
            generator_model="Generator Model",
            judge_model="Judge Model"
        )

        expected_message = {
            "type": "result",
            "id": self.client_connection.id,
            "code": "code",
            "exit_status": "SUCCESS",
            "original_complexity": 10,
            "refactored_complexity": 5,
            "performance": {},
            "planner_model": "Planner Model",
            "generator_model": "Generator Model",
            "judge_model": "Judge Model"
        }
        self.mock_websocket.send_json.assert_awaited_with(expected_message)

if __name__ == '__main__':
    unittest.main()
