"""
Razorpay Demo Router
--------------------
Provides a thin proxy between the Next.js frontend and the Razorpay mock
server (nexus-razorpay-mock:9092) so the web container doesn't need direct
network access to the mock.

Endpoints (all under /v1/razorpay/demo, no auth required for demo purposes):
  GET  /transactions          — list all payments in the mock
  POST /transactions          — add a new demo payment to the mock
  DELETE /transactions/reset  — reset mock back to seed data
"""

import os
import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/v1/razorpay/demo", tags=["razorpay-demo"])

# The razorpay mock is reachable inside Docker via its service name.
RAZORPAY_MOCK_URL = os.getenv("RAZORPAY_MOCK_URL", "http://razorpay-mock:9092")


class DemoTransaction(BaseModel):
    amount: int          # amount in paise (e.g. 150000 = ₹1500)
    email: Optional[str] = "demo@customer.example.com"
    currency: Optional[str] = "INR"
    status: Optional[str] = "captured"


async def _get_mock(path: str):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{RAZORPAY_MOCK_URL}{path}")
        resp.raise_for_status()
        return resp.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Razorpay mock unreachable: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


async def _post_mock(path: str, body: dict):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(f"{RAZORPAY_MOCK_URL}{path}", json=body)
        resp.raise_for_status()
        return resp.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Razorpay mock unreachable: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


async def _delete_mock(path: str):
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.delete(f"{RAZORPAY_MOCK_URL}{path}")
        resp.raise_for_status()
        return resp.json()
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Razorpay mock unreachable: {e}")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


@router.get("/transactions")
async def list_transactions():
    """Return the current payment list from the Razorpay mock."""
    return await _get_mock("/v1/payments")


@router.post("/transactions", status_code=201)
async def add_transaction(txn: DemoTransaction):
    """Append a new demo payment to the Razorpay mock's in-memory store."""
    return await _post_mock("/v1/payments/demo", txn.model_dump())


@router.delete("/transactions/reset")
async def reset_transactions():
    """Reset the Razorpay mock back to seed data."""
    return await _delete_mock("/v1/payments/demo/reset")
