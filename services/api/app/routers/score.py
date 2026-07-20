"""
Score router — Phase 4: enriched scoring with SHAP driver breakdown.

GET /v1/businesses/{business_id}/score
  1. Existence check: does this business have any transaction data? (404 guard)
  2. Call Rust scoring service with { business_id } only — Rust fetches its
     own features directly from Postgres (trust-boundary decision from Phase 4).
  3. Persist snapshot to score_snapshots for audit trail + future trend view.
  4. Return full enriched response: score + confidence + drivers[].

Trust boundary note:
  The Python API layer NEVER assembles raw financial features or reads PII columns.
  It only does the existence check and acts as the HTTP proxy. All feature
  engineering lives inside the Rust raw-zone (services/scoring).
"""
import uuid
from datetime import datetime, timezone

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
    Return the current credit score for a business, with SHAP driver breakdown.

    Phase 4: Rust service fetches all features directly. API layer only does
    an existence check, proxies the request, and persists the snapshot.
    """
    # ── 1. Existence check ──────────────────────────────────────────────────
    # Fast COUNT to confirm data exists before calling Rust.
    # Only reads account_id (FK) — no PII columns.
    count_row = await db.execute(
        text("""
            SELECT COUNT(*) AS total_transactions
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = :business_id
        """),
        {"business_id": business_id},
    )
    row = count_row.fetchone()

    if not row or (row.total_transactions == 0):
        raise HTTPException(
            status_code=404,
            detail=(
                "No transaction data found for this business. "
                "Run one of the /ingest/* endpoints first."
            ),
        )

    # ── 2. Call Rust scoring service ────────────────────────────────────────
    # Send only business_id — Rust fetches its own features.
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.SCORING_SERVICE_URL}/v1/score",
                json={"business_id": business_id},
            )
        resp.raise_for_status()
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"Scoring service error: {e.response.text}",
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Scoring service unavailable: {e}",
        )

    scoring_result = resp.json()

    # ── 3. Persist score snapshot ───────────────────────────────────────────
    # Append-only audit row — derived output only, no raw features.
    try:
        computed_at = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO score_snapshots
                    (id, business_id, score, confidence, model_version, drivers, computed_at, created_at)
                VALUES
                    (CAST(:id AS UUID), CAST(:business_id AS UUID), :score, :confidence, :model_version, CAST(:drivers AS JSONB), :computed_at, :created_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "score": scoring_result.get("score"),
                "confidence": scoring_result.get("confidence", "UNKNOWN"),
                "model_version": scoring_result.get("model_version", "unknown"),
                "drivers": __import__("json").dumps(scoring_result.get("drivers", [])),
                "computed_at": computed_at,
                "created_at": computed_at,
            },
        )
        await db.commit()
    except Exception as e:
        # Non-fatal: snapshot failure should not block the score response
        await db.rollback()
        import logging
        logging.getLogger(__name__).warning("Failed to persist score snapshot: %s", e)

    # ── 4. Return enriched response ─────────────────────────────────────────
    return scoring_result


@router.get("/businesses/{business_id}/score/history")
async def get_score_history(
    business_id: str,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
):
    """
    Return the scoring history for a business (most recent first).
    Useful for Phase 6 dashboard trend chart.
    """
    rows = await db.execute(
        text("""
            SELECT id, score, confidence, model_version, computed_at
            FROM score_snapshots
            WHERE business_id = :business_id
            ORDER BY computed_at DESC
            LIMIT :limit
        """),
        {"business_id": business_id, "limit": min(limit, 50)},
    )
    history = [
        {
            "id": str(row.id),
            "score": row.score,
            "confidence": row.confidence,
            "model_version": row.model_version,
            "computed_at": row.computed_at.isoformat(),
        }
        for row in rows.fetchall()
    ]

    if not history:
        raise HTTPException(
            status_code=404,
            detail="No score history found for this business.",
        )

    return {"business_id": business_id, "history": history}


@router.get("/businesses/{business_id}/dashboard")
async def get_dashboard(
    business_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Return a full financial dashboard for a business:
      - total earned (CREDIT), total spent (DEBIT), total saved
      - monthly breakdown for the last 12 months
      - spending by payment mode
      - 20 most-recent transactions
    Amounts are returned in paise (minor units). Divide by 100 for ₹.
    """
    # ── 1. Monthly earned / spent for last 12 months ─────────────────────────
    monthly_rows = await db.execute(
        text("""
            SELECT
                DATE_TRUNC('month', t.timestamp) AS month,
                t.type,
                SUM(t.amount)                    AS total
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = CAST(:business_id AS UUID)
              AND t.timestamp >= NOW() - INTERVAL '12 months'
              AND t.revenue_role = 'primary'
            GROUP BY month, t.type
            ORDER BY month ASC
        """),
        {"business_id": business_id},
    )
    monthly_raw = monthly_rows.fetchall()

    # Build a sorted list of months with CREDIT / DEBIT buckets
    from collections import defaultdict
    monthly_map: dict = defaultdict(lambda: {"earned": 0, "spent": 0})
    for row in monthly_raw:
        key = row.month.strftime("%Y-%m")
        if row.type == "CREDIT":
            monthly_map[key]["earned"] += int(row.total)
        else:
            monthly_map[key]["spent"] += int(row.total)

    monthly = [
        {"month": k, "earned": v["earned"], "spent": v["spent"]}
        for k, v in sorted(monthly_map.items())
    ]

    # ── 2. Overall totals ────────────────────────────────────────────────────
    total_earned = sum(m["earned"] for m in monthly)
    total_spent = sum(m["spent"] for m in monthly)
    total_saved = total_earned - total_spent

    # ── 3. Spending by payment mode ──────────────────────────────────────────
    mode_rows = await db.execute(
        text("""
            SELECT
                COALESCE(t.mode, 'OTHERS') AS mode,
                SUM(t.amount)              AS total
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = CAST(:business_id AS UUID)
              AND t.type = 'DEBIT'
              AND t.revenue_role = 'primary'
            GROUP BY mode
            ORDER BY total DESC
        """),
        {"business_id": business_id},
    )
    modes = [
        {"mode": row.mode, "amount": int(row.total)}
        for row in mode_rows.fetchall()
    ]

    # ── 4. Recent transactions (last 20) ─────────────────────────────────────
    recent_rows = await db.execute(
        text("""
            SELECT
                t.id,
                t.amount,
                t.type,
                t.mode,
                t.timestamp,
                t.currency
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = CAST(:business_id AS UUID)
              AND t.revenue_role = 'primary'
            ORDER BY t.timestamp DESC
            LIMIT 20
        """),
        {"business_id": business_id},
    )
    recent = [
        {
            "id": str(row.id),
            "amount": int(row.amount),
            "type": row.type,
            "mode": row.mode or "OTHERS",
            "timestamp": row.timestamp.isoformat(),
            "currency": row.currency,
        }
        for row in recent_rows.fetchall()
    ]

    return {
        "business_id": business_id,
        "summary": {
            "total_earned": total_earned,
            "total_spent": total_spent,
            "total_saved": total_saved,
        },
        "monthly": monthly,
        "modes": modes,
        "recent_transactions": recent,
    }
