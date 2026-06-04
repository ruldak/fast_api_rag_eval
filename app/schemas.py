from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime

class EvaluationRunSummary(BaseModel):
    run_id: UUID
    status: str
    metadata: Dict[str, Any]
    item_count: int
    created_at: datetime
    updated_at: datetime

class EvaluationListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[EvaluationRunSummary]

class EvaluateItem(BaseModel):
    query: str
    response: str
    contexts: List[str] = Field(default_factory=list)
    ground_truth: Optional[str] = None

class EvaluateRequest(BaseModel):
    metadata: Dict[str, Any] = Field(default_factory=dict)
    items: List[EvaluateItem]
    metrics: List[str]

class EvaluateResponse(BaseModel):
    run_id: UUID
    status: str

class SingleEvaluateRequest(BaseModel):
    metadata: Dict[str, Any] = Field(default_factory=dict)
    item: EvaluateItem
    metrics: List[str]

class ScoreDetail(BaseModel):
    value: Optional[float]
    details: Dict[str, Any]

class ItemResult(BaseModel):
    item_id: UUID
    query: str
    response: str
    scores: Dict[str, ScoreDetail]

class EvaluationResult(BaseModel):
    run_id: UUID
    status: str
    summary: Dict[str, Optional[float]]
    items: List[ItemResult]

class CompareRequest(BaseModel):
    run_ids: List[UUID]

class CompareResponse(BaseModel):
    comparison: Dict[str, Dict[str, Any]]

class CustomMetricConfig(BaseModel):
    prompt_template: str
    model: str = "llama-3.1-8b-instant"
    output_schema: Dict[str, str]
    temperature: float = 0.0

class UpdateMetricRequest(BaseModel):
    name: Optional[str] = None
    config: Optional[CustomMetricConfig] = None

class CreateMetricRequest(BaseModel):
    name: str
    type: str = "custom"
    config: CustomMetricConfig

class MetricResponse(BaseModel):
    id: UUID
    name: str
    type: str
    config: Dict[str, Any]
    created_at: datetime

class TenantCreate(BaseModel):
    name: str

class TenantResponse(BaseModel):
    id: str
    name: str
    api_key: Optional[str] = None

class HumanReviewRequest(BaseModel):
    item_id: UUID
    metric_id: UUID
    human_score: float = Field(..., ge=0.0, le=1.0)
    human_reason: Optional[str] = None
    reviewer_id: str

class HumanReviewResponse(BaseModel):
    id: UUID
    item_id: UUID
    metric_name: str
    human_score: float
    llm_score: Optional[float]
    agreement_delta: Optional[float]
    reviewed_at: datetime

class CalibrationReport(BaseModel):
    metric_name: str
    total_reviewed: int
    mean_human_score: float
    mean_llm_score: float
    mean_absolute_error: float
    correlation_pearson: Optional[float]
    bias_detected: bool
    samples: List[Dict[str, Any]]
