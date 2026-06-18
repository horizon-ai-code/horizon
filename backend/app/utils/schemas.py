from datetime import datetime
from typing import Any, Literal

from pydantic import UUID4, BaseModel, ConfigDict, Field

from .types import (
    DeclarationScope,
    FailureTier,
    MutationAction,
    RefactorCategory,
    RefactorIntent,
    Role,
    StructureUnit,
)


class LogEntry(BaseModel):
    role: Role
    status: str
    content: str | None = None
    created_at: datetime


class HistoryStub(BaseModel):
    id: UUID4
    user_instruction: str
    created_at: datetime
    status: str | None = None


class HistoryDetail(BaseModel):
    id: UUID4
    user_instruction: str
    original_code: str
    refactored_code: str | None = None
    insights: str | None = None
    status: str | None = None
    exit_status: str | None = None
    original_complexity: int | None = None
    refactored_complexity: int | None = None
    planner_model: str | None = None
    generator_model: str | None = None
    judge_model: str | None = None
    avg_gpu_utilization: float | None = None
    avg_gpu_memory: float | None = None
    avg_gpu_memory_used: float | None = None
    peak_gpu_utilization: float | None = None
    peak_gpu_memory_used: float | None = None
    inference_time: float | None = None
    created_at: datetime
    logs: list[LogEntry]


class DeleteResponse(BaseModel):
    status: str
    message: str


# --- New Orchestration Schemas ---


class RefactorInsight(BaseModel):
    title: str
    details: str


class RefactorInsightsResponse(BaseModel):
    insights: list[RefactorInsight]


class ScopeAnchor(BaseModel):
    target_class: str | None = Field(default=None, alias="class")
    member: str | None = None
    unit_type: StructureUnit

    model_config = ConfigDict(populate_by_name=True)


class IntentPacket(BaseModel):
    refactor_category: RefactorCategory
    specific_intent: RefactorIntent
    scope_anchor: ScopeAnchor


class IntentClassifierResponse(BaseModel):
    classification_scratchpad: str
    intent_packet: IntentPacket


class ASTMutationDetails(BaseModel):
    modifiers: list[str] = []
    type: str | None = None
    scope: DeclarationScope | None = None
    parameters: list[dict[str, str]] = []
    logic_changes: list[str] = []
    body_abstract: str | None = None

    # Atomic value for ADD_CONSTANT / ADD_FIELD / ADD_DECLARATION
    value: str | None = None           # e.g., "10000", "3.14159", "true"


class ASTMutation(BaseModel):
    action: MutationAction  # e.g., ADD_METHOD, REMOVE_METHOD
    target: str
    details: ASTMutationDetails


class ASTModificationPlan(BaseModel):
    target_class: str
    ast_mutations: list[ASTMutation] = Field(max_length=5)


class ASTArchitectResponse(BaseModel):
    architect_scratchpad: str
    ast_modification_plan: ASTModificationPlan

class AuditTrace(BaseModel):
    original: str
    refactored: str
    mapping: str | None = None


class AuditScratchpad(BaseModel):
    variable_trace: list[AuditTrace] = []
    logic_comparison: str = ""


class AuditIssue(BaseModel):
    issue_type: Literal["IDENTICAL_CODE", "LOGIC_DRIFT", "SEMANTIC_DRIFT"]
    description: str = Field(max_length=100)


class StructuralAuditorResponse(BaseModel):
    audit_scratchpad: AuditScratchpad
    verdict: Literal["ACCEPT", "REVISE"]
    issues: list[AuditIssue]


class ErrorReport(BaseModel):
    message: str
    faulty_node: str | None = None
    actual_value: Any | None = None
    required_value: Any | None = None


class ValidationFinding(BaseModel):
    failure_tier: FailureTier
    error_report: ErrorReport
    recovery_hint: str


class ValidationFeedback(BaseModel):
    total_faults: int
    is_recoverable: bool
    findings: list[ValidationFinding]


class ArchitectAnalysisResponse(BaseModel):
    analysis_scratchpad: str
    primary_targets: list[str] = []
    secondary_targets: list[str] = []
    new_structures_needed: list[str] = []
    must_preserve: list[str] = []



