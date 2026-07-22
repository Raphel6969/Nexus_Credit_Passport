"""
Ingest router — proxies ingest requests to the Go ingestion service.
"""
import uuid

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter()


class IngestAARequest(BaseModel):
    consentId: str
    accountId: str


class GenericIngestRequest(BaseModel):
    accountId: str


class ManualUPIIngestRequest(BaseModel):
    amountPaise: int
    payerHandle: str | None = None
    payerName: str | None = None
    upiRef: str | None = None
    paidAt: str | None = None
    accountId: str | None = None


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
    return await proxy_to_ingestion("/v1/ingest/aa", payload)


@router.post("/businesses/{business_id}/ingest/gstn", status_code=202)
async def ingest_gstn(business_id: str, req: GenericIngestRequest):
    return await proxy_to_ingestion("/v1/ingest/gstn", {
        "accountId": req.accountId,
        "businessId": business_id,
    })


@router.post("/businesses/{business_id}/ingest/razorpay", status_code=202)
async def ingest_razorpay(business_id: str, req: GenericIngestRequest):
    return await proxy_to_ingestion("/v1/ingest/razorpay", {
        "accountId": req.accountId,
        "businessId": business_id,
    })


@router.post("/businesses/{business_id}/ingest/zoho", status_code=202)
async def ingest_zoho(business_id: str, req: GenericIngestRequest):
    return await proxy_to_ingestion("/v1/ingest/zoho", {
        "accountId": req.accountId,
        "businessId": business_id,
    })


@router.post("/businesses/{business_id}/ingest/tally", status_code=202)
async def ingest_tally(business_id: str, req: GenericIngestRequest):
    return await proxy_to_ingestion("/v1/ingest/tally", {
        "accountId": req.accountId,
        "businessId": business_id,
    })


@router.post("/businesses/{business_id}/ingest/manual-upi", status_code=202)
async def ingest_manual_upi(business_id: str, req: ManualUPIIngestRequest):
    # Keep one stable account per business for manual UPI ingestion.
    account_id = req.accountId or str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{business_id}:manual-upi"))
    return await proxy_to_ingestion("/v1/ingest/manual-upi", {
        "accountId": account_id,
        "businessId": business_id,
        "amountPaise": req.amountPaise,
        "payerHandle": req.payerHandle or "",
        "payerName": req.payerName or "",
        "upiRef": req.upiRef or "",
        "paidAt": req.paidAt or "",
    })


async def proxy_to_ingestion(path: str, payload: dict):
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{settings.INGESTION_SERVICE_URL}{path}",
                json=payload,
            )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Ingestion service unavailable: {e}")
