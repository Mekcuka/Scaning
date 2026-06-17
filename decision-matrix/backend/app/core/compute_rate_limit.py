"""Rate limit for compute-heavy API endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from limits import parse

from app.core.config import settings
from app.core.rate_limit import get_client_ip, limiter


def enforce_compute_rate_limit(request: Request) -> None:
    """Limit compute endpoints per client IP (COMPUTE_RATE_LIMIT)."""
    if not limiter.enabled:
        return
    key = f"compute:{get_client_ip(request)}"
    if not limiter.limiter.hit(parse(settings.COMPUTE_RATE_LIMIT), key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен лимит запросов к ресурсоёмким операциям",
            headers={"Retry-After": "60"},
        )


ComputeRateLimitDep = Annotated[None, Depends(enforce_compute_rate_limit)]
