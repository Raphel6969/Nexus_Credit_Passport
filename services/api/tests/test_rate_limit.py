import pytest
from httpx import AsyncClient
from app.main import app
from app.core.deps import limiter

@pytest.mark.asyncio
async def test_rate_limiting():
    # Clear the buckets for a clean test execution
    limiter.buckets.clear()
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        # Since capacity is 5, we can make 5 requests that pass the rate limiter.
        # They will return 404 (Not Found) because the token is fake.
        for _ in range(5):
            resp = await ac.get("/v1/shares/nonexistent-token-id")
            assert resp.status_code == 404
            
        # The 6th request should exceed the capacity and return a 429 Too Many Requests
        resp = await ac.get("/v1/shares/nonexistent-token-id")
        assert resp.status_code == 429
        assert "Rate limit exceeded" in resp.json()["detail"]
        assert "Retry-After" in resp.headers

@pytest.mark.asyncio
async def test_rate_limit_pruning():
    from app.core.limiter import TokenBucketLimiter
    import time
    
    test_limiter = TokenBucketLimiter(capacity=2.0, refill_rate=1.0)
    
    await test_limiter.consume("user-1", 1)
    await test_limiter.consume("user-2", 2)
    await test_limiter.consume("user-3", 1)
    
    assert len(test_limiter.buckets) == 3
    
    # Prune immediately -> no buckets should be pruned yet as none are fully refilled
    now = time.time()
    test_limiter._prune_buckets(now)
    assert len(test_limiter.buckets) == 3
    
    # Prune after 1.1 seconds:
    # user-1 has 1 token left, refilled +1.1 -> 2.1 (capped at capacity 2). Fully refilled -> pruned.
    # user-3 has 1 token left, refilled +1.1 -> 2.1 (capped at capacity 2). Fully refilled -> pruned.
    # user-2 has 0 tokens left, refilled +1.1 -> 1.1 (below capacity 2). Not fully refilled -> kept.
    test_limiter._prune_buckets(now + 1.1)
    assert "user-1" not in test_limiter.buckets
    assert "user-3" not in test_limiter.buckets
    assert "user-2" in test_limiter.buckets
    
    # Prune after 2.1 seconds:
    # user-2 has 0 tokens left, refilled +2.1 -> 2.1 (capped at capacity 2). Fully refilled -> pruned.
    test_limiter._prune_buckets(now + 2.1)
    assert len(test_limiter.buckets) == 0
