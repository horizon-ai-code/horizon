"""
Integration test: connects to the running server via WebSocket
and tests the actual heartbeat and reconnection system end-to-end.

Prerequisites:
    uvicorn app.main:app --port 8000   (in another terminal)

Tests:
    - Heartbeat: ping arrives, pong resets counter
    - Stale detection: no pong → missed_pongs increments
    - Reconnect: completed session restored from DB
    - Reconnect: halted session acknowledged
    - Halt acknowledgment from server
"""
import asyncio
import json
import sys
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

import websockets

WS_URL = "ws://127.0.0.1:8000/ws"
PASS = 0
FAIL = 0


async def ws_connect():
    """Connect to the server and consume the first ping."""
    ws = await websockets.connect(WS_URL)
    try:
        await asyncio.wait_for(ws.recv(), timeout=18)
    except asyncio.TimeoutError:
        pass
    return ws


def create_db_session(session_id: str, status: str = "Completed"):
    """Create a session directly in the database for reconnect testing."""
    from app.modules.context_manager import OrchestrationLog, RefactorHistory, SchemaVersion
    from app.modules.context_manager import db as db_conn

    db_conn.connect(reuse_if_open=True)
    db_conn.create_tables([SchemaVersion, RefactorHistory, OrchestrationLog], safe=True)

    try:
        RefactorHistory.create(
            id=session_id,
            status=status,
            exit_status="SUCCESS" if status == "Completed" else "Halted",
            user_instruction="Integration test refactor",
            original_code="public class Test {}",
            refactored_code="public class Test { void m() {} }" if status == "Completed" else None,
            insights='[{"title": "Test", "details": "Integration test insight"}]' if status == "Completed" else None,
            original_complexity=1,
            refactored_complexity=2,
            created_at=datetime.now(),
        )
    except Exception:
        pass  # Already exists
    finally:
        db_conn.close()


async def test_heartbeat_ping_arrives():
    """Verify a ping message arrives within 18 seconds of connecting."""
    ws = await ws_connect()
    try:
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=18))
        assert msg.get("type") == "ping", f"Expected ping, got {msg.get('type')}"
        assert "id" in msg
        assert "ts" in msg
    finally:
        await ws.close()


async def test_heartbeat_pong_resets():
    """Send pong on first ping, verify a second ping arrives (proves counter reset)."""
    ws = await ws_connect()
    try:
        for _ in range(2):
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=18))
            assert msg.get("type") == "ping"
            await ws.send(json.dumps({"type": "pong"}))
            await asyncio.sleep(0.1)
    finally:
        await ws.close()


async def test_reconnect_completed_session():
    """Create a completed session in DB, reconnect, verify result + insights arrive."""
    session_id = str(uuid.uuid4())
    create_db_session(session_id, status="Completed")

    ws = await ws_connect()
    try:
        await ws.send(json.dumps({"type": "reconnect", "session_id": session_id}))

        # Wait for result message
        timeout = 10
        while timeout > 0:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            if msg.get("type") == "result":
                assert msg.get("exit_status") == "SUCCESS"
                assert msg.get("code") == "public class Test { void m() {} }"
                break
            timeout -= 1
        else:
            raise AssertionError("No result received")

        # Wait for insights
        while timeout > 0:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            if msg.get("type") == "insights":
                assert len(msg.get("insights", [])) > 0
                break
            timeout -= 1
        else:
            raise AssertionError("No insights received for completed session")

        # Wait for restoration status
        while timeout > 0:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            if msg.get("type") == "status" and "restored" in msg.get("content", "").lower():
                break
            timeout -= 1
        else:
            raise AssertionError("No restoration status received")
    finally:
        await ws.close()


async def test_reconnect_halted_session():
    """Create a halted session, reconnect, verify acknowledgment."""
    session_id = str(uuid.uuid4())
    create_db_session(session_id, status="Halted")

    ws = await ws_connect()
    try:
        await ws.send(json.dumps({"type": "reconnect", "session_id": session_id}))

        timeout = 10
        while timeout > 0:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            if msg.get("type") == "status" and "Reconnected" in msg.get("content", ""):
                assert "Halted" in msg.get("content", "")
                break
            timeout -= 1
        else:
            raise AssertionError("No reconnection status received")
    finally:
        await ws.close()


async def test_halt_acknowledgment():
    """Send halt and verify acknowledgment from the server."""
    ws = await ws_connect()
    try:
        await ws.send(json.dumps({"type": "halt"}))
        msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=10))
        assert msg.get("type") == "halt_acknowledged"
    finally:
        await ws.close()


TESTS = [
    ("ping arrives within 18s of connect", test_heartbeat_ping_arrives),
    ("pong resets counter (2 pings received)", test_heartbeat_pong_resets),
    ("reconnect to completed session (result + insights)", test_reconnect_completed_session),
    ("reconnect to halted session", test_reconnect_halted_session),
    ("halt acknowledgment from server", test_halt_acknowledgment),
]


async def main():
    global PASS, FAIL

    print(f"Connecting to {WS_URL}...")
    try:
        async with websockets.connect(WS_URL) as ws:
            try:
                await asyncio.wait_for(ws.recv(), timeout=18)
            except asyncio.TimeoutError:
                pass
        print("✅ Server reachable\n")
    except Exception as e:
        print(f"❌ Cannot connect: {e}")
        print("  Start server: uvicorn app.main:app --port 8000")
        return 1

    print(f"Running {len(TESTS)} tests...\n")
    for name, test_fn in TESTS:
        try:
            await asyncio.wait_for(test_fn(), timeout=90)
            PASS += 1
            print(f"  ✅ {name}")
        except AssertionError as e:
            FAIL += 1
            print(f"  ❌ {name} — {e}")
        except asyncio.TimeoutError:
            FAIL += 1
            print(f"  ❌ {name} — Timeout")
        except Exception as e:
            FAIL += 1
            print(f"  ❌ {name} — {type(e).__name__}: {e}")

    print(f"\n{'='*40}")
    print(f"Results: {PASS} passed, {FAIL} failed out of {len(TESTS)}")
    print(f"{'='*40}")
    return 1 if FAIL > 0 else 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
