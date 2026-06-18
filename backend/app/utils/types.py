from enum import Enum
from typing import Literal

from pydantic import BaseModel, field_validator


class OrchestrationMode(str, Enum):
    SINGLE = "single"
    MULTI = "multi"


class RefactorRequest(BaseModel):
    type: Literal["multi"] = "multi"  # type: ignore[assignment]
    code: str
    user_instruction: str
    mode: OrchestrationMode = OrchestrationMode.MULTI

    @field_validator("code")
    @classmethod
    def code_min_length(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Code must be at least 10 characters")
        if len(v) > 100_000:
            raise ValueError("Code exceeds maximum length of 100KB")
        return v

    @field_validator("user_instruction")
    @classmethod
    def instruction_not_empty(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped or len(stripped) < 3:
            raise ValueError("Instruction must be at least 3 characters")
        if len(v) > 10_000:
            raise ValueError("Instruction exceeds maximum length of 10KB")
        return v


class HaltRequest(BaseModel):
    type: Literal["halt"]


class Role(str, Enum):
    Planner = "Planner"
    Generator = "Generator"
    Judge = "Judge"
    Validator = "Validator"
    System = "System"
    Monolith = "Monolith"


class RefactorCategory(str, Enum):
    CONTROL_FLOW = "CONTROL_FLOW"
    METHOD_MOVEMENT = "METHOD_MOVEMENT"
    STATE_MANAGEMENT = "STATE_MANAGEMENT"


class RefactorIntent(str, Enum):
    # CONTROL_FLOW
    FLATTEN_CONDITIONAL = "FLATTEN_CONDITIONAL"
    DECOMPOSE_CONDITIONAL = "DECOMPOSE_CONDITIONAL"
    CONSOLIDATE_CONDITIONAL = "CONSOLIDATE_CONDITIONAL"
    REMOVE_CONTROL_FLAG = "REMOVE_CONTROL_FLAG"
    REPLACE_LOOP_WITH_PIPELINE = "REPLACE_LOOP_WITH_PIPELINE"
    SPLIT_LOOP = "SPLIT_LOOP"

    # METHOD_MOVEMENT
    EXTRACT_METHOD = "EXTRACT_METHOD"
    INLINE_METHOD = "INLINE_METHOD"

    # STATE_MANAGEMENT
    EXTRACT_VARIABLE = "EXTRACT_VARIABLE"
    INLINE_VARIABLE = "INLINE_VARIABLE"
    EXTRACT_CONSTANT = "EXTRACT_CONSTANT"
    RENAME_SYMBOL = "RENAME_SYMBOL"


class StructureUnit(str, Enum):
    CLASS_UNIT = "CLASS_UNIT"
    METHOD_UNIT = "METHOD_UNIT"
    STATEMENT_UNIT = "STATEMENT_UNIT"


class ExitStatus(str, Enum):
    SUCCESS = "SUCCESS"
    ABORT_SYNTAX = "ABORT_SYNTAX"
    ABORT_STRATEGY = "ABORT_STRATEGY"
    ABORT_SEMANTIC = "ABORT_SEMANTIC"
    PROCESSING = "PROCESSING"


class FailureTier(str, Enum):
    TIER_1_SYNTAX = "TIER_1_SYNTAX"
    TIER_2_A_COMPLEXITY = "TIER_2_A_COMPLEXITY"
    TIER_2_B_BOUNDARY = "TIER_2_B_BOUNDARY"
    TIER_2_C_INTENT_MATH = "TIER_2_C_INTENT_MATH"
    TIER_3_JUDGE = "TIER_3_JUDGE"


class DeclarationScope(str, Enum):
    LOCAL = "local"
    FIELD = "field"
    STATIC_FINAL = "static_final"


class MutationAction(str, Enum):
    ADD_METHOD = "ADD_METHOD"
    REMOVE_METHOD = "REMOVE_METHOD"
    MODIFY_METHOD = "MODIFY_METHOD"
    ADD_FIELD = "ADD_FIELD"
    ADD_DECLARATION = "ADD_DECLARATION"
    REMOVE_FIELD = "REMOVE_FIELD"
    ADD_CONSTANT = "ADD_CONSTANT"
    ADD_ENUM = "ADD_ENUM"
    RENAME_SYMBOL = "RENAME_SYMBOL"
    SPLIT_BODY = "SPLIT_BODY"
