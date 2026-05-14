import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings

async_engine = create_async_engine(
    os.getenv("DATABASE_URL", settings.DATABASE_URL), 
    echo=False, 
    future=True
)
AsyncSessionLocal = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

sync_engine = create_engine(
    os.getenv("DATABASE_URL_SYNC", settings.DATABASE_URL_SYNC), 
    echo=False, 
    future=True
)
SyncSessionLocal = sessionmaker(bind=sync_engine)

async def get_async_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

def get_sync_db():
    session = SyncSessionLocal()
    try:
        yield session
    finally:
        session.close()