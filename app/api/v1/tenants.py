from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_async_db, get_tenant
from app.models import Tenant, MetricDefinition
from app.utils.security import generate_api_key, hash_api_key
from app.schemas import TenantCreate, TenantResponse

router = APIRouter()

@router.get("/tenants/me", response_model=TenantResponse, status_code=200)
async def get_tenant(tenant: Tenant = Depends(get_tenant), db: AsyncSession = Depends(get_async_db)):
    return TenantResponse(id=str(tenant.id), name=tenant.name)

@router.post("/tenants", response_model=TenantResponse, status_code=201)
async def create_tenant(
    request: TenantCreate,
    db: AsyncSession = Depends(get_async_db)
):
    result = await db.execute(select(Tenant).where(Tenant.name == request.name))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Tenant name already exists")
    
    api_key = generate_api_key()
    tenant = Tenant(
        name=request.name,
        api_key_hash=hash_api_key(api_key)
    )
    db.add(tenant)
    await db.flush()
    
    for name in ["faithfulness", "answer_relevancy", "correctness"]:
        metric = MetricDefinition(
            tenant_id=tenant.id,
            name=name,
            type="predefined",
            config={}
        )
        db.add(metric)
    
    await db.commit()
    await db.refresh(tenant)
    
    return TenantResponse(id=str(tenant.id), name=tenant.name, api_key=api_key)
