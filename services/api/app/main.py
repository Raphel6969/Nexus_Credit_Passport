from fastapi import FastAPI, Depends
from app.core.deps import verify_api_key, check_rate_limit
from app.routers import health, score, ingest, shares, ocen
from app.routers import razorpay_demo

app = FastAPI(
    title="Nexus Credit Passport API",
    version="1.0.0",
)

app.include_router(health.router, prefix="/v1", tags=["health"])
app.include_router(score.router, prefix="/v1", tags=["score"], dependencies=[Depends(verify_api_key), Depends(check_rate_limit)])
app.include_router(ingest.router, prefix="/v1", tags=["ingest"], dependencies=[Depends(verify_api_key), Depends(check_rate_limit)])
app.include_router(shares.router, prefix="/v1", tags=["shares"], dependencies=[Depends(check_rate_limit)])
app.include_router(ocen.router, prefix="/v1/ocen", tags=["ocen"], dependencies=[Depends(verify_api_key), Depends(check_rate_limit)])
app.include_router(razorpay_demo.router)  # no auth — demo only


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}