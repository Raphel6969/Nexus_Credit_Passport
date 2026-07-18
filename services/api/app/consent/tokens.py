import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from app.models.graph import ConsentToken, ConsentAuditLog, Business, ScoreSnapshot

async def mint_token(
    db: AsyncSession,
    business_id: str,
    scope: str,
    ttl_hours: Optional[int],
) -> ConsentToken:
    """
    Creates a cryptographically random share token, inserts row, logs MINTED audit event.
    For SNAPSHOT scope, we also grab the latest score data and bake it into the token.
    ttl_hours=None means the token never auto-expires (active until revoked).
    """
    if scope not in ["FULL_PROFILE", "SCORE_ONLY", "SNAPSHOT"]:
        raise ValueError("Invalid scope")

    token_str = secrets.token_urlsafe(32)
    expires_at = (
        datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        if ttl_hours is not None
        else None
    )
    
    snapshot_data = None
    if scope == "SNAPSHOT":
        # Fetch the latest score snapshot using raw SQL (same pattern as score.py)
        # to avoid UUID/string type-mismatch that silently returns no rows with ORM.
        result = await db.execute(
            text("""
                SELECT score, confidence, model_version, drivers, computed_at
                FROM score_snapshots
                WHERE business_id = CAST(:business_id AS UUID)
                ORDER BY computed_at DESC
                LIMIT 1
            """),
            {"business_id": business_id},
        )
        latest_score = result.fetchone()
        if not latest_score:
            raise HTTPException(status_code=400, detail="Cannot mint SNAPSHOT token: no score found for this business.")
        
        snapshot_data = {
            "score": latest_score.score,
            "confidence": latest_score.confidence,
            "model_version": latest_score.model_version,
            "drivers": latest_score.drivers,
            "computed_at": latest_score.computed_at.isoformat()
        }

    token = ConsentToken(
        business_id=business_id,
        token=token_str,
        scope=scope,
        status="ACTIVE",
        expires_at=expires_at,
        snapshot_data=snapshot_data
    )
    
    db.add(token)
    await db.flush()  # to get token.id

    audit_log = ConsentAuditLog(
        token_id=token.id,
        business_id=business_id,
        action="MINTED",
        actor=str(business_id),
    )
    db.add(audit_log)
    
    await db.commit()
    await db.refresh(token)
    return token


async def resolve_token(
    db: AsyncSession,
    token_str: str,
    requester_ip: Optional[str] = None
) -> tuple[ConsentToken, Business]:
    """
    Looks up token, checks status + expiry, logs RESOLVED event, marks SNAPSHOT as EXPIRED.
    """
    result = await db.execute(
        select(ConsentToken, Business)
        .join(Business, ConsentToken.business_id == Business.id)
        .where(ConsentToken.token == token_str)
    )
    row = result.first()
    
    if not row:
        raise HTTPException(status_code=404, detail="Token not found")
        
    token, business = row

    if token.status != "ACTIVE":
        raise HTTPException(status_code=410, detail=f"Token is {token.status}")
        
    if token.expires_at and token.expires_at < datetime.now(timezone.utc):
        token.status = "EXPIRED"
        
        audit_log = ConsentAuditLog(
            token_id=token.id,
            business_id=token.business_id,
            action="EXPIRED",
            actor="system",
        )
        db.add(audit_log)
        await db.commit()
        
        raise HTTPException(status_code=410, detail="Token has expired")

    # Log resolution
    audit_log = ConsentAuditLog(
        token_id=token.id,
        business_id=token.business_id,
        action="RESOLVED",
        actor="resolver",
        resolved_scope=token.scope,
        requester_ip=requester_ip,
    )
    db.add(audit_log)
    
    # If one-time use, mark as expired now that it has been resolved
    if token.scope == "SNAPSHOT":
        token.status = "EXPIRED"
        token.used_at = datetime.now(timezone.utc)

    await db.commit()
    
    return token, business


async def revoke_token(
    db: AsyncSession,
    token_str: str,
    business_id: str
):
    """
    Verifies ownership, updates status -> REVOKED, logs REVOKED event.
    """
    result = await db.execute(
        select(ConsentToken).where(ConsentToken.token == token_str)
    )
    token = result.scalar_one_or_none()
    
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
        
    if str(token.business_id) != business_id:
        raise HTTPException(status_code=403, detail="Not authorized to revoke this token")
        
    if token.status == "ACTIVE":
        token.status = "REVOKED"
        
        audit_log = ConsentAuditLog(
            token_id=token.id,
            business_id=token.business_id,
            action="REVOKED",
            actor=business_id,
        )
        db.add(audit_log)
        await db.commit()
