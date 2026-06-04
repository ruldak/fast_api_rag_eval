from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
import math

from app.api.deps import get_tenant, get_async_db
from app.models import HumanReview, EvaluationItem, Score, MetricDefinition, Tenant, EvaluationRun
from app.schemas import HumanReviewRequest, HumanReviewResponse, CalibrationReport
from typing import Optional
from uuid import UUID

router = APIRouter()


@router.post("/human-reviews", response_model=HumanReviewResponse, status_code=201)
async def submit_human_review(
    request: HumanReviewRequest,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    """Submit human judgment for one item+metric. Compare with LLM score."""
    
    result = await db.execute(
        select(EvaluationItem, MetricDefinition)
        .join(EvaluationRun)
        .join(MetricDefinition, MetricDefinition.id == request.metric_id)
        .where(
            EvaluationItem.id == request.item_id,
            EvaluationRun.tenant_id == tenant.id,
            MetricDefinition.tenant_id == tenant.id
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Item or metric not found for this tenant")
    
    item, metric = row
    
    llm_result = await db.execute(
        select(Score)
        .where(
            Score.item_id == request.item_id,
            Score.metric_id == request.metric_id
        )
        .order_by(Score.created_at.desc())
    )
    latest_score = llm_result.scalar_one_or_none()
    llm_score = latest_score.value if latest_score else None
    
    agreement_delta = None
    if llm_score is not None:
        agreement_delta = round(request.human_score - llm_score, 4)
    
    review = HumanReview(
        item_id=request.item_id,
        metric_id=request.metric_id,
        human_score=request.human_score,
        human_reason=request.human_reason,
        reviewer_id=request.reviewer_id,
        llm_score=llm_score,
        agreement_delta=agreement_delta
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    
    return HumanReviewResponse(
        id=review.id,
        item_id=review.item_id,
        metric_name=metric.name,
        human_score=review.human_score,
        llm_score=review.llm_score,
        agreement_delta=review.agreement_delta,
        reviewed_at=review.reviewed_at
    )


@router.get("/calibration-report", response_model=list[CalibrationReport])
async def get_calibration_report(
    metric_name: Optional[str] = None,
    min_samples: int = 1,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    """
    Generate calibration report per metric.
	Compare human judgment vs LLM scores.
    """
    
    base_stmt = (
        select(HumanReview, MetricDefinition)
        .join(MetricDefinition)
        .where(MetricDefinition.tenant_id == tenant.id)
    )
    
    if metric_name:
        base_stmt = base_stmt.where(MetricDefinition.name == metric_name)
    
    result = await db.execute(base_stmt)
    rows = result.all()
    
    from collections import defaultdict
    metric_groups = defaultdict(list)
    for review, metric in rows:
        metric_groups[metric.name].append({
            "human": review.human_score,
            "llm": review.llm_score,
            "delta": review.agreement_delta,
            "reason": review.human_reason
        })
    
    reports = []
    for metric_name, samples in metric_groups.items():
        if len(samples) < min_samples:
            continue
        
        humans = [s["human"] for s in samples if s["llm"] is not None]
        llms = [s["llm"] for s in samples if s["llm"] is not None]
        deltas = [abs(s["human"] - s["llm"]) for s in samples if s["llm"] is not None]
        
        if not humans or not llms:
            continue
        
        n = len(humans)
        mean_h = sum(humans) / n
        mean_l = sum(llms) / n
        
        numerator = sum((h - mean_h) * (l - mean_l) for h, l in zip(humans, llms))
        denom_h = math.sqrt(sum((h - mean_h) ** 2 for h in humans))
        denom_l = math.sqrt(sum((l - mean_l) ** 2 for l in llms))
        
        correlation = None
        if denom_h > 0 and denom_l > 0:
            correlation = round(numerator / (denom_h * denom_l), 4)
        
        mae = sum(deltas) / len(deltas) if deltas else 0
        
        worst_samples = sorted(
            [s for s in samples if s["llm"] is not None],
            key=lambda x: abs(x["human"] - x["llm"]),
            reverse=True
        )[:3]
        
        reports.append(CalibrationReport(
            metric_name=metric_name,
            total_reviewed=len(samples),
            mean_human_score=round(mean_h, 4),
            mean_llm_score=round(mean_l, 4),
            mean_absolute_error=round(mae, 4),
            correlation_pearson=correlation,
            bias_detected=mae > 0.1,
            samples=[{
                "human": s["human"],
                "llm": s["llm"],
                "delta": round(abs(s["human"] - s["llm"]), 4),
                "reason": s["reason"]
            } for s in worst_samples]
        ))
    
    return reports


@router.get("/human-reviews/sample", response_model=list[dict])
async def get_sample_for_review(
    run_id: Optional[UUID] = None,
    metric_name: Optional[str] = None,
    limit: int = 30,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    """
    Take a random sample of applications that haven't been reviewed by humans for spot checks.
	Prioritize those that have been completed and have an LLM score.
    """
    from sqlalchemy.sql.expression import func as sqlfunc
    
    reviewed_subq = select(HumanReview.item_id).distinct().subquery()
    
    stmt = (
        select(EvaluationItem, Score, MetricDefinition)
        .join(EvaluationRun)
        .join(Score, Score.item_id == EvaluationItem.id)
        .join(MetricDefinition, MetricDefinition.id == Score.metric_id)
        .where(
            EvaluationRun.tenant_id == tenant.id,
            EvaluationRun.status == "completed",
            EvaluationItem.id.not_in(reviewed_subq),
            Score.value != None
        )
    )
    
    if run_id:
        stmt = stmt.where(EvaluationRun.id == run_id)
    if metric_name:
        stmt = stmt.where(MetricDefinition.name == metric_name)
    
    stmt = stmt.order_by(sqlfunc.random()).limit(limit)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    return [{
        "item_id": str(item.id),
        "query": item.query,
        "response": item.response[:500] + "..." if len(item.response) > 500 else item.response,
        "contexts": item.contexts,
        "ground_truth": item.ground_truth,
        "metric_name": metric.name,
        "llm_score": score.value,
        "llm_reason": score.details.get("reason", "") if score.details else ""
    } for item, score, metric in rows]
