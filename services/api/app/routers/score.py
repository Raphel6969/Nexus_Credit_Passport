"""
Score router — assembles aggregate stats and proxies to Rust scoring service.

GET /v1/businesses/{business_id}/score
  Queries Postgres for aggregate transaction stats (no PII decryption),
  POSTs to the Rust scoring service, returns the score.

The Python API layer ONLY handles non-PII aggregates here. It never decrypts
narration or counterparty fields — those stay sealed in Postgres until Rust reads
them directly in Phase 4.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.core.config import settings
from app.core.db import get_db

router = APIRouter()


@router.get("/businesses/{business_id}/score")
async def get_score(business_id: str, db: AsyncSession = Depends(get_db)):
    """
    Return the credit score for a business.
    Phase 2: assembles aggregate stats and calls the Rust stub.
    """
    # Pull aggregate stats from transactions — no PII columns touched here
    rows = await db.execute(
        text("""
            SELECT
                COUNT(*)                                          AS total_transactions,
                COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0) AS total_credits,
                COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'), 0)  AS total_debits,
                COUNT(*) FILTER (WHERE mode = 'UPI')             AS upi_count,
                COUNT(*) FILTER (WHERE mode = 'NACH' AND type = 'DEBIT') AS nach_debit_count
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = :business_id
        """),
        {"business_id": business_id},
    )
    row = rows.fetchone()

    if not row or row.total_transactions == 0:
        raise HTTPException(
            status_code=404,
            detail="No transaction data found for this business. Run /ingest/aa first.",
        )

    # Pull latest balance from accounts
    balance_row = await db.execute(
        text("""
            SELECT balance
            FROM accounts
            WHERE business_id = :business_id AND balance IS NOT NULL
            ORDER BY balance_at DESC NULLS LAST
            LIMIT 1
        """),
        {"business_id": business_id},
    )
    balance_record = balance_row.fetchone()

    # Build ScoringInput for the Rust stub
    scoring_input = {
        "business_id": business_id,
        "account_ids": [],  # Rust stub doesn't use this yet
        "total_transactions": int(row.total_transactions) if row.total_transactions is not None else 0,
        "total_credits_paise": int(row.total_credits) if row.total_credits is not None else 0,
        "total_debits_paise": int(row.total_debits) if row.total_debits is not None else 0,
        "upi_transaction_count": int(row.upi_count) if row.upi_count is not None else 0,
        "nach_debit_count": int(row.nach_debit_count) if row.nach_debit_count is not None else 0,
        "current_balance_paise": int(balance_record.balance) if (balance_record and balance_record.balance is not None) else None,
        "data_window_days": 365,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.SCORING_SERVICE_URL}/v1/score",
                json=scoring_input,
            )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Scoring service unavailable: {e}")
