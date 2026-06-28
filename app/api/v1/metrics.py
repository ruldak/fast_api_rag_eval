from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_tenant, get_async_db
from app.models import MetricDefinition, Tenant, Score
from app.schemas import (
    CreateMetricRequest, 
    UpdateMetricRequest,
    MetricResponse
)
from uuid import UUID

router = APIRouter()


@router.post("/metrics", response_model=MetricResponse, status_code=201)
async def create_metric(
    request: CreateMetricRequest,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    result = await db.execute(
        select(MetricDefinition).where(
            MetricDefinition.tenant_id == tenant.id,
            MetricDefinition.name == request.name
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Metric name already exists for this tenant")
    
    config = request.config.model_dump()
    if request.type == "custom" and config.get("prompt_template"):
        prompt_suffix = (
            '\n\nProvide a score from 0.0 to 1.0 where 1.0 means good. '
            'Output only JSON: {"score": <float>, "reason": "<explanation>"}'
        )
        config["prompt_template"] = config["prompt_template"].rstrip() + prompt_suffix

    metric = MetricDefinition(
        tenant_id=tenant.id,
        name=request.name,
        type=request.type,
        config=config
    )
    
    db.add(metric)
    await db.commit()
    await db.refresh(metric)
    
    return MetricResponse(
        id=metric.id,
        name=metric.name,
        type=metric.type,
        config=metric.config,
        created_at=metric.created_at
    )


@router.get("/metrics", response_model=list[MetricResponse])
async def list_metrics(
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    result = await db.execute(
        select(MetricDefinition).where(MetricDefinition.tenant_id == tenant.id)
    )
    metrics = result.scalars().all()
    
    return [
        MetricResponse(
            id=m.id,
            name=m.name,
            type=m.type,
            config=m.config,
            created_at=m.created_at
        )
        for m in metrics
    ]


@router.put("/metrics/{metric_id}", response_model=MetricResponse)
async def update_metric(
    metric_id: UUID,
    request: UpdateMetricRequest,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    result = await db.execute(
        select(MetricDefinition).where(
            MetricDefinition.id == metric_id,
            MetricDefinition.tenant_id == tenant.id
        )
    )
    metric = result.scalar_one_or_none()
    
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    
    # Predefined metrics cannot be modified
    if metric.type == "predefined":
        raise HTTPException(
            status_code=403, 
            detail="Predefined metrics cannot be updated. Create a custom metric instead."
        )
    
    # Check name uniqueness if changing name
    if request.name and request.name != metric.name:
        existing = await db.execute(
            select(MetricDefinition).where(
                MetricDefinition.tenant_id == tenant.id,
                MetricDefinition.name == request.name,
                MetricDefinition.id != metric_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Metric name already exists for this tenant")
        metric.name = request.name
    
    if request.config:
        metric.config = request.config.model_dump()
    
    await db.commit()
    await db.refresh(metric)
    
    return MetricResponse(
        id=metric.id,
        name=metric.name,
        type=metric.type,
        config=metric.config,
        created_at=metric.created_at
    )


@router.delete("/metrics/{metric_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_metric(
    metric_id: UUID,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    result = await db.execute(
        select(MetricDefinition).where(
            MetricDefinition.id == metric_id,
            MetricDefinition.tenant_id == tenant.id
        )
    )
    metric = result.scalar_one_or_none()
    
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    
    # Predefined metrics cannot be deleted
    if metric.type == "predefined":
        raise HTTPException(
            status_code=403, 
            detail="Predefined metrics cannot be deleted."
        )
    
    # Check if metric has been used in any evaluation scores
    scores_count = await db.execute(
        select(func.count(Score.id)).where(Score.metric_id == metric_id)
    )
    count = scores_count.scalar_one()
    
    if count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete metric: already used in {count} evaluation score(s). Delete related evaluations first."
        )
    
    await db.delete(metric)
    await db.commit()
    
    return None