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
from app.core.ai import generate_score_explanation, generate_dashboard_insights
import hashlib
import json

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
    
    # Generate AI explanation
    ai_explanation = await generate_score_explanation(scoring_result)
    scoring_result["note"] = ai_explanation
    
    try:
        computed_at = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO score_snapshots
                    (id, business_id, score, confidence, model_version, drivers, anomaly_flags, ai_explanation, computed_at, created_at)
                VALUES
                    (CAST(:id AS UUID), CAST(:business_id AS UUID), :score, :confidence, :model_version, CAST(:drivers AS JSONB), CAST(:anomaly_flags AS JSONB), :ai_explanation, :computed_at, :created_at)
            """),
            {
                "id": str(uuid.uuid4()),
                "business_id": business_id,
                "score": scoring_result.get("score"),
                "confidence": scoring_result.get("confidence", "UNKNOWN"),
                "model_version": scoring_result.get("model_version", "unknown"),
                "drivers": json.dumps(scoring_result.get("drivers", [])),
                "anomaly_flags": json.dumps(scoring_result.get("anomaly_flags", [])),
                "ai_explanation": ai_explanation,
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
            SELECT id, score, confidence, model_version, computed_at, ai_explanation
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
            "ai_explanation": row.ai_explanation,
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

    # ── 5. Expanded analytics + hybrid budget guidance ───────────────────────
    monthly_kpis = []
    for m in monthly:
        earned = int(m["earned"])
        spent = int(m["spent"])
        saved = earned - spent
        savings_rate_pct = (saved / earned * 100.0) if earned > 0 else 0.0
        monthly_kpis.append(
            {
                "month": m["month"],
                "earned": earned,
                "spent": spent,
                "saved": saved,
                "savings_rate_pct": round(savings_rate_pct, 2),
            }
        )

    month_count = len(monthly_kpis)
    avg_monthly_earned = int(total_earned / month_count) if month_count else 0
    avg_monthly_spent = int(total_spent / month_count) if month_count else 0
    avg_monthly_saved = int(total_saved / month_count) if month_count else 0

    best_month = max(monthly_kpis, key=lambda x: x["saved"])["month"] if monthly_kpis else None
    worst_month = min(monthly_kpis, key=lambda x: x["saved"])["month"] if monthly_kpis else None

    top_mode = modes[0]["mode"] if modes else None
    top_mode_share_pct = (
        (modes[0]["amount"] / total_spent * 100.0) if (modes and total_spent > 0) else 0.0
    )

    fixed_modes = {"NACH", "ECS", "CHEQUE", "RTGS", "NEFT"}
    fixed_spend_total = sum(m["amount"] for m in modes if m["mode"] in fixed_modes)
    fixed_cost_ratio_pct = (
        (fixed_spend_total / total_spent * 100.0) if total_spent > 0 else 0.0
    )

    savings_floor_target = max(int(avg_monthly_earned * 0.20), 0)
    fixed_cost_ratio_threshold_pct = 50.0
    variable_caps = []
    if total_spent > 0 and avg_monthly_spent > 0:
        for m in modes:
            if m["mode"] in fixed_modes:
                continue
            share_pct = (m["amount"] / total_spent) * 100.0
            variable_caps.append(
                {
                    "mode": m["mode"],
                    "cap_amount": int(avg_monthly_spent * (share_pct / 100.0)),
                    "share_pct": round(share_pct, 2),
                }
            )
    variable_caps = sorted(variable_caps, key=lambda x: x["cap_amount"], reverse=True)[:5]

    summary = {
        "total_earned": total_earned,
        "total_spent": total_spent,
        "total_saved": total_saved,
    }
    
    trend_insights_data = {
        "avg_monthly_earned": avg_monthly_earned,
        "avg_monthly_spent": avg_monthly_spent,
        "avg_monthly_saved": avg_monthly_saved,
        "best_month": best_month,
        "worst_month": worst_month,
        "top_spend_mode": top_mode,
        "top_spend_mode_share_pct": round(top_mode_share_pct, 2),
        "fixed_cost_ratio_pct": round(fixed_cost_ratio_pct, 2),
    }
    
    budget_guidance_data = {
        "savings_floor_target": savings_floor_target,
        "fixed_cost_ratio_threshold_pct": fixed_cost_ratio_threshold_pct,
        "variable_caps": variable_caps,
    }

    # ── 6. Caching & Generating AI Insight ───────────────────────────────────
    # We hash the KPIs to see if the data changed since the last generated insight.
    raw_hash_data = json.dumps({
        "summary": summary,
        "monthly": monthly,
        "modes": modes
    }, sort_keys=True).encode("utf-8")
    data_hash = hashlib.sha256(raw_hash_data).hexdigest()

    # Check cache
    cache_row = await db.execute(
        text("""
            SELECT insight_text FROM dashboard_insights
            WHERE business_id = CAST(:business_id AS UUID) AND data_hash = :data_hash
            ORDER BY created_at DESC LIMIT 1
        """),
        {"business_id": business_id, "data_hash": data_hash}
    )
    cache_result = cache_row.fetchone()
    
    if cache_result:
        ai_insight = cache_result.insight_text
    else:
        # Generate new insight
        ai_insight = await generate_dashboard_insights(
            summary, monthly_kpis, trend_insights_data, budget_guidance_data
        )
        
        # Save to cache
        try:
            now_utc = datetime.now(timezone.utc)
            await db.execute(
                text("""
                    INSERT INTO dashboard_insights (id, business_id, data_hash, insight_text, created_at)
                    VALUES (CAST(:id AS UUID), CAST(:business_id AS UUID), :data_hash, :insight_text, :created_at)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "business_id": business_id,
                    "data_hash": data_hash,
                    "insight_text": ai_insight,
                    "created_at": now_utc,
                }
            )
            await db.commit()
        except Exception as e:
            await db.rollback()
            import logging
            logging.getLogger(__name__).warning("Failed to persist dashboard insight cache: %s", e)

    return {
        "business_id": business_id,
        "summary": summary,
        "monthly": monthly,
        "modes": modes,
        "recent_transactions": recent,
        "monthly_kpis": monthly_kpis,
        "trend_insights": trend_insights_data,
        "budget_guidance": budget_guidance_data,
        "ai_insight": ai_insight,
    }


@router.get("/businesses/{business_id}/transactions/upi")
async def get_upi_transactions(
    business_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """
    Return recent UPI credit transactions for a business.
    Used by the web UPI console in live mode.
    """
    rows = await db.execute(
        text(
            """
            SELECT
                t.id,
                t.amount,
                t.currency,
                t.reference_number,
                EXTRACT(EPOCH FROM t.timestamp)::BIGINT AS created_at
            FROM transactions t
            JOIN accounts a ON t.account_id = a.id
            WHERE a.business_id = CAST(:business_id AS UUID)
              AND t.mode = 'UPI'
              AND t.type = 'CREDIT'
            ORDER BY t.timestamp DESC
            LIMIT :limit
            """
        ),
        {"business_id": business_id, "limit": min(limit, 100)},
    )
    items = [
        {
            "id": str(r.id),
            "amount": int(r.amount),
            "currency": r.currency or "INR",
            "status": "captured",
            "email": "UPI Payer",
            "reference_number": r.reference_number,
            "created_at": int(r.created_at),
        }
        for r in rows.fetchall()
    ]
    return {"items": items, "count": len(items)}


@router.get("/businesses/{business_id}/stress-test")
async def get_stress_test(
    business_id: str,
    amount: float,
    rate: float,
    tenure_months: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 1: "What-If" EMI Stress Test Simulator.
    Calculates the EMI for the requested loan and compares it against
    the business's historical monthly free cash flow (FCF).
    """
    if tenure_months <= 0 or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid loan parameters.")

    # 1. Calculate EMI
    r = (rate / 100.0) / 12.0
    if r == 0:
        emi = amount / tenure_months
    else:
        emi = amount * r * ((1 + r) ** tenure_months) / (((1 + r) ** tenure_months) - 1)

    # 2. Fetch last 12 months of transactions to compute Free Cash Flow
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

    from collections import defaultdict
    monthly_map: dict = defaultdict(lambda: {"earned": 0, "spent": 0})
    for row in monthly_raw:
        key = row.month.strftime("%Y-%m")
        if row.type == "CREDIT":
            monthly_map[key]["earned"] += (int(row.total) / 100.0) # convert paise to real
        else:
            monthly_map[key]["spent"] += (int(row.total) / 100.0)

    fcf_history = []
    for k, v in sorted(monthly_map.items()):
        fcf = v["earned"] - v["spent"]
        fcf_history.append({"month": k, "fcf": fcf, "earned": v["earned"], "spent": v["spent"]})

    if not fcf_history:
        raise HTTPException(
            status_code=404,
            detail="Not enough transaction history to run a stress test."
        )

    # 3. Call AI for risk assessment
    from app.core.ai import generate_stress_test_analysis
    
    # Just pass the FCF numbers to the AI to save tokens
    monthly_fcf_numbers = [m["fcf"] for m in fcf_history]
    ai_analysis = await generate_stress_test_analysis(
        monthly_fcf=monthly_fcf_numbers,
        emi=emi,
        amount=amount,
        tenure_months=tenure_months
    )

    return {
        "business_id": business_id,
        "loan_details": {
            "amount": amount,
            "rate_pct": rate,
            "tenure_months": tenure_months,
            "emi": emi
        },
        "fcf_history": fcf_history,
        "ai_analysis": ai_analysis
    }

