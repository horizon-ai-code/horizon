import asyncio
import json
import unittest
import builtins
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

from app.modules.agent_service import AgentService
from app.modules.context_manager import DatabaseManager
from app.modules.orchestrator import Orchestrator
from app.modules.validator import Validator
from app.utils.types import ExitStatus, Role


class MockClient:
    def __init__(self):
        self.id = "test-session"
        self.statuses = []
        self.results = None
        self.insights = None

    @property
    def is_stale(self) -> bool:
        return False

    async def send_status(self, role, content, **kwargs):
        self.statuses.append((role, content))

    async def send_result(self, **kwargs):
        self.results = kwargs

    async def send_insights(self, insights):
        self.insights = insights

    async def send_connection_id(self):
        pass

    def reset_id(self):
        self.id = "test-session"

    async def send_halt_notification(self):
        pass


class TestOrchestratorFlow(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.agent_service = MagicMock(spec=AgentService)
        self.agent_service.generate = AsyncMock()
        self.agent_service.swap = AsyncMock()
        self.agent_service.unload = AsyncMock()
        self.agent_service.clear_context = AsyncMock()

        self.validator = Validator()
        self.db = MagicMock(spec=DatabaseManager)

        self.mock_config = {
            "planner": {"name": "p", "filename": "p"},
            "generator": {"name": "g", "filename": "g"},
            "judge": {"name": "j", "filename": "j"},
        }
        self.mock_prompts = {
             "planner": {
                 "classifier": "c",
                 "architect": "a",
                 "architect_analysis": "an",
                 "analysis_guidance": {"FLATTEN_CONDITIONAL": ""},
                 "synthesis_guidance": {"FLATTEN_CONDITIONAL": ""},
             },
             "generator": {"coder": "co", "coder_guidance": {"FLATTEN_CONDITIONAL": ""}},
             "judge": {"auditor": "au", "insights": "i"},
         }

    @patch("builtins.open")
    @patch("yaml.safe_load")
    async def test_full_success_flow(self, mock_yaml, mock_open):
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        orch = Orchestrator(self.agent_service, self.validator, self.db)

        # Define LLM response sequence
        responses = [
            # Ph2: Classifier
            json.dumps(
                {
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {
                            "class": "A",
                            "member": "m",
                            "unit_type": "METHOD_UNIT",
                        },
                    },
                }
            ),
            # Ph2: Architect Analysis
            json.dumps(
                {
                    "analysis_scratchpad": "t",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }
            ),
            # Ph2: Architect
            json.dumps(
                {
                    "architect_scratchpad": "t",
                    "ast_modification_plan": {"target_class": "A", "ast_mutations": []},
                }
            ),
            # Ph3: Coder (multi-sample: 3 temps)
            "<code>public class A { void m() { } }</code>",
            "<code>public class A { void m() { } }</code>",
            "<code>public class A { void m() { } }</code>",
            # Ph5: Auditor
            json.dumps(
                {
                    "audit_scratchpad": {
                        "variable_trace": [],
                        "logic_comparison": "ok",
                    },
                    "verdict": "ACCEPT",
                    "issues": [],
                }
            ),
            # Ph6: Insights
            json.dumps(
                {"insights": [{"title": "Test", "details": "Refactor look good."}]}
            ),
        ]

        async def mock_gen(messages, **kwargs):
            content = responses.pop(0)
            return {"choices": [{"message": {"content": content}}]}

        self.agent_service.generate.side_effect = mock_gen

        client = MockClient()
        user_code = "public class A { void m() { if(a) { if(b) {} } } }"
        user_instruction = "Flatten it."

        await orch.execute_orchestration(client, user_code, user_instruction)  # type: ignore

        self.assertIsNotNone(client.results)
        self.db.complete_session.assert_called_once()
        # Verify status transitions
        status_msgs = [s[1] for s in client.statuses]
        self.assertTrue(any("Ph1" in m for m in status_msgs))
        self.assertTrue(any("Ph2" in m for m in status_msgs))
        self.assertTrue(any("Ph3" in m for m in status_msgs))
        self.assertTrue(any("Ph4" in m for m in status_msgs))
        self.assertTrue(any("Ph5" in m for m in status_msgs))
        self.assertTrue(any("Ph6" in m for m in status_msgs))

    async def test_architect_split_flow(self):
        """Architect analysis call produces targets list, synthesis produces valid plan."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
                    },
                }),
                json.dumps({
                    "analysis_scratchpad": "Target is method m with nested ifs",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": ["Exception: IllegalArgumentException"],
                }),
                json.dumps({
                    "architect_scratchpad": "Mapping analysis to mutations",
                    "ast_modification_plan": {
                        "target_class": "A",
                        "ast_mutations": [
                            {
                                "action": "MODIFY_METHOD",
                                "target": "m",
                                "details": {
                                    "modifiers": ["public"],
                                    "type": "void",
                                    "parameters": [],
                                    "logic_changes": ["Flatten nested ifs"],
                                    "body_abstract": "Use guard clauses"
                                },
                            }
                        ],
                    },
                }),
                "<code>public class A { void m() { if(!a) throw new IllegalArgumentException(); doWork(); } }</code>",
                "<code>public class A { void m() { if(!a) throw new IllegalArgumentException(); doWork(); } }</code>",
                "<code>public class A { void m() { if(!a) throw new IllegalArgumentException(); doWork(); } }</code>",
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            async def mock_gen(messages, **kwargs):
                content = responses.pop(0)
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "public class A { void m() { if(a) { if(b) { doWork(); } } } }"
            user_instruction = "Flatten it."

            await orch.execute_orchestration(client, user_code, user_instruction)

            self.assertIsNotNone(client.results)
            status_msgs = [s[1] for s in client.statuses]
            self.assertTrue(any("Ph6" in m for m in status_msgs))

    async def test_auditor_gets_plan_context(self):
        """Phase 5 auditor prompt contains plan summary and mutations list."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "OrderProcessor", "member": "processOrder", "unit_type": "METHOD_UNIT"},
                    },
                }),
                json.dumps({
                    "analysis_scratchpad": "Target is processOrder",
                    "primary_targets": ["processOrder"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }),
                json.dumps({
                    "architect_scratchpad": "Plan mutations",
                    "ast_modification_plan": {
                        "target_class": "OrderProcessor",
                        "ast_mutations": [
                            {"action": "MODIFY_METHOD", "target": "processOrder", "details": {"modifiers": ["public"], "type": "void", "parameters": [], "logic_changes": ["Use guard clauses"], "body_abstract": "Linear validations"}},
                        ],
                    },
                }),
                "<code>public class OrderProcessor { public void processOrder() { if(!x) return; if(!y) return; doWork(); } }</code>",
                "<code>public class OrderProcessor { public void processOrder() { if(!x) return; if(!y) return; doWork(); } }</code>",
                "<code>public class OrderProcessor { public void processOrder() { if(!x) return; if(!y) return; doWork(); } }</code>",
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                json.dumps({"insights": [{"title": "T", "details": "D"}]}),
            ]

            captured_prompt = None

            async def mock_gen(messages, **kwargs):
                nonlocal captured_prompt
                content = responses.pop(0)
                if "Plan Context" in str(messages[-1].get("content", "")):
                    captured_prompt = messages[-1].get("content", "")
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "public class OrderProcessor { public void processOrder() { if(x) { if(y) { doWork(); } } } }"
            user_instruction = "Flatten it."

            await orch.execute_orchestration(client, user_code, user_instruction)

            self.assertIsNotNone(captured_prompt, "Auditor prompt should have been captured")
            self.assertIn("Plan Context", captured_prompt)
            self.assertIn("FLATTEN_CONDITIONAL", captured_prompt)
            self.assertIn("OrderProcessor.processOrder", captured_prompt)
            self.assertIn("MODIFY_METHOD", captured_prompt)
            self.assertIn("Mutations:", captured_prompt)

    async def test_judge_double_failure_graceful(self):
        """When judge fails twice, orchestrator loops back to Phase 2 instead of crashing."""
        mock_yaml = MagicMock()
        mock_yaml.side_effect = [self.mock_config, self.mock_prompts]
        mock_open = MagicMock()

        with patch("builtins.open", mock_open), patch("yaml.safe_load", mock_yaml):
            orch = Orchestrator(self.agent_service, self.validator, self.db)

            responses = [
                json.dumps({
                    "classification_scratchpad": "t",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
                    },
                }),
                json.dumps({
                    "analysis_scratchpad": "t",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }),
                json.dumps({
                    "architect_scratchpad": "t",
                    "ast_modification_plan": {"target_class": "A", "ast_mutations": []},
                }),
                # Ph3: Coder (3 temps)
                "<code>public class A { void m() { } }</code>",
                "<code>public class A { void m() { } }</code>",
                "<code>public class A { void m() { } }</code>",
                # Ph5: Judge fails twice
                "NOT VALID JSON",
                "ALSO NOT VALID",
                # Ph2 retry: Classifier
                json.dumps({
                    "classification_scratchpad": "retry",
                    "intent_packet": {
                        "refactor_category": "CONTROL_FLOW",
                        "specific_intent": "FLATTEN_CONDITIONAL",
                        "scope_anchor": {"class": "A", "member": "m", "unit_type": "METHOD_UNIT"},
                    },
                }),
                # Ph2 retry: Architect Analysis
                json.dumps({
                    "analysis_scratchpad": "t",
                    "primary_targets": ["m"],
                    "secondary_targets": [],
                    "new_structures_needed": [],
                    "must_preserve": [],
                }),
                # Ph2 retry: Architect
                json.dumps({
                    "architect_scratchpad": "t",
                    "ast_modification_plan": {"target_class": "A", "ast_mutations": []},
                }),
                # Ph3 retry: Coder (3 temps)
                "<code>public class A { void m() { } }</code>",
                "<code>public class A { void m() { } }</code>",
                "<code>public class A { void m() { } }</code>",
                # Ph5 retry: Judge succeeds
                json.dumps({
                    "audit_scratchpad": {"variable_trace": [], "logic_comparison": "ok"},
                    "verdict": "ACCEPT",
                    "issues": [],
                }),
                # Ph6: Insights
                json.dumps({"insights": [{"title": "Test", "details": "Recovered."}]}),
            ]

            async def mock_gen(messages, **kwargs):
                content = responses.pop(0)
                return {"choices": [{"message": {"content": content}}]}

            self.agent_service.generate.side_effect = mock_gen

            client = MockClient()
            user_code = "public class A { void m() { if(a) { if(b) {} } } }"
            user_instruction = "Flatten it."

            await orch.execute_orchestration(client, user_code, user_instruction)

            self.assertIsNotNone(client.results, "Should produce result after judge retry")
            status_msgs = [s[1] for s in client.statuses]
            self.assertTrue(any("Ph6" in m for m in status_msgs))


class TestConfigLoading(unittest.TestCase):
    def test_config_missing_file_raises(self):
        """Orchestrator raises FileNotFoundError when config file is missing."""
        with patch("builtins.open") as mock_open:
            mock_open.side_effect = FileNotFoundError("No such file")
            with self.assertRaises(FileNotFoundError):
                Orchestrator(MagicMock(), MagicMock(), MagicMock())

    def test_config_empty_file_sets_defaults(self):
        """Empty YAML files produce empty dicts, not None."""
        with patch("builtins.open", mock_open(read_data="")), \
             patch("yaml.safe_load", return_value=None):
            orch = Orchestrator(MagicMock(), MagicMock(), MagicMock())
            self.assertEqual(orch.model_config, {})
            self.assertEqual(orch.prompts, {})


class TestSingleRefactorFlow(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_config = {
            "single": {"name": "qwen-7b", "filename": "qwen-7b"},
            "planner": {"name": "p", "filename": "p"},
            "generator": {"name": "g", "filename": "g"},
            "judge": {"name": "j", "filename": "j"},
        }
        self.mock_prompts = {
            "single": {"coder": "c", "insights": "i"},
            "planner": {
                "classifier": "c",
                "architect": "a",
                "architect_analysis": "an",
                "analysis_guidance": {},
                "synthesis_guidance": {},
            },
            "generator": {"coder": "co", "coder_guidance": {}},
            "judge": {"auditor": "au", "insights": "i"},
        }

    @patch("app.main.agent_service")
    async def test_single_refactor_success(self, mock_agent_service):
        """Single mode: code gen pass 1 + insights pass 2, returns result."""
        from app.main import run_single_refactor, orchestrator

        mock_agent_service.generate = AsyncMock()
        mock_agent_service.swap = AsyncMock()
        mock_agent_service.unload = AsyncMock()
        mock_agent_service.clear_context = AsyncMock()

        # Replace orchestrator's agent_service and db refs with mocks
        original_agent = orchestrator.agent_service
        orchestrator.agent_service = mock_agent_service
        original_db = orchestrator.db
        orchestrator.db = MagicMock()

        # Ensure orchestrator has "single" config/prompts
        orig_config = orchestrator.model_config.copy()
        orig_prompts = orchestrator.prompts.copy()
        orchestrator.model_config = {**orig_config, **self.mock_config}
        orchestrator.prompts = {**orig_prompts, **self.mock_prompts}

        responses = [
            "<code>class A { void m() { return 42; } }</code>",
            json.dumps(
                {
                    "insights": [
                        {
                            "title": "Inlined",
                            "details": "Replaced variable with literal.",
                        }
                    ]
                }
            ),
        ]

        async def mock_gen(messages, **kwargs):
            content = responses.pop(0)
            return {"choices": [{"message": {"content": content}}]}

        mock_agent_service.generate.side_effect = mock_gen

        client = MockClient()
        user_code = "class A { void m() { int x = 42; return x; } }"
        user_instruction = "Inline the variable"

        await run_single_refactor(client, user_code, user_instruction)

        orchestrator.agent_service = original_agent
        orchestrator.db = original_db
        orchestrator.model_config = orig_config
        orchestrator.prompts = orig_prompts

        self.assertIsNotNone(client.results)
        self.assertEqual(client.results["exit_status"], "SUCCESS")
        self.assertIsNotNone(client.insights)
        self.assertEqual(len(client.insights), 1)
        self.assertEqual(client.insights[0]["title"], "Inlined")


if __name__ == "__main__":
    unittest.main()
