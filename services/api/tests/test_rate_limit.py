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
