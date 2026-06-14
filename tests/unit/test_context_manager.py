import unittest
import uuid
import peewee
from unittest.mock import patch

# Create an in-memory database for testing
test_db = peewee.SqliteDatabase(':memory:')

# Mock DB_PATH and the global db instance in context_manager
with patch('app.modules.context_manager.db', test_db):
    from app.modules.context_manager import DatabaseManager, RefactorHistory, OrchestrationLog

class TestContextManager(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Bind models to the test database
        RefactorHistory._meta.database = test_db
        OrchestrationLog._meta.database = test_db
        test_db.connect(reuse_if_open=True)
        test_db.create_tables([RefactorHistory, OrchestrationLog], safe=True)

    def setUp(self):
        self.db_manager = DatabaseManager()
        # Ensure we start with a clean slate for each test
        RefactorHistory.delete().execute()
        OrchestrationLog.delete().execute()

    def test_session_creation_with_new_fields(self):
        """Test that a session is created with all new schema fields."""
        session_id = str(uuid.uuid4())
        self.db_manager.create_session(session_id, "test instruction", "public class A {}")
        
        session = RefactorHistory.get(RefactorHistory.id == session_id)
        self.assertEqual(session.status, "Processing")
        self.assertEqual(session.user_instruction, "test instruction")
        # Check that new fields exist (initially None/0)
        self.assertIsNone(session.exit_status)
        self.assertEqual(session.total_outer_loops, 0)

    def test_log_status_expanded(self):
        """Test the expanded log_status method with phase and loop counters."""
        session_id = str(uuid.uuid4())
        self.db_manager.create_session(session_id, "instruction", "code")
        
        self.db_manager.log_status(
            session_id=session_id,
            role="Planner",
            status="Step 1",
            content="Some JSON",
            phase=2,
            outer_loop=1,
            inner_loop=0
        )
        
        log = OrchestrationLog.get(OrchestrationLog.session == session_id)
        self.assertEqual(log.role, "Planner")
        self.assertEqual(log.phase, 2)
        self.assertEqual(log.outer_loop, 1)
        self.assertEqual(log.content, "Some JSON")

    def test_complete_session_full(self):
        """Test complete_session with all metadata and telemetry."""
        session_id = str(uuid.uuid4())
        self.db_manager.create_session(session_id, "instruction", "code")
        
        metrics = {
            "avg_gpu_utilization": 50.0,
            "avg_gpu_memory": 8000.0,
            "avg_gpu_memory_used": 4000.0,
            "inference_time": 12.5
        }
        
        self.db_manager.complete_session(
            id=session_id,
            refactored_code="new code",
            insights="great refactor",
            original_complexity=5,
            refactored_complexity=3,
            performance_metrics=metrics,
            exit_status="SUCCESS",
            final_intent='{"intent": "FLATTEN"}',
            outer_loops=2,
            inner_loops=1,
            planner_model="Model A"
        )
        
        session = RefactorHistory.get(RefactorHistory.id == session_id)
        self.assertEqual(session.status, "Completed")
        self.assertEqual(session.exit_status, "SUCCESS")
        self.assertEqual(session.total_outer_loops, 2)
        self.assertEqual(session.avg_gpu_utilization, 50.0)
        self.assertEqual(session.final_intent, '{"intent": "FLATTEN"}')

if __name__ == '__main__':
    unittest.main()
