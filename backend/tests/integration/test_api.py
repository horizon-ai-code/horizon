"""Integration tests for REST API endpoints using FastAPI TestClient.

WebSocket endpoint behaviors (heartbeat, halt, reconnect) are covered
in unit tests (test_connection.py, test_router.py) and do not require
integration-level testing.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def test_app():
    from contextlib import asynccontextmanager

    # Fresh mock db to avoid cross-test contamination from cached modules
    import peewee
    mem = peewee.SqliteDatabase(":memory:")

    import app.modules.context as ctx
    mem.bind([ctx.RefactorHistory, ctx.OrchestrationLog])
    mem.connect()
    mem.create_tables([ctx.RefactorHistory, ctx.OrchestrationLog])
    original_db = ctx.db
    ctx.db = mem

    import app.main as main_module
    main_module.db = mem

    # Mock connection manager
    mock_conn = MagicMock()
    mock_conn.get_rest_history = AsyncMock(return_value=[])
    mock_conn.get_history_by_id = AsyncMock(return_value=None)
    mock_conn.delete_history_by_id = AsyncMock(return_value=None)
    mock_conn.rename_history = AsyncMock()
    main_module.connection = mock_conn

    @asynccontextmanager
    async def noop_lifespan(_app):
        yield {}
    main_module.app.router.lifespan_context = noop_lifespan
    yield main_module.app
    mem.close()
    ctx.db = original_db


class TestRestAPI:
    def test_health(self, test_app):
        with TestClient(test_app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert "timestamp" in resp.json()

    def test_get_history_empty(self, test_app):
        with TestClient(test_app) as client:
            resp = client.get("/api/history")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_get_history_by_id_not_found(self, test_app):
        with TestClient(test_app) as client:
            resp = client.get(f"/api/history/{uuid.uuid4()}")
            assert resp.status_code == 404

    def test_delete_not_found(self, test_app):
        with TestClient(test_app) as client:
            resp = client.delete(f"/api/history/{uuid.uuid4()}")
            assert resp.status_code == 404
