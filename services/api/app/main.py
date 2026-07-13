from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from app.core.config import settings
from app.core.deps import verify_api_key
from app.routers import health, score, ingest, shares

app = FastAPI(
    title="Nexus Credit Passport API",
    version="1.0.0",
)

app.include_router(health.router, prefix="/v1", tags=["health"])
app.include_router(score.router, prefix="/v1", tags=["score"], dependencies=[Depends(verify_api_key)])
app.include_router(ingest.router, prefix="/v1", tags=["ingest"], dependencies=[Depends(verify_api_key)])
app.include_router(shares.router, prefix="/v1", tags=["shares"])


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}