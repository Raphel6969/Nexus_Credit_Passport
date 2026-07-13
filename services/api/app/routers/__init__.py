# Health router
from app.routers.health import router as health_router
from app.routers.shares import router as shares_router

__all__ = ["health_router", "shares_router"]