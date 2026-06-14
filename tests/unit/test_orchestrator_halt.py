import unittest
import asyncio
import json
from unittest.mock import MagicMock, AsyncMock, patch
from app.modules.orchestrator import Orchestrator, OrchestrationState
from app.utils.types import Role

class TestOrchestratorHalt(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.agent_service = MagicMock()
        self.agent_service.swap = AsyncMock()
        self.agent_service.generate = AsyncMock()
        self.agent_service.unload = AsyncMock()
        self.agent_service.clear_context = AsyncMock()
        
        self.validator = MagicMock()
        self.db = MagicMock()
        
        self.client = MagicMock()
        self.client.id = "test-session-id"
        self.client.send_status = AsyncMock()
        self.client.send_result = AsyncMock()
        
        # Mocking model_config and prompts loading
        self.mock_config = {
            "planner": {"filename": "p", "name": "p"},
            "generator": {"filename": "g", "name": "g"},
            "judge": {"filename": "j", "name": "j"}
        }
        self.mock_prompts = {
            "planner": {"classifier": "c", "architect": "a"},
            "generator": {"coder": "co"},
            "judge": {"auditor": "au", "insights": "i"}
        }

    @patch("builtins.open")
    @patch("yaml.safe_load")
    async def test_execute_orchestration_handles_cancellation(self, mock_yaml, mock_open):
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        orchestrator = Orchestrator(self.agent_service, self.validator, self.db)
        
        # Force asyncio.CancelledError during the first baseline phase notification
        # (Or any point early in the execution)
        self.validator.get_complexity.side_effect = asyncio.CancelledError()
        
        with self.assertRaises(asyncio.CancelledError):
            await orchestrator.execute_orchestration(self.client, "public class Test {}", "Refactor.")
            
        self.db.mark_as_halted.assert_called_once_with(self.client.id)
        self.agent_service.unload.assert_called_once()

    @patch("builtins.open")
    @patch("yaml.safe_load")
    async def test_execute_orchestration_unloads_on_error(self, mock_yaml, mock_open):
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        orchestrator = Orchestrator(self.agent_service, self.validator, self.db)
        
        self.validator.get_complexity.side_effect = ValueError("Fatal Error")
        
        with self.assertRaises(ValueError):
            await orchestrator.execute_orchestration(self.client, "public class Test {}", "Refactor.")
            
        self.client.send_status.assert_any_call(role=Role.System, content="Error: Fatal Error")
        self.agent_service.unload.assert_called_once()

    async def test_cleanup_zombie_sessions(self):
        """Sessions stuck in Processing get marked as Zombie after timeout."""
        from datetime import datetime, timedelta
        from app.modules.context_manager import DatabaseManager, RefactorHistory, db as test_db
        import uuid

        mgr = DatabaseManager()
        zombie_id = str(uuid.uuid4())
        with test_db.atomic():
            RefactorHistory.create(
                id=zombie_id,
                status="Processing",
                user_instruction="zombie",
                original_code="class A {}",
                created_at=datetime.now() - timedelta(days=1),
            )

        try:
            cleaned = mgr.cleanup_zombie_sessions(max_age_hours=1)
            assert cleaned >= 1, f"Expected >=1 cleaned, got {cleaned}"
            record = RefactorHistory.get(RefactorHistory.id == zombie_id)
            assert record.status == "Zombie", f"Expected Zombie, got {record.status}"
            assert record.exit_status == "ABORT_SYSTEM"
        finally:
            try:
                record = RefactorHistory.get(RefactorHistory.id == zombie_id)
                record.delete_instance()
            except RefactorHistory.DoesNotExist:
                pass

    async def test_reconnect_processing_after_restart_returns_error(self):
        """When backend restarts and session is Processing, reconnect returns error not fake status."""
        from app.main import connection, orchestrator, _handle_reconnect

        # Simulate restart: orchestrator.current_client is None
        orchestrator.current_client = None

        mock_ws = AsyncMock()
        mock_ws.send_json = AsyncMock()
        connection.get_history_by_id = AsyncMock(return_value={
            "status": "Processing",
            "refactored_code": None,
            "original_complexity": None,
            "refactored_complexity": None,
            "avg_gpu_utilization": 0,
            "avg_gpu_memory": 0,
            "avg_gpu_memory_used": 0,
            "inference_time": 0,
            "exit_status": None,
            "insights": None,
        })

        await _handle_reconnect("test-session-id", mock_ws)

        calls = [call.args[0] for call in mock_ws.send_json.call_args_list]
        status_calls = [c for c in calls if c.get("type") == "status"]
        self.assertTrue(
            any("Session lost" in c.get("content", "") for c in status_calls),
            "Should tell user the session was lost, not promise live updates",
        )

if __name__ == "__main__":
    unittest.main()
