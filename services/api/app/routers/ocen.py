import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.routers.score import get_score

router = APIRouter()


class BroadcastRequest(BaseModel):
    business_id: str
    requested_amount: Optional[float] = 1500000.0


class OcenOffer(BaseModel):
    lender_id: str
    lender_name: str
    lender_type: str  # "Public Bank" | "Private Bank" | "NBFC"
    badge: str
    status: str  # "APPROVED" | "REJECTED"
    max_amount: float
    interest_rate_pct: float
    tenure_months: int
    processing_fee_pct: float
    disbursal_time: str
    rejection_reason: Optional[str] = None


class OcenBroadcastResponse(BaseModel):
    broadcast_id: str
    business_id: str
    score: int
    confidence: str
    timestamp: str
    offers: List[OcenOffer]


@router.post("/broadcast", response_model=OcenBroadcastResponse)
async def broadcast_passport(
    req: BroadcastRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Mock OCEN (Open Credit Enablement Network) Gateway Broadcast.
    Simulates broadcasting the business's Credit Passport to participating India Stack lenders.
    Generates competing, score-driven loan offers.
    """
    # 1. Fetch current score
    score_resp = await get_score(req.business_id, db=db)
    score = score_resp.get("score", 500)
    confidence = score_resp.get("confidence", "MEDIUM")
    req_amt = req.requested_amount or 1500000.0

    offers: List[OcenOffer] = []

    # ── 1. State Bank of India (SBI) ──────────────────────────────────────────
    if score >= 650:
        rate = round(8.5 + (850 - score) * 0.01, 2)
        amount = min(req_amt * 1.2, 5000000.0)
        offers.append(
            OcenOffer(
                lender_id="sbi",
                lender_name="State Bank of India",
                lender_type="Public Bank",
                badge="Lowest Interest",
                status="APPROVED",
                max_amount=amount,
                interest_rate_pct=rate,
                tenure_months=24,
                processing_fee_pct=0.5,
                disbursal_time="24–48 Hours",
            )
        )
    else:
        offers.append(
            OcenOffer(
                lender_id="sbi",
                lender_name="State Bank of India",
                lender_type="Public Bank",
                badge="Lowest Interest",
                status="REJECTED",
                max_amount=0,
                interest_rate_pct=0,
                tenure_months=0,
                processing_fee_pct=0,
                disbursal_time="N/A",
                rejection_reason=f"Score ({score}) is below SBI minimum threshold of 650",
            )
        )

    # ── 2. HDFC Bank ──────────────────────────────────────────────────────────
    if score >= 600:
        rate = round(9.5 + (850 - score) * 0.012, 2)
        amount = min(req_amt, 3500000.0)
        offers.append(
            OcenOffer(
                lender_id="hdfc",
                lender_name="HDFC Bank",
                lender_type="Private Bank",
                badge="Best Value",
                status="APPROVED",
                max_amount=amount,
                interest_rate_pct=rate,
                tenure_months=18,
                processing_fee_pct=0.75,
                disbursal_time="Same Day (4 Hours)",
            )
        )
    else:
        offers.append(
            OcenOffer(
                lender_id="hdfc",
                lender_name="HDFC Bank",
                lender_type="Private Bank",
                badge="Best Value",
                status="REJECTED",
                max_amount=0,
                interest_rate_pct=0,
                tenure_months=0,
                processing_fee_pct=0,
                disbursal_time="N/A",
                rejection_reason=f"Score ({score}) below HDFC minimum requirement of 600",
            )
        )

    # ── 3. ICICI Bank ─────────────────────────────────────────────────────────
    if score >= 550:
        rate = round(10.5 + (850 - score) * 0.015, 2)
        amount = min(req_amt * 0.9, 2500000.0)
        offers.append(
            OcenOffer(
                lender_id="icici",
                lender_name="ICICI Bank",
                lender_type="Private Bank",
                badge="Fast Approval",
                status="APPROVED",
                max_amount=amount,
                interest_rate_pct=rate,
                tenure_months=12,
                processing_fee_pct=1.0,
                disbursal_time="Instant (10 Mins)",
            )
        )
    else:
        offers.append(
            OcenOffer(
                lender_id="icici",
                lender_name="ICICI Bank",
                lender_type="Private Bank",
                badge="Fast Approval",
                status="REJECTED",
                max_amount=0,
                interest_rate_pct=0,
                tenure_months=0,
                processing_fee_pct=0,
                disbursal_time="N/A",
                rejection_reason=f"Score ({score}) below ICICI threshold of 550",
            )
        )

    # ── 4. Bajaj Finserv (NBFC) ────────────────────────────────────────────────
    if score >= 450:
        rate = round(13.5 + (850 - score) * 0.02, 2)
        amount = min(req_amt * 0.75, 1500000.0)
        offers.append(
            OcenOffer(
                lender_id="bajaj",
                lender_name="Bajaj Finserv",
                lender_type="NBFC",
                badge="Instant Disbursal",
                status="APPROVED",
                max_amount=amount,
                interest_rate_pct=rate,
                tenure_months=12,
                processing_fee_pct=1.5,
                disbursal_time="Instant (5 Mins)",
            )
        )
    else:
        offers.append(
            OcenOffer(
                lender_id="bajaj",
                lender_name="Bajaj Finserv",
                lender_type="NBFC",
                badge="Instant Disbursal",
                status="REJECTED",
                max_amount=0,
                interest_rate_pct=0,
                tenure_months=0,
                processing_fee_pct=0,
                disbursal_time="N/A",
                rejection_reason=f"Score ({score}) below minimum NBFC cutoff of 450",
            )
        )

    broadcast_id = f"ocen-tx-{uuid.uuid4().hex[:8]}"

    return OcenBroadcastResponse(
        broadcast_id=broadcast_id,
        business_id=req.business_id,
        score=score,
        confidence=confidence,
        timestamp=datetime.now(timezone.utc).isoformat(),
        offers=offers,
    )
