"""Shared fixtures for all backend tests."""

from unittest.mock import AsyncMock, MagicMock

import pytest


@pytest.fixture
def mock_agent():
    """Returns an AsyncMock AgentService with configurable generate()."""
    agent = AsyncMock()
    agent.generate = AsyncMock(return_value={"choices": [{"message": {"content": "{}"}}]})
    agent.stop = AsyncMock()
    agent.load = MagicMock()
    agent.unload = MagicMock()
    return agent


@pytest.fixture
def mock_db():
    """Returns a MagicMock DatabaseManager."""
    db = MagicMock()
    db.create_session = MagicMock(return_value=1)
    db.complete_session = MagicMock()
    db.log_status = MagicMock()
    db.mark_as_halted = MagicMock()
    db.get_history = MagicMock(return_value=[])
    db.get_history_by_id = MagicMock(return_value=None)
    db.rename_session = MagicMock()
    db.delete_history_by_id = MagicMock()
    return db


@pytest.fixture
def mock_client():
    """Returns an AsyncMock ClientConnection with preset ID."""
    client = AsyncMock()
    client.id = "test-session-123"
    client.is_stale = False
    client.send_status = AsyncMock()
    client.send_result = AsyncMock()
    client.send_json = AsyncMock()
    client.send_halt_notification = AsyncMock()
    client.handle_pong = MagicMock()
    return client


@pytest.fixture
def valid_code():
    return "class A { void m() { if(x) { doWork(); } } }"


@pytest.fixture
def valid_code_simple():
    return "class A { int x; }"


@pytest.fixture
def model_config():
    from app.modules.orchestrator.config import OrchestrationConfig
    return OrchestrationConfig.from_dict({
        "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "generator": {"name": "g", "filename": "g.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "judge": {"name": "j", "filename": "j.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 28},
        "single": {"name": "s", "filename": "s.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 4096, "layers": 20},
        "settings": {"deduplication_cap": 5, "max_strategy_iter": 3, "max_syntax_heal": 3, "sequential_retry_limit": 1},
    })


@pytest.fixture
def prompt_config():
    return {
        "planner": {
            "classifier": "Classify.",
            "architect_analysis": "Analyze.",
            "analysis_guidance": {"FLATTEN_CONDITIONAL": "Reduce."},
            "architect": "Design.",
            "synthesis_guidance": {"FLATTEN_CONDITIONAL": "Use early return."},
        },
        "generator": {"coder": "Generate code.", "coder_guidance": {"FLATTEN_CONDITIONAL": "Flatten."}},
        "judge": {"auditor": "Audit.", "auditor_guidance": {}, "insights": "Provide insights."},
        "single": {"coder": "Generate.", "insights": "Provide insights."},
    }
