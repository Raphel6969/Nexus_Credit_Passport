"""
Ingest router — proxies ingest requests to the Go ingestion service.

POST /v1/businesses/{business_id}/ingest/aa
  Accepts: { "consentId": "...", "accountId": "..." }
  Returns: passthrough from ingestion service (202 with counts)
"""
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class IngestAARequest(BaseModel):
    consentId: str
    accountId: str


@router.post("/businesses/{business_id}/ingest/aa", status_code=202)
async def ingest_aa(business_id: str, req: IngestAARequest):
    """
    Trigger a Setu AA data fetch and normalization pipeline for a business.
    Proxied to the Go ingestion service.
    """
    payload = {
        "consentId": req.consentId,
        "accountId": req.accountId,
        "businessId": business_id,
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.INGESTION_SERVICE_URL}/v1/ingest/aa",
                json=payload,
            )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Ingestion service unavailable: {e}")
