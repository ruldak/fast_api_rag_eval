from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID

from app.api.deps import get_tenant, get_async_db
from app.models import EvaluationRun, EvaluationItem, Score, MetricDefinition, Tenant
from app.schemas import CompareRequest, CompareResponse

router = APIRouter()

@router.post("/evaluations/compare", response_model=CompareResponse)
async def compare_evaluations(
    request: CompareRequest,
    db: AsyncSession = Depends(get_async_db),
    tenant: Tenant = Depends(get_tenant)
):
    result = await db.execute(
        select(EvaluationRun).where(
            EvaluationRun.id.in_(request.run_ids),
            EvaluationRun.tenant_id == tenant.id
        )
    )
    runs = result.scalars().all()
    if len(runs) != len(request.run_ids):
        raise HTTPException(status_code=400, detail="Some evaluation runs not found or not accessible")
    
    comparison = {}
    
    for run in runs:
        result = await db.execute(
            select(MetricDefinition.name, func.avg(Score.value))
            .join(Score, Score.metric_id == MetricDefinition.id)
            .join(EvaluationItem, EvaluationItem.id == Score.item_id)
            .where(
                EvaluationItem.run_id == run.id,
                Score.value != None
            )
            .group_by(MetricDefinition.name)
        )
        
        run_scores = {name: round(float(avg), 4) if avg is not None else None for name, avg in result.all()}
        comparison[str(run.id)] = {
            "status": run.status,
            "metadata": run.metadata_,
            "scores": run_scores
        }
    
    return CompareResponse(comparison=comparison)