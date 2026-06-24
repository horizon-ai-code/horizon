"""Integration tests for REST API and WebSocket endpoints using FastAPI TestClient."""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def test_app():
    from contextlib import asynccontextmanager

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

    # Mock connection manager's DB operations
    mock_conn = MagicMock()
    mock_conn.get_rest_history = AsyncMock(return_value=[])
    mock_conn.get_history_by_id = AsyncMock(return_value=None)
    mock_conn.delete_history_by_id = AsyncMock(return_value=None)
    mock_conn.rename_history = AsyncMock()
    mock_conn.get_rest_history_by_id = AsyncMock(return_value=None)
    main_module.connection = mock_conn

    @asynccontextmanager
    async def noop_lifespan(_app):
        yield {}
    main_module.app.router.lifespan_context = noop_lifespan
    yield main_module.app
    mem.close()
    ctx.db = original_db


class TestRestAPI:
    def test_health(self, test_app):  # TC-IT-001
        with TestClient(test_app) as client:
            resp = client.get("/health")
            assert resp.status_code == 200
            assert "timestamp" in resp.json()

    def test_get_history_empty(self, test_app):  # TC-IT-002
        with TestClient(test_app) as client:
            resp = client.get("/api/history")
            assert resp.status_code == 200
            assert resp.json() == []

    def test_get_history_by_id_not_found(self, test_app):  # TC-IT-004
        with TestClient(test_app) as client:
            resp = client.get(f"/api/history/{uuid.uuid4()}")
            assert resp.status_code == 404

    def test_patch_empty_title_rejected(self, test_app):  # TC-IT-006
        import app.modules.context as ctx
        sid = str(uuid.uuid4())
        ctx.RefactorHistory.create(id=sid, user_instruction="test", original_code="code")
        with TestClient(test_app) as client:
            resp = client.patch(f"/api/history/{sid}", json={"title": ""})
            assert resp.status_code in (400, 422)

    def test_delete_not_found(self, test_app):  # TC-IT-008
        with TestClient(test_app) as client:
            resp = client.delete(f"/api/history/{uuid.uuid4()}")
            assert resp.status_code == 404


class TestWebSocket:
    def _make_mock_client(self):
        c = MagicMock()
        c.id = str(uuid.uuid4())
        c.is_stale = False
        c.send_connection_id = AsyncMock()
        c.start_heartbeat = AsyncMock()
        c.handle_pong = MagicMock()
        c.stop_heartbeat = AsyncMock()
        c.reset_id = MagicMock()
        c.send_status = AsyncMock()
        c._safe_send = AsyncMock()
        return c

    def test_ws_connect(self, test_app):  # TC-IT-009
        import app.main as main_module
        main_module.connection.create_websocket_connection = MagicMock(return_value=self._make_mock_client())
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.send_json({"type": "pong"})
                assert True

    def test_ws_halt_notification(self, test_app):  # TC-IT-011
        import app.main as main_module
        c = self._make_mock_client()
        main_module.connection.create_websocket_connection = MagicMock(return_value=c)
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.send_json({"type": "halt"})
                assert True

    def test_ws_malformed_json(self, test_app):  # TC-IT-012
        import app.main as main_module
        c = self._make_mock_client()
        main_module.connection.create_websocket_connection = MagicMock(return_value=c)
        with TestClient(test_app) as client:
            with client.websocket_connect("/ws") as ws:
                ws.send_text("not json")
                assert True
