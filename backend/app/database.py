import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.config import settings

logger = logging.getLogger(__name__)

async_engine = create_async_engine(
    os.getenv("DATABASE_URL", settings.DATABASE_URL),
    echo=settings.is_development,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

sync_engine = create_engine(
    os.getenv("DATABASE_URL_SYNC", settings.DATABASE_URL_SYNC),
    echo=settings.is_development,
    future=True,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
)

SyncSessionLocal = sessionmaker(bind=sync_engine)

async def get_async_db():
    """Dependency for FastAPI async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def get_sync_db():
    """Dependency for synchronous database session."""
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

async def check_database_connection() -> bool:
    """Checks database connection during startup."""
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {e}")
        return False