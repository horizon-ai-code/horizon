import asyncio
import json
from typing import Any, Dict, List, Optional

import yaml
from llama_cpp import ChatCompletionRequestMessage
from pydantic import BaseModel

from app.modules.agent_service import AgentService
from app.modules.connection_manager import ClientConnection
from app.modules.context_manager import DatabaseManager
from app.modules.validator import Validator
from app.utils.formatters import format_agent_output, format_plan_for_generator
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.performance import PerformanceTracker
from app.utils.response_parser import ResponseParser
from app.utils.schemas import (
    ArchitectAnalysisResponse,
    ASTArchitectResponse,
    ErrorReport,
    IntentClassifierResponse,
    RefactorInsightsResponse,
    StructuralAuditorResponse,
    ValidationFinding,
)
from app.utils.types import ExitStatus, FailureTier, RefactorIntent, Role


class OrchestrationState(BaseModel):
    session_id: str
    base_code: str
    working_code: str
    user_instruction: str

    # Structural Artifacts
    intent_packet: Optional[Dict] = None
    active_plan: Optional[Dict] = None

    # Loop Counters
    strategy_iter: int = 1  # Outer Loop (Max 3)
    strategy_iter_incremented: bool = False
    syntax_iter: int = 0  # Inner Loop (Max 3)

    # Diagnostic Memory
    cumulative_feedback: List[Dict] = []
    feedback_cap: int = 3

    # Syntax Healing
    syntax_error_context: Optional[Dict] = None

    # Sub-Step Decomposition
    architect_analysis: Optional[Dict] = None

    # Lifecycle
    current_phase: int = 1
    exit_status: ExitStatus = ExitStatus.PROCESSING

    # Baseline Metrics
    original_complexity: int = 0
    previous_fault_count: int = 999
    fault_stall_count: int = 0

    def add_feedback(self, entry: Dict) -> None:
        self.cumulative_feedback.append(entry)
        if len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)

    def extend_feedback(self, entries: List[Dict]) -> None:
        self.cumulative_feedback.extend(entries)
        while len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)


class Orchestrator:
    def __init__(
        self,
        agent_service: AgentService,
        validator: Validator,
        db: DatabaseManager,
    ) -> None:
        self.agent_service: AgentService = agent_service
        self.validator: Validator = validator
        self.db: DatabaseManager = db

        try:
            with open(MODELS_CONFIG_PATH, "r") as config:
                self.model_config: Dict[str, Any] = yaml.safe_load(config)
            with open(PROMPTS_CONFIG_PATH, "r") as p_config:
                self.prompts: Dict[str, Any] = yaml.safe_load(p_config)
        except yaml.YAMLError as e:
            print(f"Error loading config: {e}")

    async def execute_orchestration(
        self, client: ClientConnection, user_code: str, user_instruction: str
    ) -> None:
        tracker = PerformanceTracker()
        await tracker.start_tracking()

        # 1. Initialize State
        state = OrchestrationState(
            session_id=str(client.id),
            base_code=user_code,
            working_code=user_code,
            user_instruction=user_instruction,
        )

        try:
            # 2. Persist session start
            self.db.create_session(
                id=state.session_id,
                instruction=state.user_instruction,
                original_code=state.base_code,
            )

            # --- PHASE 1: Baseline ---
            await self._notify(
                client, Role.Validator, "Ph1: Baselining code structure...", phase=1
            )
            state.original_complexity = self.validator.get_complexity(state.base_code)
            state.current_phase = 2

            while state.exit_status == ExitStatus.PROCESSING:
                if state.current_phase == 2:
                    await self._run_phase_2(client, state)
                elif state.current_phase == 3:
                    await self._run_phase_3(client, state)
                elif state.current_phase == 4:
                    await self._run_phase_4(client, state)
                elif state.current_phase == 5:
                    await self._run_phase_5(client, state)
                elif state.current_phase == 6:
                    break

                # Global circuit breaker
                if state.strategy_iter > 3:
                    state.exit_status = ExitStatus.ABORT_STRATEGY
                    state.current_phase = 6
                    break

                if state.fault_stall_count >= 2:
                    await self._notify(
                        client,
                        Role.System,
                        "Circuit Breaker: Faults not decreasing. Aborting.",
                    )
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
            await client.send_status(role=Role.System, content=f"Error: {str(e)[:200]}")
            raise e
        finally:
            await self.agent_service.unload()

    async def _run_phase_2(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 2: The Strategy Block (Inference 1, 2, 3)."""
        state.strategy_iter_incremented = False
        # Step 3: Classifier
        if not state.intent_packet:
            await self._notify(
                client,
                Role.Planner,
                f"Ph2: Classifying intent (Strategy Iter {state.strategy_iter})...",
                phase=2,
            )
            await self.agent_service.swap(self.model_config["planner"])

            prompt = f"<code>{state.base_code}</code>\n<instruction>{state.user_instruction}</instruction>"

            messages: List[ChatCompletionRequestMessage] = [
                {"role": "system", "content": self.prompts["planner"]["classifier"]},
                {"role": "user", "content": prompt},
            ]

            raw = await self.agent_service.generate(
                messages,
                temp=0.1,
                max_tokens=500,
                response_model=IntentClassifierResponse,
            )
            response_text = raw["choices"][0]["message"].get("content") or ""
            print(
                f"\n--- Planner Classifier Output ---\n{response_text}\n-------------------------------"
            )

            classifier_res = ResponseParser.extract_json(
                response_text, IntentClassifierResponse
            )
            state.intent_packet = classifier_res.intent_packet.model_dump()

            await self._notify(
                client,
                Role.Planner,
                f"Intent Classified: {state.intent_packet['specific_intent']}",
                content=json.dumps(state.intent_packet),
            )

        # Step 4: Cognitive Reset
        await self.agent_service.clear_context()

        # Step 5a: Architect ANALYSIS (NEW)
        await self._notify(
            client, Role.Planner, "Ph2: Analyzing code structure...", phase=2
        )

        analysis_prompt = (
            f"Intent Packet: {json.dumps(state.intent_packet)}\n"
            f"User Instruction: {state.user_instruction}\n"
            f"Code: <code>{state.base_code}</code>"
        )

        system_content = self.prompts["planner"]["architect_analysis"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["planner"]["analysis_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages = [
            {
                "role": "system",
                "content": system_content,
            },
            {"role": "user", "content": analysis_prompt},
        ]

        raw = await self.agent_service.generate(
            messages,
            temp=0.1,
            max_tokens=1024,
            response_model=ArchitectAnalysisResponse,
        )
        analysis_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Planner Analysis Output ---\n{analysis_text}\n-------------------------------"
        )

        try:
            analysis_model = ResponseParser.extract_json(
                analysis_text, ArchitectAnalysisResponse
            )
            state.architect_analysis = analysis_model.model_dump()
        except Exception:
            state.architect_analysis = {}

        await self._notify(
            client,
            Role.Planner,
            "Structure analysis complete.",
            content=json.dumps(state.architect_analysis),
        )

        # Step 4b: Cognitive Reset between sub-steps
        await self.agent_service.clear_context()

        # Step 5c: Architect SYNTHESIS (MODIFIED)
        await self._notify(
            client, Role.Planner, "Ph2: Designing mutation plan...", phase=2
        )

        arch_prompt = (
            f"Analysis: {json.dumps(state.architect_analysis)}\n"
            f"Intent: {json.dumps(state.intent_packet)}\n"
            f"Instruction: {state.user_instruction}\n"
            f"Code: <code>{state.base_code}</code>"
        )
        if state.cumulative_feedback:
            arch_prompt += f"\n\n### PREVIOUS ATTEMPT FEEDBACK\n{json.dumps(state.cumulative_feedback, indent=2)}"

        system_content = self.prompts["planner"]["architect"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["planner"]["synthesis_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": arch_prompt},
        ]

        raw = await self.agent_service.generate(
            messages, temp=0.2, max_tokens=2048, response_model=ASTArchitectResponse
        )
        arch_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Planner Architect Output ---\n{arch_text}\n------------------------------"
        )

        architect_res = ResponseParser.extract_json(arch_text, ASTArchitectResponse)
        state.active_plan = architect_res.ast_modification_plan.model_dump()

        await self._notify(
            client,
            Role.Planner,
            "Modification plan generated.",
            content=json.dumps(state.active_plan),
        )

        state.current_phase = 3

    async def _run_phase_3(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 3: Plan Execution (Inference 3)."""
        await self._notify(client, Role.Generator, "Ph3: Implementing plan...", phase=3)
        await self.agent_service.swap(self.model_config["generator"])
        await self.agent_service.clear_context()

        if state.syntax_error_context:
            ctx = state.syntax_error_context
            coder_prompt = (
                f"Modification Plan: {json.dumps(state.active_plan)}\n\n"
                f"### PREVIOUS SYNTAX ERROR (Attempt {ctx['attempt']}/3)\n"
                f"{ctx['error']}\n\n"
                f"### CURRENT BROKEN CODE\n"
                f"<code>{ctx['broken_code']}</code>\n\n"
                f"Fix the syntax error above. Output only valid Java wrapped in <code> tags."
            )
        else:
            coder_prompt = format_plan_for_generator(
                state.active_plan or {}, state.base_code
            )

        system_content = self.prompts["generator"]["coder"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["generator"]["coder_guidance"].get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": coder_prompt},
        ]

        heal_temp = 0.3 if state.syntax_error_context else 0.1
        raw = await self.agent_service.generate(
            messages, temp=heal_temp, max_tokens=2048
        )
        coder_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Generator Coder Output ---\n{coder_text}\n----------------------------"
        )

        new_code = ResponseParser.extract_xml(coder_text, "code")
        if new_code:
            state.working_code = new_code
            state.syntax_iter = 0
            state.syntax_error_context = None
            await self._notify(
                client, Role.Generator, "Code refactored.", content=new_code
            )
            print(new_code)

            state.current_phase = 4
        else:
            # Syntax fail at the gate — no <code> block found
            state.syntax_iter += 1
            if state.syntax_iter <= 3:
                state.syntax_error_context = {
                    "attempt": state.syntax_iter,
                    "error": "No <code> block found in generator output.",
                    "broken_code": state.working_code,
                }
                state.current_phase = 3
                return
            state.add_feedback(
                {
                    "failure_tier": FailureTier.TIER_1_SYNTAX,
                    "error": "No <code> block found after 3 attempts.",
                }
            )
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.syntax_iter = 0
            state.current_phase = 2

    async def _run_phase_4(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 4: Deterministic Validation (Tier 1 & 2)."""
        await self._notify(
            client,
            Role.Validator,
            f"Ph4: Validating (Strategy {state.strategy_iter}, Syntax {state.syntax_iter})...",
            phase=4,
        )

        # Step 7: Tier 1 - Syntax
        syntax_res = self.validator.check_syntax(state.working_code)
        print(
            f"\\n--- Validator Syntax Check ---\\nIs Valid: {syntax_res['is_valid']}\\nError: {syntax_res.get('error')}\\n------------------------------"
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
                await self._notify(
                    client, Role.Validator, "Syntax Unrecoverable. Revising strategy."
                )
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

        await self._notify(
            client, Role.Validator, "Syntax OK. Running Structural Checks..."
        )

        # Step 8: Tier 2 - Structural
        findings = []

        # Check A: Complexity (per-intent routing)
        assert state.intent_packet is not None
        intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
        cc_rule = self._get_cc_rule(intent_enum)
        current_cc = state.original_complexity

        if cc_rule == "SKIP":
            pass
        elif cc_rule == "EXTRACT_RULE":
            target_method = state.intent_packet.get("scope_anchor", {}).get(
                "member", ""
            )
            if target_method:
                orig_method_cc = self.validator.get_method_complexity(
                    state.base_code, target_method
                )
                refac_method_cc = self.validator.get_method_complexity(
                    state.working_code, target_method
                )
                if orig_method_cc is not None and refac_method_cc is not None:
                    if refac_method_cc > orig_method_cc:
                        findings.append(
                            ValidationFinding(
                                failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                                error_report=ErrorReport(
                                    message=f"CC of target method '{target_method}' increased from {orig_method_cc} to {refac_method_cc}"
                                ),
                                recovery_hint="Ensure the source method's complexity decreases or stays the same after extraction.",
                            )
                        )
                elif refac_method_cc is None:
                    findings.append(
                        ValidationFinding(
                            failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                            error_report=ErrorReport(
                                message=f"Target method '{target_method}' not found in refactored code."
                            ),
                            recovery_hint="Preserve the target method name in the refactored output.",
                        )
                    )
        else:
            current_cc = self.validator.get_complexity(state.working_code)
            threshold = state.original_complexity + (1 if cc_rule == "LOOSENED" else 0)
            if current_cc > threshold:
                findings.append(
                    ValidationFinding(
                        failure_tier=FailureTier.TIER_2_A_COMPLEXITY,
                        error_report=ErrorReport(
                            message=f"CC increased from {state.original_complexity} to {current_cc} (limit: {threshold})"
                        ),
                        recovery_hint="Simplify logic to maintain or reduce complexity.",
                    )
                )

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

        boundary_finding = self.validator.verify_boundary(
            state.base_code, state.working_code, target_scopes
        )
        if boundary_finding:
            findings.append(boundary_finding)

        # Check C: Intent Math
        intent_finding = None
        if state.intent_packet:
            intent_enum = RefactorIntent(state.intent_packet["specific_intent"])
            intent_finding = self.validator.verify_intent(
                intent_enum, state.base_code, state.working_code
            )
            if intent_finding:
                findings.append(intent_finding)

        current_cc_val = (
            current_cc
            if cc_rule not in ("SKIP", "EXTRACT_RULE")
            else state.original_complexity
        )
        print(
            f"\\n--- Validator Structural Checks ---\\nComplexity Check: {current_cc_val} (Original: {state.original_complexity})\\nBoundary check found issue: {bool(boundary_finding)}\\nIntent check found issue: {bool(intent_finding)}\\nTotal findings: {len(findings)}\\n-----------------------------------"
        )
        if findings:
            current_fault_count = len(findings)
            if current_fault_count >= state.previous_fault_count:
                state.fault_stall_count += 1
            else:
                state.fault_stall_count = 0
            state.previous_fault_count = current_fault_count

            await self._notify(
                client,
                Role.Validator,
                f"Structural Checks Failed ({current_fault_count} issues).",
                content=json.dumps([f.model_dump() for f in findings]),
            )
            state.extend_feedback([f.model_dump() for f in findings])
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.syntax_iter = 0
            state.current_phase = 2
        else:
            await self._notify(client, Role.Validator, "Structural Checks Passed.")
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

    async def _run_phase_5(
        self, client: ClientConnection, state: OrchestrationState
    ) -> None:
        """Phase 5: Heuristic Adjudication (Inference 4)."""
        await self._notify(client, Role.Judge, "Ph5: Running final audit...", phase=5)
        await self.agent_service.swap(self.model_config["judge"])

        # Build plan context summary for the auditor
        intent = ""
        target_class = ""
        target_method = ""
        if state.intent_packet:
            intent = state.intent_packet.get("specific_intent", "")
            scope = state.intent_packet.get("scope_anchor", {})
            target_class = scope.get("target_class", "")
            target_method = scope.get("member", "")

        mutations = (
            state.active_plan.get("ast_mutations", []) if state.active_plan else []
        )
        mutation_actions = [m.get("action", "?") for m in mutations]
        mutation_targets = [m.get("target", "?") for m in mutations]

        plan_summary = f"Intent: {intent}. Target: {target_class}.{target_method}."
        mutations_list = (
            f"Mutations: {', '.join(f'{a}({t})' for a, t in zip(mutation_actions, mutation_targets))}"
            if mutation_actions
            else "Mutations: none"
        )

        audit_prompt = (
            f"## Plan Context\n{plan_summary}\n{mutations_list}\n\n"
            f"## Code\n"
            f"Original: <code>{state.base_code}</code>\n"
            f"Refactored: <code>{state.working_code}</code>\n"
            f"Intent: {json.dumps(state.intent_packet)}"
        )
        system_content = self.prompts["judge"]["auditor"]
        if state.intent_packet:
            intent_key = state.intent_packet.get("specific_intent", "")
            guidance = self.prompts["judge"].get("auditor_guidance", {}).get(intent_key, "")
            if guidance:
                system_content += "\n" + guidance

        messages: List[ChatCompletionRequestMessage] = [
            {"role": "system", "content": system_content},
            {"role": "user", "content": audit_prompt},
        ]

        raw = await self.agent_service.generate(
            messages,
            temp=0.1,
            max_tokens=1000,
            response_model=StructuralAuditorResponse,
        )
        audit_text = raw["choices"][0]["message"].get("content") or ""
        print(
            f"\n--- Judge Auditor Output ---\n{audit_text}\n--------------------------"
        )

        audit_res = ResponseParser.extract_json(audit_text, StructuralAuditorResponse)

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
                {"failure_tier": FailureTier.TIER_3_JUDGE, "error": audit_res.issues}
            )
            if not state.strategy_iter_incremented:
                state.strategy_iter += 1
                state.strategy_iter_incremented = True
            state.current_phase = 2

    async def _run_phase_6(
        self,
        client: ClientConnection,
        state: OrchestrationState,
        metrics: Dict[str, Any],
    ) -> None:
        """Phase 6: Finalization & Reporting."""
        await self._notify(
            client,
            Role.System,
            f"Ph6: Finalizing session (Status: {state.exit_status})...",
            phase=6,
        )

        final_code = (
            state.working_code
            if state.exit_status == ExitStatus.SUCCESS
            else state.base_code
        )

        # 1. Send immediate result (without insights)
        await client.send_result(
            final_code=final_code,
            original_complexity=state.original_complexity,
            refactored_complexity=self.validator.get_complexity(final_code),
            performance_metrics=metrics,
            planner_model=self.model_config["planner"].get("name"),
            generator_model=self.model_config["generator"].get("name"),
            judge_model=self.model_config["judge"].get("name"),
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
            insights = (
                f"Refactoring aborted: {state.exit_status}. Reverted to original code."
            )

        # 3. Send insights follow-up
        await client.send_insights(insights)

        # 4. Final DB update
        self.db.complete_session(
            id=state.session_id,
            refactored_code=final_code,
            insights=json.dumps(insights)
            if not isinstance(insights, str)
            else insights,
            original_complexity=state.original_complexity,
            refactored_complexity=self.validator.get_complexity(final_code),
            performance_metrics=metrics,
            exit_status=state.exit_status.value,
            final_intent=json.dumps(state.intent_packet),
            final_plan=json.dumps(state.active_plan),
            outer_loops=state.strategy_iter,
            inner_loops=state.syntax_iter,
            planner_model=self.model_config["planner"].get("name"),
            generator_model=self.model_config["generator"].get("name"),
            judge_model=self.model_config["judge"].get("name"),
        )

    async def generate_insights(
        self,
        user_code: str,
        refactored_code: str,
        original_complexity: int,
        refactored_complexity: int,
    ) -> Any:
        await self.agent_service.swap(self.model_config["judge"])

        prompt: str = (
            f"--- ORIGINAL CODE ---\n{user_code}\n\n"
            f"--- REFACTORED CODE ---\n{refactored_code}\n\n"
            f"Original Complexity: {original_complexity}\n"
            f"Refactored Complexity: {refactored_complexity}\n"
        )
        messages: List[ChatCompletionRequestMessage] = [
            {
                "role": "system",
                "content": self.prompts["judge"]["insights"],
            },
            {"role": "user", "content": prompt},
        ]

        raw_reponse = await self.agent_service.generate(
            messages=messages,
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
        except Exception as e:
            print(f"Failed to parse insights JSON: {e}")
            return text.strip()

    @staticmethod
    def _get_cc_rule(intent: RefactorIntent) -> str:
        rules: Dict[RefactorIntent, str] = {
            RefactorIntent.FLATTEN_CONDITIONAL: "STRICT",
            RefactorIntent.DECOMPOSE_CONDITIONAL: "STRICT",
            RefactorIntent.CONSOLIDATE_CONDITIONAL: "STRICT",
            RefactorIntent.REMOVE_CONTROL_FLAG: "STRICT",
            RefactorIntent.REPLACE_LOOP_WITH_PIPELINE: "STRICT",
            RefactorIntent.SPLIT_LOOP: "LOOSENED",
            RefactorIntent.EXTRACT_METHOD: "EXTRACT_RULE",
            RefactorIntent.INLINE_METHOD: "SKIP",
            RefactorIntent.EXTRACT_VARIABLE: "STRICT",
            RefactorIntent.INLINE_VARIABLE: "STRICT",
            RefactorIntent.EXTRACT_CONSTANT: "STRICT",
            RefactorIntent.RENAME_SYMBOL: "STRICT",
        }
        return rules.get(intent, "STRICT")

    async def _notify(
        self,
        client: ClientConnection,
        role: Role,
        message: str,
        content: Optional[str] = None,
        phase: Optional[int] = None,
        outer_loop: int = 0,
        inner_loop: int = 0,
    ) -> None:
        """Helper to print to terminal, persist to DB, and notify frontend."""
        print(f"[{role}] {message}")

        # Persist the log entry to the database in real-time
        self.db.log_status(
            session_id=client.id,
            role=role.value,
            status=message,
            content=content,
            phase=phase,
            outer_loop=outer_loop,
            inner_loop=inner_loop,
        )

        formatted_message = format_agent_output(message, content)
        await client.send_status(role=role, content=formatted_message)
