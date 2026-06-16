"""Redis client for job events pub/sub (and reusable across services)."""

from __future__ import annotations

import logging
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_redis: Any | None = None


async def get_redis() -> Any | None:
    """Lazily create a redis.asyncio.Redis client. Returns None if Redis is off."""
    global _redis
    if not settings.jobs_use_queue:
        return None
    if _redis is not None:
        return _redis
    try:
        from redis.asyncio import Redis

        _redis = Redis.from_url(settings.REDIS_URL, decode_responses=False)
        await _redis.ping()
        return _redis
    except Exception:
        logger.warning("redis unavailable — job events will use in-memory only", exc_info=True)
        _redis = None
        return None


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        try:
            await _redis.aclose()
        except Exception:
            pass
        _redis = None
