import asyncio
import json
import re
import time as _time
from typing import Any

import javalang
import yaml
from llama_cpp import ChatCompletionRequestMessage
from pydantic import BaseModel, ValidationError

from app.modules.agent_service import AgentService
from app.modules.connection_manager import ClientConnection
from app.modules.context_manager import DatabaseManager
from app.modules.orchestration_config import OrchestrationConfig
from app.modules.phases.phase2_strategy import Phase2Strategy
from app.modules.phases.phase3_execution import Phase3Execution
from app.modules.validator import Validator
from app.utils.ast_matcher import ASTMatcher
from app.utils.formatters import format_plan_for_generator
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.performance import PerformanceTracker
from app.utils.response_parser import ResponseParser
from app.utils.schemas import (
    ArchitectAnalysisResponse,
    ASTArchitectResponse,
    IntentClassifierResponse,
    RefactorInsightsResponse,
    StructuralAuditorResponse,
)
from app.utils.types import ExitStatus, FailureTier, RefactorIntent, Role

# ============================================================
# SECTION 1: OrchestrationState
# ============================================================


class OrchestrationState(BaseModel):
    session_id: str
    base_code: str
    working_code: str
    user_instruction: str

    # Structural Artifacts
    intent_packet: dict | None = None
    active_plan: dict | None = None

    # Loop Counters
    strategy_iter: int = 1  # Outer Loop (Max 3)
    strategy_iter_incremented: bool = False
    syntax_iter: int = 0  # Inner Loop (Max 3)

    # Diagnostic Memory
    cumulative_feedback: list[dict] = []
    feedback_cap: int = 3

    # Syntax Healing
    syntax_error_context: dict | None = None
    structural_fix_attempts: int = 0

    # Sequential Mutation Application
    mutation_queue: list[dict] = []
    mutation_index: int = 0
    sequential_attempts: int = 0
    gen_timings: list[dict] = []

    # Sub-Step Decomposition
    architect_analysis: dict | None = None

    # Lifecycle
    current_phase: int = 1
    exit_status: ExitStatus = ExitStatus.PROCESSING

    # Baseline Metrics
    original_complexity: int = 0

    def add_feedback(self, entry: dict) -> None:
        """Append a feedback entry, capping at feedback_cap (ring buffer)."""
        self.cumulative_feedback.append(entry)
        if len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)

    def extend_feedback(self, entries: list[dict]) -> None:
        """Extend with multiple feedback entries, capped at feedback_cap."""
        self.cumulative_feedback.extend(entries)
        while len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)


# ============================================================
# SECTION 2: Orchestrator
# ============================================================


class Orchestrator:
    SKIP_JUDGE: bool = False

    def __init__(
        self,
        agent_service: AgentService,
        validator: Validator,
        db: DatabaseManager,
        skip_judge: bool = False,
        config: OrchestrationConfig | None = None,
    ) -> None:
        self.agent_service: AgentService = agent_service
        self.validator: Validator = validator
        self.db: DatabaseManager = db
        self.current_client: ClientConnection | None = None
        self.skip_judge = skip_judge

        try:
            self._config = config or OrchestrationConfig.from_yaml(MODELS_CONFIG_PATH)
            with open(PROMPTS_CONFIG_PATH) as p_config:
                self.prompts: dict[str, Any] = yaml.safe_load(p_config) or {}
        except (yaml.YAMLError, FileNotFoundError, PermissionError) as e:
            print(f"Fatal: Failed to load config: {e}")
            raise

        self._phase2 = Phase2Strategy(
            self.agent_service, self._config, self.prompts,
            lambda c, r, m, ct: self._notify(c, r, m, content=ct, phase=2),
        )
        self._phase3 = Phase3Execution(
            self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct: self._notify(c, r, m, content=ct, phase=3),
        )

    @staticmethod
    def _order_mutations(mutations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Order mutations by dependency: RENAME first, then ADD_*, then MODIFY."""

        def sort_key(m: dict[str, Any]) -> int:
            action = m.get("action", "")
            if action == "RENAME_SYMBOL":
                return 0
            if action.startswith("ADD_") or action == "SPLIT_BODY":
                return 1
            if action in ("MODIFY_METHOD", "REMOVE_METHOD"):
                return 2
            return 3

        return sorted(mutations, key=sort_key)

    async def execute_orchestration(self, client: ClientConnection, user_code: str, user_instruction: str) -> None:
        """Main orchestration loop.

        Runs 6 phases sequentially: Baseline → Strategy → Execution →
        Validation → Adjudication → Finalization. Handles retries,
        cancellation, and performance tracking.
        """
        self.current_client = client
        tracker = PerformanceTracker()
        await tracker.start_tracking()

        # 1. Initialize State
        state = OrchestrationState(
            session_id=str(client.id),
            base_code=user_code,
            working_code=user_code,
            user_instruction=user_instruction,
        )

        self.state = state

        try:
            # 2. Persist session start
            self.db.create_session(
                id=state.session_id,
                instruction=state.user_instruction,
                original_code=state.base_code,
            )

            # --- PHASE 1: Baseline ---
            await self._notify(client, Role.Validator, "Baseline: Analyzing code structure...",
                               phase=1,
                               planner_model=self._config.planner.name,
                               generator_model=self._config.generator.name,
                               judge_model=self._config.judge.name)
            state.original_complexity = self.validator.get_complexity(state.base_code)
            state.current_phase = 2

            # ============================================================
            # SECTION 3: Main Loop
            # ============================================================

            while state.exit_status == ExitStatus.PROCESSING:
                if state.current_phase == 2:
                    await self._run_phase_2(client, state)
                elif state.current_phase == 3:
                    # Sequential on first attempt for multi-mutation plans
                    should_use_sequential = (
                        state.strategy_iter == 1
                        and not state.syntax_error_context
                        and state.active_plan
                        and len(state.active_plan.get("ast_mutations", [])) > 1
                    )
                    if should_use_sequential:
                        await self._run_sequential_phase_3(client, state)
                        if state.mutation_index >= len(state.mutation_queue):
                            state.current_phase = 4
                            continue
                        # Sequential exhausted mid-way — fall through to single-shot
                        state.working_code = state.base_code
                        state.mutation_index = 0
                        state.mutation_queue = []
                        state.sequential_attempts = 0
                    await self._run_phase_3(client, state)
                elif state.current_phase == 4:
                    await self._run_phase_4(client, state)
                    if self.skip_judge and state.current_phase == 5:
                        state.current_phase = 6
                elif state.current_phase == 5:
                    await self._run_phase_5(client, state)
                elif state.current_phase == 6:
                    break

                # Global circuit breaker
                if state.strategy_iter > 3:
                    state.exit_status = ExitStatus.ABORT_STRATEGY
                    state.current_phase = 6
                    break

            # --- PHASE 6: Finalization ---
            await tracker.stop_tracking()
            performance_metrics = tracker.get_metrics()

            await self._run_phase_6(client, state, performance_metrics)

        except asyncio.CancelledError:
            await tracker.stop_tracking()
            self.db.mark_as_halted(client.id)
            await self._notify(client, Role.System, "Process halted.")
            raise
        except Exception as e:
            await tracker.stop_tracking()
            print(f"Orchestration Error: {e}")
            try:
                await client.send_status(role=Role.System, content=f"Error: {str(e)[:200]}")
            except Exception:
                pass
            raise e
        finally:
            await self.agent_service.unload()

    # ============================================================
    # SECTION 4: Phase 2 — Strategy
    # ============================================================

    async def _run_phase_2(self, client: ClientConnection, state: OrchestrationState) -> None:
        await self._phase2.run(client, state)

    # ============================================================
    # SECTION 5: Phase 3 — Execution
    # ============================================================

    async def _run_phase_3(self, client: ClientConnection, state: OrchestrationState) -> None:
        await self._phase3.run_single(client, state)

    # --- Sequential Phase 3 (one mutation at a time) ---

    async def _run_sequential_phase_3(self, client: ClientConnection, state: OrchestrationState) -> None:
        await self._phase3.run_sequential(client, state)

    # ============================================================
    # SECTION 6: Phase 4 — Validation
    # ============================================================

    async def _run_phase_4(self, client: ClientConnection, state: OrchestrationState) -> None:
        """Phase 4: Deterministic Validation (Tier 1 & 2)."""
        await self._notify(
            client,
            Role.Validator,
            f"Validation: Validating (Strategy {state.strategy_iter}, Syntax {state.syntax_iter})...",
            phase=4,
        )

        # Step 7: Tier 1 - Syntax
        syntax_res = self.validator.check_syntax(state.working_code)
        print(
            f"\n--- Validator Syntax Check ---\nIs Valid: {syntax_res['is_valid']}\nError: {syntax_res.get('error')}\n------------------------------"
        )
        if not syntax_res["is_valid"]:
            state.syntax_iter += 1
            if state.syntax_iter <= 3:
                await self._notify(
                    client,
                    Role.Validator,
                    f"Syntax Fail (Attempt {state.syntax_iter}). Healing...",
                )
                raw_errors = syntax_res.get("errors", [])
                raw_error = raw_errors[0] if raw_errors else "Unknown syntax error"
                state.syntax_error_context = {
                    "attempt": state.syntax_iter,
                    "error": self.validator.format_syntax_error(raw_error),
                    "broken_code": state.working_code,
                }
                state.current_phase = 3
                return
            else:
                await self._notify(client, Role.Validator, "Syntax Unrecoverable. Revising strategy.")
                state.add_feedback(
                    {
                        "failure_tier": FailureTier.TIER_1_SYNTAX,
                        "error": "Persistent syntax errors after 3 heals.",
                    }
                )
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.syntax_iter = 0
                state.current_phase = 2
                return

        await self._notify(client, Role.Validator, f"Syntax OK.\n\n{json.dumps({'syntax': {'passed': True}})}")

        # Step 8: Tier 2 - Structural
        findings = []

        # Check A: Complexity
        assert state.intent_packet is not None
        cc_finding, orig_cc_val, refac_cc_val = self.validator.verify_complexity(
            state.base_code, state.working_code, state.intent_packet
        )
        if cc_finding:
            findings.append(cc_finding)

        # Check B: Boundary Verification
        target_scopes = []
        if state.intent_packet and "scope_anchor" in state.intent_packet:
            member = state.intent_packet["scope_anchor"].get("member", "")
            if member:
                target_scopes.append(member)
            target_class = state.intent_packet["scope_anchor"].get("target_class", "")
            if target_class:
                target_scopes.append(target_class)

        if state.active_plan and "ast_mutations" in state.active_plan:
            for mutation in state.active_plan["ast_mutations"]:
                target = mutation.get("target", "")
                # Extract method name if it has a signature
                name = target.split("(")[0].strip()
                if name and name not in target_scopes:
                    target_scopes.append(name)

        if state.active_plan and "target_class" in state.active_plan:
            if state.active_plan["target_class"] not in target_scopes:
                target_scopes.append(state.active_plan["target_class"])

        boundary_finding = self.validator.verify_boundary(state.base_code, state.working_code, target_scopes)
        if boundary_finding:
            findings.append(boundary_finding)

        # Check C: Intent Math
        intent_finding = None
        if state.intent_packet:
            intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
            try:
                intent_finding = self.validator.verify_intent(intent_enum, state.base_code, state.working_code)
            except Exception as e:
                print(f"  Intent verifier crashed for {intent_enum}: {e}")
                intent_finding = None
            if intent_finding:
                findings.append(intent_finding)

        # Build CC detail based on rule context
        cc_detail = None
        if state.intent_packet:
            intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
            cc_rule = Validator.get_cc_rule(intent_enum)
            target = state.intent_packet.get("scope_anchor", {}).get("member", "")
            if cc_rule == "EXTRACT_RULE" and target:
                if cc_finding:
                    cc_detail = f"Target method '{target}' CC increased: {orig_cc_val} → {refac_cc_val}"
                else:
                    overall = self.validator.get_complexity(state.working_code)
                    cc_detail = f"Target method '{target}' extracted (CC: {refac_cc_val}). Overall code CC: {overall}"
            elif cc_rule in ("STRICT", "LOOSENED"):
                if cc_finding:
                    limit = orig_cc_val + (1 if cc_rule == "LOOSENED" else 0)
                    cc_detail = f"Overall code CC increased: {orig_cc_val} → {refac_cc_val} (limit: {limit})"
                elif refac_cc_val == orig_cc_val:
                    cc_detail = f"Overall code complexity unchanged ({orig_cc_val})"
                else:
                    cc_detail = f"Overall code CC: {orig_cc_val} → {refac_cc_val}"

        checks = [
            {
                "name": "Cyclomatic Complexity",
                "passed": cc_finding is None,
                "before": orig_cc_val,
                "after": refac_cc_val,
                "details": cc_detail,
            },
            {
                "name": "Boundary Preservation",
                "passed": boundary_finding is None,
            },
            {
                "name": "Intent Match",
                "passed": intent_finding is None,
                "details": intent_finding.error_report.message[:200] if intent_finding else None,
            },
        ]

        print(
            f"\n--- Validator Structural Checks ---\nComplexity Check: {refac_cc_val or orig_cc_val} (Original: {orig_cc_val})\nBoundary check found issue: {bool(boundary_finding)}\nIntent check found issue: {bool(intent_finding)}\nTotal findings: {len(findings)}\n-----------------------------------"
        )
        if findings:
            current_fault_count = len(findings)
            passed = sum(1 for c in checks if c["passed"])
            failed = len(checks) - passed
            await self._notify(
                client,
                Role.Validator,
                f"Structural Checks — {passed}/{len(checks)} passed · {failed} failed\n\n{json.dumps({'checks': checks})}",
            )
            state.extend_feedback([f.model_dump() for f in findings])

            # Try structural fix — send errors to Generator for targeted fix
            if state.structural_fix_attempts < 1:
                state.structural_fix_attempts += 1
                # Build error context for Generator from findings
                error_msgs = []
                for f in findings:
                    error_msgs.append(f.error_report.message[:200])
                state.syntax_error_context = {
                    "attempt": state.structural_fix_attempts,
                    "error": "Structural issues: " + "; ".join(error_msgs[:2]),
                    "broken_code": state.working_code,
                }
                await self._notify(
                    client,
                    Role.Validator,
                    "Routing to Generator for targeted fix...",
                )
                state.current_phase = 3
                return

            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.syntax_iter = 0
            state.structural_fix_attempts = 0
            state.current_phase = 2
        else:
            passed = sum(1 for c in checks if c["passed"])
            await self._notify(client, Role.Validator,
                f"Structural Checks — {passed}/{len(checks)} passed\n\n{json.dumps({'checks': checks})}")
            if (
                state.active_plan
                and state.active_plan.get("ast_mutations")
                and state.working_code.strip() == state.base_code.strip()
            ):
                await self._notify(
                    client,
                    Role.Validator,
                    "Plan not executed — code unchanged.",
                )
                state.add_feedback(
                    {
                        "failure_tier": FailureTier.TIER_3_JUDGE,
                        "error": "Plan was not executed: code unchanged.",
                    }
                )
                if not state.strategy_iter_incremented:
                    state.strategy_iter += 1
                    state.strategy_iter_incremented = True
                state.current_phase = 2
                return
            state.current_phase = 5

    @staticmethod
    def _strip_outer_wrapper(code: str, base_code: str) -> str:
        """Strip the outermost class wrapper if base had none and refactored has one.

        Preserves import lines and inner class content.
        """
        if "class" in base_code:
            return code
        text = code.strip()
        class_match = re.search(r"(?:public|private|protected|static|abstract|final|\s)*class\s+\w+", text)
        if not class_match:
            return code
        brace_start = text.find("{", class_match.end())
        if brace_start == -1:
            return code

        import_lines = [line for line in code.splitlines()
                        if line.strip().startswith("import ")]

        depth = 0
        for i in range(brace_start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    inner = text[brace_start + 1 : i].strip()
                    if import_lines:
                        inner = "\n".join(import_lines) + "\n\n" + inner
                    return inner
        return code

    # ============================================================
    # SECTION 7: Phase 5 — Audit (Judge)
    # ============================================================

    async def _run_phase_5(self, client: ClientConnection, state: OrchestrationState) -> None:
        """Phase 5: Heuristic Adjudication (Inference 4)."""
        await self._notify(client, Role.Judge, "Adjudication: Running final audit...", phase=5)
        await self.agent_service.swap(self._config.judge)

        # Normalize both sides for judge comparison:
        # 1. Strip imports so parity is consistent
        # 2. Strip outer class wrapper if original had none
        def _normalize_for_judge(code: str) -> str:
            no_imports = "\n".join(line for line in code.splitlines() if not line.strip().startswith("import "))
            return self._strip_outer_wrapper(no_imports, state.base_code)

        judge_base = _normalize_for_judge(state.base_code)
        judge_refac = _normalize_for_judge(state.working_code)

        # Build plan context summary for the auditor
        intent = ""
        target_class = ""
        target_method = ""
        if state.intent_packet:
            intent = state.intent_packet.get("specific_intent", "")
            scope = state.intent_packet.get("scope_anchor", {})
            target_class = scope.get("target_class", "")
            target_method = scope.get("member", "")

        mutations = state.active_plan.get("ast_mutations", []) if state.active_plan else []
        mutation_actions = [m.get("action", "?") for m in mutations]
        mutation_targets = [m.get("target", "?") for m in mutations]

        plan_summary = f"Intent: {intent}. Target: {target_class}.{target_method}."
        mutations_list = (
            f"Mutations: {', '.join(f'{a}({t})' for a, t in zip(mutation_actions, mutation_targets, strict=False))}"
            if mutation_actions
            else "Mutations: none"
        )

        audit_prompt = (
            f"## Plan Context\n{plan_summary}\n{mutations_list}\n\n"
            f"## Code\n"
            f"Original: <code>{judge_base}</code>\n"
            f"Refactored: <code>{judge_refac}</code>\n"
            f"Intent: {json.dumps(state.intent_packet)}"
        )
        system_content = self.prompts["judge"]["auditor"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["judge"].get("auditor_guidance", {}).get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: list[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": audit_prompt},
        ]

        for _jattempt in range(2):
            jtemp = 0.1 if _jattempt == 0 else 0.3
            jmax = 1500 if _jattempt == 0 else 2048
            try:
                raw = await self.agent_service.generate(
                    messages,  # type: ignore[arg-type]
                    temp=jtemp,
                    max_tokens=jmax,
                    response_model=StructuralAuditorResponse,
                )
                audit_text = raw["choices"][0]["message"].get("content") or ""
                jheader = "--- Judge Auditor Output ---"
                if _jattempt > 0:
                    jheader = f"--- Judge Auditor Output (Retry {_jattempt}) ---"
                print(f"\n{jheader}\n{audit_text}\n--------------------------")
                audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)
                break
            except (ValidationError, ValueError):
                if _jattempt == 0:
                    print("  Judge attempt 1 failed (truncated). Retrying with temp=0.3, max_tokens=2048...")
                    await self.agent_service.clear_context()
                else:
                    print("  Judge failed on both attempts. Falling back to strategy retry.")
                    state.add_feedback(
                        {
                            "failure_tier": FailureTier.TIER_3_JUDGE,
                            "error": "Judge auditor failed to produce valid verdict on both attempts.",
                        }
                    )
                    if not state.strategy_iter_incremented:
                        state.strategy_iter += 1
                        state.strategy_iter_incremented = True
                    state.current_phase = 2
                    return

        # Override: judge hallucinated IDENTICAL_CODE or LOGIC_DRIFT
        if audit_res.verdict == "REVISE" and audit_res.issues:
            issue = audit_res.issues[0]
            if issue.issue_type == "IDENTICAL_CODE":
                if self.validator.has_structural_change(state.base_code, state.working_code):
                    print("WARNING: Judge hallucinated IDENTICAL_CODE — overriding to ACCEPT")
                    audit_res.verdict = "ACCEPT"
                    audit_res.issues = []
            elif issue.issue_type == "LOGIC_DRIFT":
                if not self.validator.has_structural_change(state.base_code, state.working_code):
                    print("WARNING: Judge hallucinated LOGIC_DRIFT — overriding to ACCEPT")
                    audit_res.verdict = "ACCEPT"
                    audit_res.issues = []

        await self._notify(
            client,
            Role.Judge,
            f"Audit Finished: {audit_res.verdict}",
            content=json.dumps(audit_res.model_dump()),
        )

        if audit_res.verdict == "ACCEPT":
            state.exit_status = ExitStatus.SUCCESS
            state.current_phase = 6
        else:
            await self._notify(client, Role.Judge, "Audit requested revision.")
            state.add_feedback(
                {"failure_tier": FailureTier.TIER_3_JUDGE, "error": [i.model_dump() for i in audit_res.issues]}
            )
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.current_phase = 2

    # ============================================================
    # SECTION 8: Phase 6 — Finalization
    # ============================================================

    async def _run_phase_6(
        self,
        client: ClientConnection,
        state: OrchestrationState,
        metrics: dict[str, Any],
    ) -> None:
        """Phase 6: Finalization & Reporting."""
        # Strip outer wrapper from working_code for final output
        state.working_code = self._strip_outer_wrapper(state.working_code, state.base_code)

        await self._notify(
            client,
            Role.System,
            f"Finalization: Finalizing session (Status: {state.exit_status})...",
            phase=6,
        )

        final_code = state.working_code if state.exit_status == ExitStatus.SUCCESS else state.base_code

        # 1. Send immediate result (without insights)
        await client.send_result(
            final_code=final_code,
            original_complexity=state.original_complexity,
            refactored_complexity=self.validator.get_complexity(final_code),
            performance_metrics=metrics,
            exit_status=state.exit_status.value,
            planner_model=self._config.planner.name,
            generator_model=self._config.generator.name,
            judge_model=self._config.judge.name,
        )

        # 2. Generate final insights as follow-up
        insights: Any = []
        if state.exit_status == ExitStatus.SUCCESS:
            await self._notify(client, Role.Judge, "Generating insights...")
            try:
                insights = await self.generate_insights(
                    state.base_code,
                    state.working_code,
                    state.original_complexity,
                    self.validator.get_complexity(state.working_code),
                )
            except Exception as e:
                print(f"Error generating insights: {e}")
                insights = "Refactoring successful (Insights generation failed)."
        else:
            insights = f"Refactoring aborted: {state.exit_status}. Reverted to original code."

        # 3. Send insights follow-up
        await client.send_insights(insights)

        # 4. Final DB update
        self.db.complete_session(
            id=state.session_id,
            refactored_code=final_code,
            insights=json.dumps(insights) if not isinstance(insights, str) else insights,
            original_complexity=state.original_complexity,
            refactored_complexity=self.validator.get_complexity(final_code),
            performance_metrics=metrics,
            exit_status=state.exit_status.value,
            final_intent=json.dumps(state.intent_packet),
            final_plan=json.dumps(state.active_plan),
            outer_loops=state.strategy_iter,
            inner_loops=state.syntax_iter,
            planner_model=self._config.planner.name,
            generator_model=self._config.generator.name,
            judge_model=self._config.judge.name,
        )

    # ============================================================
    # SECTION 9: Helpers
    # ============================================================

    async def generate_insights(
        self,
        user_code: str,
        refactored_code: str,
        original_complexity: int,
        refactored_complexity: int,
    ) -> Any:
        """Generate refactoring insights using the Judge model."""
        await self.agent_service.swap(self._config.judge)

        prompt: str = (
            f"--- ORIGINAL CODE ---\n{user_code}\n\n"
            f"--- REFACTORED CODE ---\n{refactored_code}\n\n"
            f"Original Complexity: {original_complexity}\n"
            f"Refactored Complexity: {refactored_complexity}\n"
        )
        messages: list[ChatCompletionRequestMessage] = [
            {
                "role": "system",
                "content": self.prompts["judge"]["insights"],
            },
            {"role": "user", "content": prompt},
        ]

        raw_reponse = await self.agent_service.generate(
            messages=messages,  # type: ignore[arg-type]
            temp=0.1,
            max_tokens=1000,
            stream=False,
            response_model=RefactorInsightsResponse,
        )

        text = raw_reponse["choices"][0]["message"].get("content") or ""
        print(f"\n--- Judge Insights Output ---\n{text}\n---------------------------")

        try:
            insights_res = ResponseParser.extract_json(text, RefactorInsightsResponse)
            return [i.model_dump() for i in insights_res.insights]
        except (ValidationError, ValueError, json.JSONDecodeError) as e:
            print(f"Failed to parse insights JSON: {e}")
            return [{"title": "Refactoring Summary", "details": text.strip()}]

    async def run_single_refactor(self, client: ClientConnection, user_code: str, user_instruction: str) -> None:
        """Single-model refactor using the 7B model. No multi-agent pipeline."""
        cfg = self._config.single
        prompts = self.prompts["single"]

        tracker = PerformanceTracker()
        await tracker.start_tracking()

        # Create DB session first so _notify can persist logs
        self.db.create_session(
            id=client.id,
            instruction=user_instruction,
            original_code=user_code,
            mode="single",
        )

        await self.agent_service.swap(cfg)
        await self.agent_service.clear_context()

        orig_cc = self.validator.get_complexity(user_code)

        # --- Pass 1: Generate code ---
        await self._notify(client, Role.Monolith, "Generating refactored code...", phase=1)
        coder_prompt = f"<code>{user_code}</code>\n\nInstruction: {user_instruction}"
        messages = [
            {"role": "system", "content": prompts["coder"]},
            {"role": "user", "content": coder_prompt},
        ]
        raw = await self.agent_service.generate(messages, temp=0.1, max_tokens=4096)  # type: ignore
        response_text = raw["choices"][0]["message"].get("content") or ""
        refactored = ResponseParser.extract_xml(response_text, "code") or user_code

        refac_cc = self.validator.get_complexity(refactored)

        # --- Pass 2: Generate insights ---
        await self._notify(client, Role.Monolith, "Generating insights...", phase=2)
        await self.agent_service.clear_context()
        insight_prompt = f"Original: <code>{user_code}</code>\nRefactored: <code>{refactored}</code>"
        insight_messages = [
            {"role": "system", "content": prompts["insights"]},
            {"role": "user", "content": insight_prompt},
        ]
        raw2 = await self.agent_service.generate(
            insight_messages,  # type: ignore
            temp=0.1,
            max_tokens=1000,
            response_model=RefactorInsightsResponse,
        )
        insight_text = raw2["choices"][0]["message"].get("content") or ""
        insights_res = ResponseParser.extract_json(insight_text, RefactorInsightsResponse)
        insight_dicts = [i.model_dump() for i in insights_res.insights]

        await tracker.stop_tracking()
        perf = tracker.get_metrics()

        await client.send_result(
            final_code=refactored,
            original_complexity=orig_cc,
            refactored_complexity=refac_cc,
            performance_metrics=perf,
            exit_status="SUCCESS",
            generator_model=cfg.name,
        )
        await client.send_insights(insight_dicts)

        self.db.complete_session(
            id=client.id,
            refactored_code=refactored,
            insights=json.dumps(insight_dicts),
            original_complexity=orig_cc,
            refactored_complexity=refac_cc,
            performance_metrics=perf,
            exit_status="SUCCESS",
            mode="single",
        )

    @staticmethod
    def _repair_generator_output(original: str, generated: str) -> str:
        """Strip common defensive additions from Generator output."""
        import re as _re

        result = generated

        # 1. Strip throws declarations added to method signatures
        orig_throws = set(_re.findall(r"throws\s+(\w+Exception)", original))
        gen_throws = set(_re.findall(r"throws\s+(\w+Exception)", result))
        for exc in gen_throws - orig_throws:
            result = _re.sub(r"\s*throws\s+" + _re.escape(exc) + r"(?=\s*\{)", "", result)

        # 2. Remove null checks not in original — robust to no-brace bodies
        orig_null_count = len(_re.findall(r"if\s*\(\s*\w+\s*==\s*null\s*\)", original))
        gen_null_checks = list(_re.finditer(r"if\s*\(\s*\w+\s*==\s*null\s*\)", result))
        extra_nulls = len(gen_null_checks) - orig_null_count
        if extra_nulls > 0:
            for match in reversed(gen_null_checks[-extra_nulls:]):
                start = match.start()
                end = start
                after = result[match.end() :]
                after_stripped = after.lstrip()
                if after_stripped.startswith("{"):
                    brace_pos = match.end() + (len(after) - len(after_stripped))
                    depth = 0
                    for i in range(brace_pos, len(result)):
                        if result[i] == "{":
                            depth += 1
                        elif result[i] == "}":
                            depth -= 1
                            if depth == 0:
                                end = i + 1
                                break
                else:
                    semicolon = after.find(";")
                    if semicolon >= 0:
                        end = match.end() + semicolon + 1
                if end > start:
                    result = result[:start] + result[end:]

        # 3. Strip 'public' modifier from bare methods that weren't public
        org_pub_methods = set(_re.findall(r"public\s+\w+\s+(\w+)\s*\(", original))
        gen_pub_methods = set(_re.findall(r"public\s+\w+\s+(\w+)\s*\(", result))
        for method in gen_pub_methods - org_pub_methods:
            result = _re.sub(r"\bpublic\s+(\w+\s+" + _re.escape(method) + r"\s*\()", r"\1", result)

        return result

    async def _notify(
        self,
        client: ClientConnection,
        role: Role,
        message: str,
        content: str | None = None,
        phase: int | None = None,
        outer_loop: int = 0,
        inner_loop: int = 0,
        planner_model: str | None = None,
        generator_model: str | None = None,
        judge_model: str | None = None,
    ) -> None:
        """Helper to print to terminal, persist to DB, and notify frontend."""
        print(f"[{role}] {message}")

        # Use swap-able client reference for reconnection support.
        # NOTE: effective snapped once per _notify() call. Reconnect swaps
        # self.current_client between calls — next notification goes to new
        # client. Working as intended.
        effective = self.current_client or client

        # Persist the log entry to the database in real-time
        self.db.log_status(
            session_id=effective.id,
            role=role.value,
            status=message,
            content=content,
            phase=phase,
            outer_loop=outer_loop,
            inner_loop=inner_loop,
        )

        if effective.is_stale:
            return

        if content:
            formatted_message = f"{message}\n\n{content}"
        else:
            formatted_message = message

        await effective.send_status(role=role, content=formatted_message,
                                     planner_model=planner_model,
                                     generator_model=generator_model,
                                     judge_model=judge_model)
