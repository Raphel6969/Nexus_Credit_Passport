import httpx
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.db import get_db
from app.core.config import settings
from app.core.deps import verify_api_key
from app.consent.tokens import mint_token, resolve_token, revoke_token
from app.models.graph import ConsentToken

router = APIRouter()

class MintTokenRequest(BaseModel):
    scope: str
    ttl_hours: Optional[int] = None  # None = no auto-expiry (active until revoked)

@router.post("/shares", dependencies=[Depends(verify_api_key)])
async def create_share_token(
    business_id: str,
    req: MintTokenRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Mint a new share token for a business. (Auth required - checked in main.py)
    """
    try:
        token = await mint_token(
            db=db,
            business_id=business_id,
            scope=req.scope,
            ttl_hours=req.ttl_hours
        )
        return {
            "token": token.token,
            "scope": token.scope,
            "expires_at": token.expires_at.isoformat() if token.expires_at else None,
            "status": token.status
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/businesses/{business_id}/shares", dependencies=[Depends(verify_api_key)])
async def list_share_tokens(
    business_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    List all tokens for a business. (Auth required - checked in main.py)
    """
    result = await db.execute(
        select(ConsentToken).where(ConsentToken.business_id == business_id).order_by(ConsentToken.created_at.desc())
    )
    tokens = result.scalars().all()
    
    return {
        "business_id": business_id,
        "tokens": [
            {
                "token": t.token,
                "scope": t.scope,
                "status": t.status,
                "expires_at": t.expires_at.isoformat() if t.expires_at else None,
                "created_at": t.created_at.isoformat()
            } for t in tokens
        ]
    }


@router.delete("/shares/{token}", dependencies=[Depends(verify_api_key)])
async def revoke_share_token(
    token: str,
    business_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Revoke a token. (Auth required - checked in main.py)
    """
    await revoke_token(db=db, token_str=token, business_id=business_id)
    return {"status": "REVOKED"}


# PUBLIC RESOLVER ENDPOINT - NO AUTHENTICATION REQUIRED
# The token IS the credential.
@router.get("/shares/{token}")
async def resolve_share_token(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Public endpoint to resolve a share token and get the scoped data.
    """
    requester_ip = request.client.host if request.client else None
    
    consent_token, business = await resolve_token(
        db=db,
        token_str=token,
        requester_ip=requester_ip
    )
    
    # ── SNAPSHOT scope ──
    # Return the baked-in score payload
    if consent_token.scope == "SNAPSHOT":
        data = consent_token.snapshot_data or {}
        return {
            "business_name": business.name,
            "scope": consent_token.scope,
            "score_data": data,
            "shared_at": consent_token.created_at.isoformat(),
            "note": "This is a one-time snapshot. This token is now expired."
        }
        
    # ── FULL_PROFILE or SCORE_ONLY scope ──
    # Need to fetch the latest score dynamically
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{settings.SCORING_SERVICE_URL}/v1/score",
                json={"business_id": str(business.id)},
            )
        resp.raise_for_status()
        scoring_result = resp.json()
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
        
    if consent_token.scope == "SCORE_ONLY":
        # Filter out drivers and note
        return {
            "business_name": business.name,
            "scope": consent_token.scope,
            "score_data": {
                "score": scoring_result.get("score"),
                "confidence": scoring_result.get("confidence"),
                "model_version": scoring_result.get("model_version"),
            },
            "expires_at": consent_token.expires_at.isoformat() if consent_token.expires_at else None
        }
        
    elif consent_token.scope == "FULL_PROFILE":
        return {
            "business_name": business.name,
            "scope": consent_token.scope,
            "score_data": scoring_result,
            "expires_at": consent_token.expires_at.isoformat() if consent_token.expires_at else None
        }
