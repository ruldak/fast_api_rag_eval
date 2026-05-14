from fastapi import Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_async_db
from app.models import Tenant
from app.utils.security import hash_api_key

async def get_tenant(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: AsyncSession = Depends(get_async_db)
) -> Tenant:
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header required")
    
    key_hash = hash_api_key(x_api_key)
    result = await db.execute(select(Tenant).where(Tenant.api_key_hash == key_hash))
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return tenant