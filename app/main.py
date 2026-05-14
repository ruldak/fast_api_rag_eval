from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from app.api.v1 import evaluate, metrics, comparisons, tenants

app = FastAPI(
    title="RAG Evaluation Harness",
    description="Standalone evaluation service for RAG systems",
    version="1.0.0"
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "message": str(exc)}
    )

app.include_router(evaluate.router, prefix="/api/v1")
app.include_router(metrics.router, prefix="/api/v1")
app.include_router(comparisons.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")

@app.get("/health")
async def health_check():
    return {"status": "healthy"}