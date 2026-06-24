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
    original_db = ctx.db
    ctx.db = mem
    yield
    mem.drop_tables([RefactorHistory, OrchestrationLog])
    mem.close()
    ctx.db = original_db


class TestDatabaseManager:
    def test_create_session(self, memory_db):
        sid = str(uuid.uuid4())
        mgr = DatabaseManager()
        mgr.create_session(id=sid, instruction="refactor", original_code="class A {}")
        entry = RefactorHistory.get_by_id(sid)
        assert entry.user_instruction == "refactor"

    def test_get_history_returns_list(self, memory_db):
        mgr = DatabaseManager()
        mgr.create_session(id=str(uuid.uuid4()), instruction="x", original_code="x")
        history = mgr.get_history()
        assert len(history) >= 1

    def test_get_history_by_id_not_found(self, memory_db):
        mgr = DatabaseManager()
        result = mgr.get_history_by_id(str(uuid.uuid4()))
        assert result is None
