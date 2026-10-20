"""Six-phase orchestration pipeline for multi-model Java refactoring."""

import asyncio
from typing import Any

import yaml
from pydantic import BaseModel

from app.modules.agent import AgentService
from app.modules.connection import ClientConnection
from app.modules.context import DatabaseManager
from app.modules.validator import Validator
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.performance import PerformanceTracker
from app.utils.types import ExitStatus, Role

from .config import OrchestrationConfig
from .phases.phase2_strategy import Phase2Strategy
from .phases.phase3_execution import Phase3Execution
from .phases.phase4_validation import Phase4Validation
from .phases.phase5_adjudication import Phase5Adjudication
from .phases.phase6_finalization import Phase6Finalization
from .phases.single_refactor import SingleRefactor


class OrchestrationState(BaseModel):
    """Mutable state shared by all orchestration phases.

    Attributes:
        intent_packet: Classified intent and scope produced by the planner.
        active_plan: Mutation plan currently being executed.
        strategy_iter: Outer strategy loop counter, capped at three.
        syntax_iter: Inner syntax-healing loop counter, capped at three.
        cumulative_feedback: Bounded history of failure feedback.
        syntax_error_context: Details used to heal the next generation pass.
        mutation_queue: Remaining mutations for sequential execution.
        architect_analysis: Structural analysis produced before planning.
        current_phase: Phase number that should run next.
        exit_status: Lifecycle status of the orchestration run.
        flagged_phases: Phases that reported a failure for the flow diagram.
        original_complexity: Baseline cyclomatic complexity.
    """

    session_id: str
    base_code: str
    working_code: str
    user_instruction: str

    intent_packet: dict | None = None
    active_plan: dict | None = None

    strategy_iter: int = 1
    strategy_iter_incremented: bool = False
    syntax_iter: int = 0

    cumulative_feedback: list[dict] = []
    feedback_cap: int = 3

    syntax_error_context: dict | None = None
    structural_fix_attempts: int = 0

    mutation_queue: list[dict] = []
    mutation_index: int = 0
    sequential_attempts: int = 0
    gen_timings: list[dict] = []

    architect_analysis: dict | None = None

    current_phase: int = 1
    exit_status: ExitStatus = ExitStatus.PROCESSING

    flagged_phases: set[int] = set()

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


class Orchestrator:
    """Coordinates phase runners and drives the orchestration loop."""

    SKIP_JUDGE: bool = False

    def __init__(
        self,
        agent_service: AgentService,
        validator: Validator,
        db: DatabaseManager,
        skip_judge: bool = False,
        config: OrchestrationConfig | None = None,
    ) -> None:
        """Creates phase runners and loads model and prompt configuration.

        Raises:
            yaml.YAMLError: If configuration files cannot be parsed.
            OSError: If configuration files cannot be read.
        """
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
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=2),  # type: ignore[misc]
        )
        self._phase3 = Phase3Execution(
            self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=3),  # type: ignore[misc]
        )
        self._phase4 = Phase4Validation(
            self.validator,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=4),  # type: ignore[misc]
        )
        self._phase5 = Phase5Adjudication(
            self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=5),  # type: ignore[misc]
        )
        self._phase6 = Phase6Finalization(
            self.db, self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=6),  # type: ignore[misc]
        )
        self._single = SingleRefactor(
            self.agent_service, self.validator, self.db, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=1),  # type: ignore[misc]
            get_client=self._current_client,
        )

    async def execute_orchestration(
        self, client: ClientConnection, user_code: str, user_instruction: str, force_proceed: bool = False
    ) -> None:
        """Main orchestration loop.

        Runs 6 phases sequentially: Baseline → Strategy → Execution →
        Validation → Adjudication → Finalization. Handles retries,
        cancellation, and performance tracking.

        Notes:
            The live client is re-resolved at each phase boundary so a mid-run
            reconnect receives downstream events. Multi-mutation plans are
            applied sequentially on the first strategy iteration; a failed
            sequential run is discarded and retried single-shot. Invalid
            baseline code aborts with ``ABORT_INPUT`` unless ``force_proceed``
            is set.
        """
        self.current_client = client
        tracker = PerformanceTracker()
        await tracker.start_tracking()

        state = OrchestrationState(
            session_id=str(client.id),
            base_code=user_code,
            working_code=user_code,
            user_instruction=user_instruction,
        )

        self.state = state

        try:
            self.db.create_session(
                id=state.session_id,
                instruction=state.user_instruction,
                original_code=state.base_code,
            )

            semantic_valid, semantic_msg = self.validator.check_semantics(state.base_code)
            syntax_result = self.validator.check_syntax(state.base_code)
            syntax_valid = syntax_result["is_valid"]

            if (not semantic_valid or not syntax_valid) and not force_proceed:
                warning_msg = semantic_msg if not semantic_valid else "Syntax error detected in input code. Validation will likely fail."

                await client.websocket.send_json({"type": "warning", "message": warning_msg})

                self.db.complete_session(
                    id=state.session_id,
                    refactored_code=state.base_code,
                    insights=[
                        {"title": "Pre-existing Errors", "details": "The baseline code provided contains syntax or semantic errors."},
                        {"title": "Process Halted", "details": "Refactoring cannot proceed safely on broken code."},
                        {"title": "Safe Rollback", "details": "Your original code has been fully preserved."},
                        {"title": "Action Required", "details": "Please ensure the code cleanly compiles before attempting to refactor."}
                    ],
                    original_complexity=1,
                    refactored_complexity=1,
                    performance_metrics={},
                    exit_status="ABORT_INPUT"
                )
                return

            state.original_complexity = self.validator.get_complexity(state.base_code)
            lines_count = len(state.base_code.splitlines())
            await self._notify(
                client, Role.Validator,
                f"Baseline: Structural analysis complete (Cyclomatic Complexity: {state.original_complexity}, Lines: {lines_count})",
                f"Cyclomatic Complexity: {state.original_complexity}\nLines of Code: {lines_count}",
                phase=1,
                planner_model=self._config.planner.name,
                generator_model=self._config.generator.name,
                judge_model=self._config.judge.name,
            )
            state.current_phase = 2

            while state.exit_status == ExitStatus.PROCESSING:
                flag_prev = state.current_phase

                client = self._current_client(client)

                if state.current_phase == 2:
                    await self._run_phase_2(client, state)
                elif state.current_phase == 3:
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
                            await self._current_client(client).send_phase_states(
                                **self._compute_phase_states(state)
                            )
                            continue
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

                if state.strategy_iter_incremented:
                    state.flagged_phases.add(flag_prev)
                if state.syntax_iter > 0:
                    state.flagged_phases.add(4)
                if state.structural_fix_attempts > 0:
                    state.flagged_phases.add(4)

                await self._current_client(client).send_phase_states(
                    **self._compute_phase_states(state)
                )

                if state.strategy_iter > 3:
                    state.exit_status = ExitStatus.ABORT_STRATEGY
                    state.current_phase = 6
                    await self._current_client(client).send_phase_states(
                        **self._compute_phase_states(state)
                    )
                    break

            await tracker.stop_tracking()
            performance_metrics = tracker.get_metrics()

            client = self._current_client(client)
            await self._run_phase_6(client, state, performance_metrics)

        except asyncio.CancelledError:
            await tracker.stop_tracking()
            self.db.mark_as_halted(client.id)
            await self._notify(client, Role.System, "Process halted.")
            raise
        except Exception as e:
            await tracker.stop_tracking()
            print(f"Orchestration Error: {e}")
            self.db.mark_as_failed(client.id, f"Orchestration failed: {str(e)[:200]}")
            raise e
        finally:
            await self.agent_service.unload()

    async def _run_phase_2(self, client, state):
        """Runs the strategy phase."""
        await self._phase2.run(client, state)

    async def _run_phase_3(self, client, state):
        """Runs the single-shot execution phase."""
        await self._phase3.run_single(client, state)

    async def _run_sequential_phase_3(self, client, state):
        """Runs the sequential mutation execution phase."""
        await self._phase3.run_sequential(client, state)

    async def _run_phase_4(self, client, state):
        """Runs the validation phase."""
        await self._phase4.run(client, state)

    async def _run_phase_5(self, client: ClientConnection, state: OrchestrationState) -> None:
        """Runs the adjudication phase."""
        await self._phase5.run(client, state)

    def _compute_phase_states(self, state: OrchestrationState) -> dict:
        """Computes per-phase status for the flow diagram.

        Notes:
            Failure attribution follows priority order: judge, validation,
            execution, then strategy exhaustion.
        """
        from app.utils.types import ExitStatus

        states: dict[int, str] = {}
        failed: int | None = None

        if state.exit_status not in (ExitStatus.PROCESSING, ExitStatus.SUCCESS):
            if 5 in state.flagged_phases:
                failed = 5
            elif 4 in state.flagged_phases:
                failed = 4
            elif 3 in state.flagged_phases:
                failed = 3
            else:
                failed = 2

        for p in range(1, 7):
            if state.exit_status == ExitStatus.PROCESSING:
                if p == state.current_phase:
                    states[p] = "active"
                elif p in state.flagged_phases:
                    states[p] = "flagged"
                elif p < state.current_phase:
                    states[p] = "done_ok"
                else:
                    states[p] = "waiting"
            else:
                if p == 6:
                    states[p] = "done_ok" if state.exit_status == ExitStatus.SUCCESS else "done_fail"
                elif p == failed:
                    states[p] = "done_fail"
                elif p in state.flagged_phases:
                    states[p] = "flagged"
                elif p < state.current_phase or (p == state.current_phase and state.exit_status == ExitStatus.SUCCESS):
                    states[p] = "done_ok"
                else:
                    states[p] = "skipped"

        return {
            "states": {str(k): v for k, v in states.items()},
            "failing_phase": failed,
            "strategy_iteration": state.strategy_iter,
            "syntax_heal_attempt": state.syntax_iter,
        }

    async def _run_phase_6(
        self,
        client: ClientConnection,
        state: OrchestrationState,
        metrics: dict[str, Any],
    ) -> None:
        """Sends final phase states and finalizes the session."""
        phase_data = self._compute_phase_states(state)
        await self._current_client(client).send_phase_states(**phase_data)
        await self._phase6.run(client, state, metrics, phase_data)

    def _current_client(self, client: ClientConnection) -> ClientConnection:
        """FR-011: resolve the live connection for a send.

        A mid-run reconnect (browser refresh) swaps ``self.current_client``;
        direct sends must target the swapped-in connection, not the stale one
        captured when the run started.
        """
        return self.current_client or client

    async def run_single_refactor(self, client: ClientConnection, user_code: str, user_instruction: str) -> None:
        """Thin wrapper — delegates to SingleRefactor.run() inside the lock."""
        self.current_client = client
        await self._single.run(client, user_code, user_instruction)

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
        """Prints, persists, and sends a status message to the live client.

        Notes:
            The live client reference is resolved once per call. A reconnect
            swaps ``current_client`` between calls, so the next notification
            goes to the new connection.
        """
        print(f"[{role}] {message}")

        effective = self.current_client or client

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
