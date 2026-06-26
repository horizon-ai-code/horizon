from enum import Enum, auto


class PhaseDecision(Enum):
    """Routing signal returned by each phase to the orchestrator loop.

    Phases return their decision; the orchestrator alone maps decisions
    to state.current_phase transitions.  No phase touches state.current_phase.
    """

    PROCEED = auto()          # advance to next phase
    RETRY_STRATEGY = auto()   # go back to phase 2 (strategy) — strategy_iter += 1
    RETRY_GENERATION = auto() # go back to phase 3 (execution) — syntax_iter += 1
    COMPLETE = auto()         # exit loop successfully (set exit_status = SUCCESS)
    FAIL = auto()             # exit loop with failure (set exit_status = ABORT_STRATEGY)
