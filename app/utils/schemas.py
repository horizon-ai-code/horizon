from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import UUID4, BaseModel, Field

from .types import (
    ExitStatus,
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
    content: Optional[str] = None
    created_at: datetime


class HistoryStub(BaseModel):
    id: UUID4
    user_instruction: str


class HistoryDetail(BaseModel):
    id: UUID4
    user_instruction: str
    original_code: str
    refactored_code: Optional[str] = None
    insights: Optional[Any] = None
    original_complexity: Optional[int] = None
    refactored_complexity: Optional[int] = None
    planner_model: Optional[str] = None
    generator_model: Optional[str] = None
    judge_model: Optional[str] = None
    avg_gpu_utilization: Optional[float] = None
    avg_gpu_memory: Optional[float] = None
    avg_gpu_memory_used: Optional[float] = None
    inference_time: Optional[float] = None
    created_at: datetime
    logs: List[LogEntry]


class DeleteResponse(BaseModel):
    status: str
    message: str


# --- New Orchestration Schemas ---


class RefactorInsight(BaseModel):
    title: str
    details: str


class RefactorInsightsResponse(BaseModel):
    insights: List[RefactorInsight]


class ScopeAnchor(BaseModel):
    target_class: Optional[str] = Field(default=None, alias="class")
    member: Optional[str] = None
    unit_type: StructureUnit

    class Config:
        populate_by_name = True


class IntentPacket(BaseModel):
    refactor_category: RefactorCategory
    specific_intent: RefactorIntent
    scope_anchor: ScopeAnchor


class IntentClassifierResponse(BaseModel):
    classification_scratchpad: str
    intent_packet: IntentPacket


class ASTMutationDetails(BaseModel):
    modifiers: List[str] = []
    type: Optional[str] = None
    parameters: List[Dict[str, str]] = []
    logic_changes: List[str] = []
    body_abstract: Optional[str] = None


class ASTMutation(BaseModel):
    action: MutationAction  # e.g., ADD_METHOD, REMOVE_METHOD
    target: str
    details: ASTMutationDetails


class ASTModificationPlan(BaseModel):
    target_class: str
    ast_mutations: List[ASTMutation]


class ASTArchitectResponse(BaseModel):
    architect_scratchpad: str
    ast_modification_plan: ASTModificationPlan


class AuditTrace(BaseModel):
    original: str
    refactored: str
    mapping: Optional[str] = None


class AuditScratchpad(BaseModel):
    variable_trace: List[AuditTrace]
    logic_comparison: str


class StructuralAuditorResponse(BaseModel):
    audit_scratchpad: AuditScratchpad
    verdict: Literal["ACCEPT", "REVISE"]
    issues: List[str]


class ErrorReport(BaseModel):
    message: str
    faulty_node: Optional[str] = None
    actual_value: Optional[Any] = None
    required_value: Optional[Any] = None


class ValidationFinding(BaseModel):
    failure_tier: FailureTier
    error_report: ErrorReport
    recovery_hint: str


class ValidationFeedback(BaseModel):
    total_faults: int
    is_recoverable: bool
    findings: List[ValidationFinding]
