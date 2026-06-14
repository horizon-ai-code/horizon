import asyncio
import json
import time
import unittest
from unittest.mock import AsyncMock, patch, MagicMock

from fastapi.testclient import TestClient
from app.main import app
from app.utils.types import Role


class TestMainHalt(unittest.IsolatedAsyncioTestCase):

    async def test_halt_cancels_active_task(self):
        """
        Tests that sending a 'halt' message through WebSocket cancels the 
        active orchestration task.
        """
        async def slow_orchestration(*args, **kwargs):
            try:
                await asyncio.sleep(5)
            except asyncio.CancelledError:
                raise

        with patch("app.main.orchestrator.execute_orchestration", new_callable=AsyncMock) as mock_execute:
            mock_execute.side_effect = slow_orchestration

            client = TestClient(app)
            with client.websocket_connect("/ws") as websocket:
                websocket.send_json({
                    "code": "public class Test {}",
                    "user_instruction": "Refactor this."
                })

                websocket.send_json({"type": "halt"})

                messages = []
                halt_found = False
                timeout = 3.0
                start = time.time()
                while time.time() - start < timeout:
                    try:
                        msg = websocket.receive_json()
                        messages.append(msg)
                        if msg.get("type") == "status" and "halted" in msg.get("content", "").lower():
                            halt_found = True
                            break
                    except Exception:
                        break

                self.assertTrue(halt_found, f"Halt notification not found in messages: {messages}")

    async def test_normal_orchestration_success(self):
        """
        Tests that normal orchestration still works after the refactor.
        """
        async def fast_orchestration(*args, **kwargs):
            # Simulate a successful orchestration
            pass

        with patch("app.main.orchestrator.execute_orchestration", new_callable=AsyncMock) as mock_execute:
            mock_execute.side_effect = fast_orchestration
            
            client = TestClient(app)
            with client.websocket_connect("/ws") as websocket:
                websocket.send_json({
                    "code": "public class Test {}",
                    "user_instruction": "Refactor this."
                })
                
                # Receive messages. We expect connection_id and potentially status if lock was checked.
                # Since mock is fast, we just wait for it to finish.
                # In main.py, it's a background task, so we might need to wait a tiny bit.
                await asyncio.sleep(0.1)
                
                mock_execute.assert_called_once()

if __name__ == "__main__":
    unittest.main()
