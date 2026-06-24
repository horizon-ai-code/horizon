"""Tests for DatabaseManager — SQLite CRUD using UUID IDs."""

import uuid

import pytest
from peewee import SqliteDatabase

from app.modules.context import DatabaseManager, OrchestrationLog, RefactorHistory


@pytest.fixture(autouse=True)
def memory_db():
    import app.modules.context as ctx
    mem = SqliteDatabase(":memory:")
    mem.bind([RefactorHistory, OrchestrationLog], bind_refs=False, bind_backrefs=False)
    mem.connect()
    mem.create_tables([RefactorHistory, OrchestrationLog])
    original = ctx.db
    ctx.db = mem
    yield
    mem.drop_tables([RefactorHistory, OrchestrationLog])
    mem.close()
    ctx.db = original


class TestDatabaseManager:
    def test_create_session(self, memory_db):  # TC-DB-001
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="refactor", original_code="class A {}")
        entry = RefactorHistory.get_by_id(sid)
        assert entry.user_instruction == "refactor"

    def test_complete_session(self, memory_db):  # TC-DB-002
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="test", original_code="a")
        mgr.complete_session(
            id=sid, refactored_code="b", insights="{}",
            original_complexity=5, refactored_complexity=3,
            performance_metrics={}, exit_status="SUCCESS",
        )
        entry = RefactorHistory.get_by_id(sid)
        assert entry.exit_status == "SUCCESS"

    def test_log_status(self, memory_db):  # TC-DB-003
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="x", original_code="x")
        mgr.log_status(session_id=sid, role="Planner", status="planning", content="Analyzing code")
        logs = list(OrchestrationLog.select().where(OrchestrationLog.session == sid))
        assert len(logs) == 1

    def test_mark_as_halted(self, memory_db):  # TC-DB-004
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="x", original_code="x")
        mgr.mark_as_halted(sid)
        entry = RefactorHistory.get_by_id(sid)
        assert entry.status == "Halted"

    def test_get_history_returns_list(self, memory_db):  # TC-DB-005
        mgr = DatabaseManager()
        mgr.create_session(id=str(uuid.uuid4()), instruction="x", original_code="x")
        history = mgr.get_history()
        assert len(history) >= 1

    def test_get_history_by_id_with_details(self, memory_db):  # TC-DB-006
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="test", original_code="code")
        mgr.log_status(session_id=sid, role="Planner", status="analyzing", content="Analyzing code")
        mgr.log_status(session_id=sid, role="Generator", status="generating", content="Generated output")
        detail = mgr.get_history_by_id(sid)
        assert detail is not None
        assert len(detail.get("logs", [])) == 2

    def test_get_history_by_id_not_found(self, memory_db):  # TC-DB-007
        mgr = DatabaseManager()
        result = mgr.get_history_by_id(str(uuid.uuid4()))
        assert result is None

    def test_rename_session(self, memory_db):  # TC-DB-008
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="x", original_code="x")
        mgr.rename_session(sid, "New Title")
        entry = RefactorHistory.get_by_id(sid)
        assert entry.title == "New Title"

    def test_delete_history_by_id(self, memory_db):  # TC-DB-011
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="x", original_code="x")
        mgr.delete_history_by_id(sid)
        with pytest.raises(RefactorHistory.DoesNotExist):
            RefactorHistory.get_by_id(sid)
