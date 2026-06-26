import asyncio
import logging
from typing import Any

import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)

from app.modules.agent import AgentService
from app.modules.connection import ClientConnection
from app.modules.context import DatabaseManager
from app.modules.validator import Validator
from app.utils.paths import MODELS_CONFIG_PATH, PROMPTS_CONFIG_PATH
from app.utils.performance import PerformanceTracker
from app.utils.types import ExitStatus, Role

from .config import OrchestrationConfig
from .phases import PhaseDecision
from .phases.phase2_strategy import Phase2Strategy
from .phases.phase3_execution import Phase3Execution
from .phases.phase4_validation import Phase4Validation
from .phases.phase5_adjudication import Phase5Adjudication
from .phases.phase6_finalization import Phase6Finalization
from .phases.single_refactor import SingleRefactor


class OrchestrationState(BaseModel):
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

    original_complexity: int = 0

    def add_feedback(self, entry: dict) -> None:
        self.cumulative_feedback.append(entry)
        if len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)

    def extend_feedback(self, entries: list[dict]) -> None:
        self.cumulative_feedback.extend(entries)
        while len(self.cumulative_feedback) > self.feedback_cap:
            self.cumulative_feedback.pop(0)


class Orchestrator:
    def __init__(
        self,
        agent_service: AgentService,
        validator: Validator,
        db: DatabaseManager,
        config: OrchestrationConfig | None = None,
    ) -> None:
        self.agent_service: AgentService = agent_service
        self.validator: Validator = validator
        self.db: DatabaseManager = db
        self.current_client: ClientConnection | None = None

        try:
            self._config = config or OrchestrationConfig.from_yaml(MODELS_CONFIG_PATH)
            with open(PROMPTS_CONFIG_PATH) as p_config:
                self.prompts: dict[str, Any] = yaml.safe_load(p_config) or {}
        except (yaml.YAMLError, FileNotFoundError, PermissionError) as e:
            logger.critical("Fatal: Failed to load config: %s", e)
            raise

        self._phase2 = Phase2Strategy(
            self.agent_service, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=2),
        )
        self._phase3 = Phase3Execution(
            self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=3),
        )
        self._phase4 = Phase4Validation(
            self.validator,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=4),
        )
        self._phase5 = Phase5Adjudication(
            self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=5),
        )
        self._phase6 = Phase6Finalization(
            self.db, self.agent_service, self.validator, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=6),
        )
        self._single = SingleRefactor(
            self.agent_service, self.validator, self.db, self._config, self.prompts,
            lambda c, r, m, ct=None: self._notify(c, r, m, content=ct, phase=1),
        )

    async def execute_orchestration(self, client: ClientConnection, user_code: str, user_instruction: str) -> None:
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

            await self._notify(
                client, Role.Validator, "Baseline: Analyzing code structure...",
                phase=1,
                planner_model=self._config.planner.name,
                generator_model=self._config.generator.name,
                judge_model=self._config.judge.name,
            )
            state.original_complexity = self.validator.get_complexity(state.base_code)
            state.current_phase = 2

            while state.exit_status == ExitStatus.PROCESSING:
                if state.current_phase == 2:
                    decision = await self._phase2.run(client, state)
                elif state.current_phase == 3:
                    should_sequential = (
                        state.strategy_iter == 1
                        and not state.syntax_error_context
                        and state.active_plan
                        and len(state.active_plan.get("ast_mutations", [])) > 1
                    )
                    if should_sequential:
                        decision = await self._phase3.run_sequential(client, state)
                        if decision != PhaseDecision.PROCEED:
                            state.working_code = state.base_code
                            state.mutation_index = 0
                            state.mutation_queue = []
                            state.sequential_attempts = 0
                            decision = await self._phase3.run_single(client, state)
                        else:
                            state.current_phase = 4
                            continue
                    else:
                        decision = await self._phase3.run_single(client, state)
                elif state.current_phase == 4:
                    decision = await self._phase4.run(client, state)
                elif state.current_phase == 5:
                    decision = await self._phase5.run(client, state)
                elif state.current_phase == 6:
                    break

                match decision:
                    case PhaseDecision.PROCEED:
                        state.current_phase += 1
                    case PhaseDecision.RETRY_STRATEGY:
                        state.current_phase = 2
                    case PhaseDecision.RETRY_GENERATION:
                        state.current_phase = 3
                    case PhaseDecision.COMPLETE:
                        state.exit_status = ExitStatus.SUCCESS
                        state.current_phase = 6
                        break
                    case PhaseDecision.FAIL:
                        state.exit_status = ExitStatus.ABORT_STRATEGY
                        state.current_phase = 6
                        break

                if state.strategy_iter > 3:
                    state.exit_status = ExitStatus.ABORT_STRATEGY
                    state.current_phase = 6
                    break

            await tracker.stop_tracking()
            performance_metrics = tracker.get_metrics()
            await self._phase6.run(client, state, performance_metrics)

        except asyncio.CancelledError:
            await tracker.stop_tracking()
            self.db.mark_as_halted(client.id)
            await self._notify(client, Role.System, "Process halted.")
            raise
        except Exception as e:
            await tracker.stop_tracking()
            logger.exception("Orchestration Error: %s", e)
            try:
                await client.send_status(role=Role.System, content=f"Error: {str(e)[:200]}")
            except Exception:
                pass
            raise
        finally:
            await self.agent_service.unload()

    async def run_single_refactor(self, client: ClientConnection, user_code: str, user_instruction: str) -> None:
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
        logger.info("[%s] %s", role, message)

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

        formatted_message = f"{message}\n\n{content}" if content else message

        await effective.send_status(
            role=role, content=formatted_message,
            planner_model=planner_model,
            generator_model=generator_model,
            judge_model=judge_model,
        )
