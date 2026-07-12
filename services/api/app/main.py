from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from app.core.config import settings
from app.routers import health

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


app = FastAPI(title="Nexus Credit Passport API", version="1.0.0", dependencies=[Depends(verify_api_key)])

app.include_router(health.router, prefix="/v1", tags=["health"])


@app.get("/healthz", include_in_schema=False)
async def healthz():
    return {"status": "ok"}