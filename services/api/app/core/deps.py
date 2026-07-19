from fastapi import Depends, HTTPException, Request, status
from fastapi.security import APIKeyHeader
from app.core.config import settings
from app.core.limiter import TokenBucketLimiter

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Initialize rate limiter: 5 requests max burst, refills at 1 request per second
limiter = TokenBucketLimiter(capacity=5.0, refill_rate=1.0)

async def verify_api_key(api_key: str = Depends(api_key_header)):
    if api_key != settings.API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")

async def check_rate_limit(request: Request, api_key: str = Depends(api_key_header)):
    # Use API key if provided, fallback to client IP
    identifier = api_key or (request.client.host if request.client else "unknown")
    
    is_allowed, retry_after = limiter.consume(identifier)
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Retry in {retry_after:.1f} seconds.",
            headers={"Retry-After": str(max(1, int(retry_after)))}
        )

