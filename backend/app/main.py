import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import settings
from app.database import async_engine, check_database_connection
from app.api.v1 import evaluate, metrics, comparisons, tenants, calibration

def setup_logging():
    if settings.LOG_FORMAT == "json":
        from pythonjsonlogger import jsonlogger
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(name)s %(levelname)s %(message)s %(pathname)s %(lineno)d"
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
        )
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    root_logger.handlers = [handler]
    
    # Reduce third-party library noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info(f"Starting application in {settings.ENVIRONMENT} mode")
    
    db_healthy = await check_database_connection()
    if not db_healthy:
        logger.error("Failed to connect to database on startup")
        if settings.is_production:
            raise RuntimeError("Database connection failed on startup")
    
    logger.info("Application startup complete")
    
    yield
    
    logger.info("Shutting down application")
    await async_engine.dispose()
    logger.info("Database engine disposed")


app = FastAPI(
    title="RAG Evaluation Harness",
    description="Standalone evaluation service for RAG systems",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
    openapi_url="/openapi.json" if not settings.is_production else None,
)

if settings.is_production:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=settings.ALLOWED_HOSTS.split(",") if settings.ALLOWED_HOSTS != "*" else ["*"]
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    allow_headers=["*"],
    max_age=600,
)

app.include_router(evaluate.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(comparisons.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(calibration.router, prefix="/api/v1")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global handler for unhandled exceptions."""
    logger.exception(f"Unhandled exception at {request.url.path}: {exc}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint that verifies database connectivity."""
    try:
        db_healthy = await check_database_connection()
        if not db_healthy:
            raise Exception("Database unreachable")
        
        return {
            "status": "healthy",
            "environment": settings.ENVIRONMENT,
            "database": "connected",
            "version": "1.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "detail": "Service temporarily unavailable"
            }
        )


@app.get("/ready", tags=["Health"])
async def readiness_check():
    """Kubernetes-style readiness probe."""
    db_healthy = await check_database_connection()
    if not db_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"ready": False}
        )
    return {"ready": True}