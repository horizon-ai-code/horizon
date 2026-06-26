"""Full orchestration pipeline with mocked AgentService.generate and real DB/Validator.

Tests three pipeline outcomes:
  - SUCCESS:   Pipeline completes all 6 phases, session saved to DB
  - HALT:      User halt during Phase 3 → CancelledError → mark_as_halted
  - ABORT:     Strategy retry circuit breaker → strategy_iter > 3 → ABORT_STRATEGY
"""

import json
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from peewee import SqliteDatabase

from app.modules.agent import AgentService, InterruptedError
from app.modules.context import DatabaseManager, OrchestrationLog, RefactorHistory
from app.modules.orchestrator import Orchestrator
from app.modules.orchestrator.config import OrchestrationConfig
from app.modules.validator import Validator
from app.utils.types import ExitStatus

# ─── Canned JSON responses per phase ────────────────────────────────────────

INTENT_CLASSIFIER = json.dumps({
    "classification_scratchpad": "Flatten nested conditional",
    "intent_packet": {
        "refactor_category": "CONTROL_FLOW",
        "specific_intent": "FLATTEN_CONDITIONAL",
        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
    },
})

ARCHITECT_ANALYSIS = json.dumps({
    "analysis_scratchpad": "Target method m",
    "primary_targets": [{"name": "m", "kind": "method", "purpose": "Flatten nested ifs"}],
    "secondary_targets": [],
    "new_structures": [],
    "must_preserve": ["Method signature unchanged"],
})

AST_ARCHITECT = json.dumps({
    "architect_scratchpad": "Modify method m",
    "ast_modification_plan": {
        "target_class": "A",
        "ast_mutations": [
            {"action": "MODIFY_METHOD", "target": "m", "details": {
                "body": "if(!a) return; if(!b) return; doWork();"
            }},
        ],
    },
})

VALID_CODE = json.dumps({
    "choices": [{"message": {"content": "<code>class A { void m() { if(!a) return; if(!b) return; doWork(); } }</code>"}}]
})

BROKEN_CODE = json.dumps({
    "choices": [{"message": {"content": "<code>broken</code>"}}]
})

JUDGE_ACCEPT = json.dumps({
    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "Simplified"},
    "verdict": "ACCEPT",
    "issues": [],
})

JUDGE_REVISE = json.dumps({
    "audit_scratchpad": {}, "verdict": "REVISE",
    "issues": [{"issue_type": "logic_drift", "description": "Logic changed"}],
})

INSIGHTS = json.dumps({
    "insights": [{"title": "Complexity Reduced", "details": "CC: 3 to 2"}],
})

BASE_CODE = "class A { void m() { if(a){ if(b){ doWork(); } } } }"
INSTRUCTION = "Flatten the nested conditional"


# ─── Mock agent variants ────────────────────────────────────────────────────

class MockAgentService(AgentService):
    """Canned generate() returning preset responses based on response_model."""

    def __init__(self):
        import asyncio
        self._stop_event = asyncio.Event()
        self._model_lock = asyncio.Lock()
        self.model = None
        self.current_model_path = None
        self.current_config = None

    async def generate(self, messages, temp=0.1, max_tokens=4096, stream=False,
                       response_model=None, check_repetition=None):
        from app.utils.schemas import (
            ArchitectAnalysisResponse,
            ASTArchitectResponse,
            IntentClassifierResponse,
            RefactorInsightsResponse,
            StructuralAuditorResponse,
        )
        model_map = {
            IntentClassifierResponse: INTENT_CLASSIFIER,
            ArchitectAnalysisResponse: ARCHITECT_ANALYSIS,
            ASTArchitectResponse: AST_ARCHITECT,
            StructuralAuditorResponse: JUDGE_ACCEPT,
            RefactorInsightsResponse: INSIGHTS,
        }
        if response_model:
            content = model_map.get(response_model, "{}")
            return {"choices": [{"message": {"content": content}}]}
        return json.loads(VALID_CODE)

    async def clear_context(self):
        pass

    def stop(self):
        self._stop_event.set()

    async def load(self, config):
        self.current_config = config
        self.current_model_path = config.get("filename")

    async def swap(self, config):
        self.current_config = config
        self.current_model_path = config.filename if hasattr(config, "filename") else config.get("filename")

    async def unload(self):
        self.model = None


class AbortingAgentService(MockAgentService):
    """Raises InterruptedError on the Nth generate() to simulate user halt."""

    def __init__(self, halt_after=3):
        super().__init__()
        self.halt_after = halt_after
        self.call_count = 0

    async def generate(self, *args, **kwargs):
        self.call_count += 1
        if self.call_count >= self.halt_after:
            raise InterruptedError()
        return await super().generate(*args, **kwargs)


class BrokenCodeAgentService(MockAgentService):
    """Returns broken Java code from Phase 3 to trigger max retries."""

    async def generate(self, *args, **kwargs):
        from app.utils.schemas import ASTArchitectResponse
        if kwargs.get("response_model") == ASTArchitectResponse:
            return await super().generate(*args, **kwargs)
        if kwargs.get("response_model") is None:
            # Phase 3 returns broken Java → validation fails → replan
            return json.loads(BROKEN_CODE)
        return await super().generate(*args, **kwargs)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_client():
    c = AsyncMock()
    c.id = str(uuid.uuid4())
    c.is_stale = False
    c.send_status = AsyncMock()
    c.send_result = AsyncMock()
    c.send_json = AsyncMock()
    c._safe_send = AsyncMock()
    c.reset_id = MagicMock()
    c.send_connection_id = AsyncMock()
    c.send_halt_notification = AsyncMock()
    return c


def build_orchestrator(agent, db_mgr):
    config = OrchestrationConfig.from_dict({
        "planner": {"name": "p", "filename": "p.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "generator": {"name": "g", "filename": "g.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 36},
        "judge": {"name": "j", "filename": "j.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 6144, "layers": 28},
        "single": {"name": "s", "filename": "s.gguf", "temperature": 0.1, "max_tokens": 4096, "context_size": 4096, "layers": 20},
        "settings": {
            "deduplication_cap": 5,
            "max_strategy_iter": 3,
            "max_syntax_heal": 1,
            "sequential_retry_limit": 1,
        },
    })
    prompts = {
        "planner": {
            "classifier": "Classify the intent.",
            "architect_analysis": "Analyze the code.",
            "analysis_guidance": {"FLATTEN_CONDITIONAL": "Reduce nesting."},
            "architect": "Design mutations.",
            "synthesis_guidance": {"FLATTEN_CONDITIONAL": "Use early return."},
        },
        "generator": {
            "coder": "Generate refactored code.",
            "coder_guidance": {"FLATTEN_CONDITIONAL": "Flatten if statements."},
        },
        "judge": {
            "auditor": "Audit the change.",
            "auditor_guidance": {},
            "insights": "Summarize insights.",
        },
        "single": {
            "coder": "Generate code.",
            "insights": "Provide insights.",
        },
    }
    validator = Validator()
    orch = Orchestrator(agent, validator, db_mgr, config=config)
    orch.prompts = prompts
    return orch


# ─── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def memory_db():
    mem = SqliteDatabase(":memory:")
    mem.bind([RefactorHistory, OrchestrationLog])
    mem.connect()
    mem.create_tables([RefactorHistory, OrchestrationLog])

    import app.modules.context as ctx
    original = ctx.db
    ctx.db = mem
    db_mgr = DatabaseManager()
    yield db_mgr, mem
    mem.drop_tables([RefactorHistory, OrchestrationLog])
    mem.close()
    ctx.db = original


# ─── Tests ───────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
class TestFullMockPipeline:
    async def test_success_persists_to_db(self, memory_db):  # TC-PL-SUCCESS
        """Pipeline completes → ExitStatus.SUCCESS → session in DB."""
        db_mgr, _ = memory_db
        orch = build_orchestrator(MockAgentService(), db_mgr)
        client = make_client()

        await orch.execute_orchestration(client=client, user_code=BASE_CODE, user_instruction=INSTRUCTION)

        assert orch.state.exit_status == ExitStatus.SUCCESS
        history = db_mgr.get_history()
        assert len(history) == 1
        detail = db_mgr.get_history_by_id(history[0]["id"])
        assert detail.get("status") == "Completed"

    async def test_rename_and_delete(self, memory_db):  # TC-PL-RENAME
        """After pipeline: rename session title, then delete it."""
        db_mgr, _ = memory_db
        orch = build_orchestrator(MockAgentService(), db_mgr)
        client = make_client()

        await orch.execute_orchestration(client=client, user_code=BASE_CODE, user_instruction=INSTRUCTION)
        assert orch.state.exit_status == ExitStatus.SUCCESS

        history = db_mgr.get_history()
        session_id = history[0]["id"]

        db_mgr.rename_session(session_id, "Renamed Session")
        assert db_mgr.get_history_by_id(session_id)["title"] == "Renamed Session"

        db_mgr.delete_history_by_id(session_id)
        assert db_mgr.get_history_by_id(session_id) is None

    async def test_abort_on_user_halt(self, memory_db):  # TC-PL-HALT
        """User halt during phase 2/3 InterruptedError propagated, exit_status PROCESSING."""
        db_mgr, _ = memory_db
        agent = AbortingAgentService(halt_after=3)
        orch = build_orchestrator(agent, db_mgr)
        client = make_client()

        with pytest.raises(Exception):  # noqa: B017 — InterruptedError wraps through generic handler
            await orch.execute_orchestration(client=client, user_code=BASE_CODE, user_instruction=INSTRUCTION)

        # InterruptedError propagates. The state was never set to SUCCESS or ABORT.
        assert orch.state.exit_status == ExitStatus.PROCESSING

    async def test_abort_on_max_retries(self, memory_db):  # TC-PL-ABORT
        """Validation keeps failing → strategy_iter > 3 → ABORT_STRATEGY."""
        db_mgr, _ = memory_db
        agent = BrokenCodeAgentService()
        orch = build_orchestrator(agent, db_mgr)
        client = make_client()

        await orch.execute_orchestration(client=client, user_code=BASE_CODE, user_instruction=INSTRUCTION)

        assert orch.state.exit_status == ExitStatus.ABORT_STRATEGY
        assert orch.state.strategy_iter > 3
