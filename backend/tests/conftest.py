import os
import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import patch, MagicMock
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import text, select, create_engine
from sqlalchemy.pool import NullPool

# ──────────────────────────────────────────────
# 1. Setup Environment
# ──────────────────────────────────────────────
os.environ["ENVIRONMENT"] = "testing"
os.environ["LOG_LEVEL"] = "WARNING"
os.environ["LOG_FORMAT"] = "text"
os.environ["ALLOWED_HOSTS"] = "*"
os.environ["CORS_ORIGINS"] = "*"
os.environ["GROQ_API_KEY"] = "dummy_test_key"

# URL PostgreSQL Lokal Anda (Sesuaikan user/password jika berbeda)
TEST_DB_URL_ASYNC = "postgresql+asyncpg://postgres:123@localhost:5432/rag_eval_test"
ADMIN_DB_URL_SYNC = "postgresql+psycopg2://postgres:123@localhost:5432/postgres"

from app.main import app
from app.database import get_async_db
from app.models import Base, Tenant, EvaluationRun, EvaluationItem, MetricDefinition, Score

# ──────────────────────────────────────────────
# 2. Setup Database Lokal (Tanpa Docker)
# ──────────────────────────────────────────────
@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Membuat database test di PostgreSQL lokal Anda secara otomatis."""
    try:
        admin_engine = create_engine(ADMIN_DB_URL_SYNC, isolation_level="AUTOCOMMIT")
        with admin_engine.connect() as conn:
            conn.execute(text("DROP DATABASE IF EXISTS rag_eval_test;"))
            conn.execute(text("CREATE DATABASE rag_eval_test;"))
        admin_engine.dispose()
    except Exception as e:
        pytest.exit(f"Gagal connect ke PostgreSQL lokal. Pastikan Postgres jalan & psycopg2-binary terinstall. Error: {e}")
    yield

@pytest_asyncio.fixture(scope="session")
async def test_engine(setup_test_database):
    engine = create_async_engine(TEST_DB_URL_ASYNC, echo=False, future=True, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest_asyncio.fixture(autouse=True)
async def clean_tables(test_engine):
    """Bersihkan tabel sebelum tiap test."""
    yield
    async with test_engine.begin() as conn:
        await conn.execute(text("""
            TRUNCATE TABLE human_reviews, scores, metric_definitions, 
            evaluation_items, evaluation_runs, tenants CASCADE;
        """))

# ──────────────────────────────────────────────
# 3. HTTP Client & Mocks
# ──────────────────────────────────────────────
@pytest_asyncio.fixture
async def client(test_engine):
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False)

    async def _override_get_async_db():
        async with session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
            finally:
                await session.close()

    app.dependency_overrides[get_async_db] = _override_get_async_db

    # Mock Celery & Health Check
    with patch("app.api.v1.evaluate.run_evaluation") as mock_task:
        mock_task.delay.return_value = MagicMock(id="mock-celery-task-id")
        
        # FIX: Patch di app.database DAN app.main karena main.py meng-import fungsi ini secara langsung
        with patch("app.database.check_database_connection", return_value=True), \
             patch("app.main.check_database_connection", return_value=True):
            
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
                yield ac

    app.dependency_overrides.clear()

# ──────────────────────────────────────────────
# 4. Auth & Data Fixtures
# ──────────────────────────────────────────────
@pytest_asyncio.fixture
async def tenant(client: AsyncClient) -> dict:
    response = await client.post("/api/v1/tenants", json={"name": "Test Tenant"})
    assert response.status_code == 201, f"Failed to create tenant: {response.text}"
    return response.json()

@pytest_asyncio.fixture
def auth_headers(tenant: dict) -> dict:
    return {"X-API-Key": tenant["api_key"]}

@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, auth_headers: dict) -> AsyncClient:
    client.headers.update(auth_headers)
    return client

@pytest_asyncio.fixture
async def completed_run_with_scores(test_engine, tenant: dict) -> dict:
    """Menyuntikkan data run 'completed' beserta score-nya langsung ke DB."""
    session_factory = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    
    async with session_factory() as session:
        t_result = await session.execute(select(Tenant).where(Tenant.id == tenant["id"]))
        tenant_obj = t_result.scalar_one()
        
        m_result = await session.execute(
            select(MetricDefinition).where(
                MetricDefinition.tenant_id == tenant_obj.id,
                MetricDefinition.name == "faithfulness"
            )
        )
        metric = m_result.scalar_one()
        
        run_id = uuid.uuid4()
        run = EvaluationRun(id=run_id, tenant_id=tenant_obj.id, status="completed", metadata_={"test": True})
        session.add(run)
        await session.flush()
        
        item_id = uuid.uuid4()
        item = EvaluationItem(
            id=item_id, run_id=run.id, query="Test query", response="Test response",
            contexts=["Test context"], ground_truth="Test GT"
        )
        session.add(item)
        await session.flush()
        
        score = Score(id=uuid.uuid4(), item_id=item.id, metric_id=metric.id, value=0.95, details={"reason": "Good"})
        session.add(score)
        await session.commit()
        
        return {
            "run_id": str(run_id),
            "item_id": str(item_id),
            "metric_id": str(metric.id),
            "metric_name": metric.name
        }