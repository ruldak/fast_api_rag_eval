from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID

from app.api.deps import get_tenant, get_async_db
from app.models import EvaluationRun, EvaluationItem, MetricDefinition, Score, Tenant
from app.schemas import (
    EvaluateRequest, EvaluateResponse, SingleEvaluateRequest,
    EvaluationResult, ItemResult, ScoreDetail, EvaluationListResponse, EvaluationRunSummary
)
from app.tasks.evaluator import run_evaluation
from typing import Optional

router = APIRouter()

async def _create_evaluation(
    db: AsyncSession,
    tenant: Tenant,
    metadata: dict,
    items: list,
    metrics: list
) -> EvaluateResponse:
    metric_names = set(metrics)
    result = await db.execute(
        select(MetricDefinition).where(
            MetricDefinition.tenant_id == tenant.id,
            MetricDefinition.name.in_(metric_names)
        )
    )
    found_metrics = {m.name for m in result.scalars().all()}
    missing = metric_names - found_metrics
    if missing:
        raise HTTPException(status_code=400, detail=f"Metrics not found: {missing}")
    
    run = EvaluationRun(
        tenant_id=tenant.id,
        status="pending",
        metadata_={**metadata, "requested_metrics": metrics}
    )
    db.add(run)
    await db.flush()
    
    for item in items:
        db_item = EvaluationItem(
            run_id=run.id,
            query=item.query,
            response=item.response,
            contexts=item.contexts,
            ground_truth=item.ground_truth,
            payload_raw=item.model_dump()
        )
        db.add(db_item)
    
    await db.commit()
    run_evaluation.delay(str(run.id))
    
    return EvaluateResponse(run_id=run.id, status="pending")

@router.post("/evaluate", response_model=EvaluateResponse, status_code=202)
async def evaluate_batch(
    request: EvaluateRequest,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    return await _create_evaluation(db, tenant, request.metadata, request.items, request.metrics)

@router.post("/evaluate/single", response_model=EvaluateResponse, status_code=202)
async def evaluate_single(
    request: SingleEvaluateRequest,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    return await _create_evaluation(db, tenant, request.metadata, [request.item], request.metrics)

@router.get("/evaluations/{run_id}", response_model=EvaluationResult)
async def get_evaluation(
    run_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    result = await db.execute(
        select(EvaluationRun)
        .where(EvaluationRun.id == run_id, EvaluationRun.tenant_id == tenant.id)
        .options(
            selectinload(EvaluationRun.items)
            .selectinload(EvaluationItem.scores)
            .selectinload(Score.metric)
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Evaluation run not found")
    
    summary = {}
    items_data = []
    
    for item in run.items:
        scores_data = {}
        for score in item.scores:
            metric_name = score.metric.name
            scores_data[metric_name] = ScoreDetail(
                value=score.value,
                details=score.details
            )
            if metric_name not in summary:
                summary[metric_name] = []
            if score.value is not None:
                summary[metric_name].append(score.value)
        
        items_data.append(ItemResult(
            item_id=item.id,
            query=item.query,
            response=item.response,
            scores=scores_data
        ))
    
    final_summary = {}
    for metric_name, values in summary.items():
        if values:
            final_summary[metric_name] = sum(values) / len(values)
        else:
            final_summary[metric_name] = None
    
    return EvaluationResult(
        run_id=run.id,
        status=run.status,
        summary=final_summary,
        items=items_data
    )

@router.get("/evaluations", response_model=EvaluationListResponse)
async def list_evaluations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    # Base query dengan filter tenant
    base_stmt = select(EvaluationRun).where(EvaluationRun.tenant_id == tenant.id)
    count_stmt = select(func.count(EvaluationRun.id)).where(EvaluationRun.tenant_id == tenant.id)
    
    # Filter status jika diberikan
    if status:
        base_stmt = base_stmt.where(EvaluationRun.status == status)
        count_stmt = count_stmt.where(EvaluationRun.status == status)
    
    # Hitung total
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()
    
    # Ambil data dengan pagination + eager load item count
    stmt = (
        base_stmt
        .options(selectinload(EvaluationRun.items))
        .order_by(desc(EvaluationRun.created_at))
        .limit(limit)
        .offset(offset)
    )
    
    result = await db.execute(stmt)
    runs = result.scalars().all()
    
    items = []
    for run in runs:
        items.append(EvaluationRunSummary(
            run_id=run.id,
            status=run.status,
            metadata=run.metadata_,
            item_count=len(run.items),
            created_at=run.created_at,
            updated_at=run.updated_at
        ))
    
    return EvaluationListResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=items
    )
