"""Extended health probes for /health."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import httpx
from sqlalchemy import text

from app.core.config import settings
from app.core.database import async_session
from app.core.http_client import get_http_client

logger = logging.getLogger(__name__)


async def check_database() -> str:
    try:
        async with async_session() as db:
            await db.execute(text("SELECT 1"))
        return "ok"
    except Exception:
        logger.exception("Health check database probe failed")
        return "error"


async def check_redis() -> tuple[str, int | None]:
    if not settings.jobs_use_queue:
        return "disabled", None
    try:
        import redis.asyncio as aioredis

        client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
        try:
            await client.ping()
            depth_raw = await client.llen(f"arq:{settings.ARQ_QUEUE_NAME}")
            depth = int(depth_raw) if depth_raw is not None else 0
            return "ok", depth
        finally:
            await client.aclose()
    except Exception:
        logger.debug("Redis health check failed", exc_info=True)
        return "error", None


def _microservice_mode(*, inprocess: bool, service_url: str) -> str:
    url = service_url.strip()
    if url:
        return "http"
    if inprocess:
        return "inprocess"
    return "disabled"


async def _ping_service(base_url: str) -> str:
    try:
        client = await get_http_client()
        r = await client.get(f"{base_url.rstrip('/')}/health", timeout=settings.HEALTH_CHECK_TIMEOUT_SECONDS)
        return "ok" if r.is_success else "error"
    except Exception:
        return "error"


async def check_microservices() -> dict[str, str]:
    if not settings.HEALTH_CHECK_MICROSERVICES:
        return {}

    async def autoroad() -> str:
        mode = _microservice_mode(
            inprocess=settings.AUTOROAD_NETWORK_INPROCESS,
            service_url=settings.AUTOROAD_NETWORK_SERVICE_URL,
        )
        if mode == "http":
            return await _ping_service(settings.AUTOROAD_NETWORK_SERVICE_URL)
        return mode

    async def well_trajectory() -> str:
        mode = _microservice_mode(
            inprocess=settings.WELL_TRAJECTORY_INPROCESS,
            service_url=settings.WELL_TRAJECTORY_SERVICE_URL,
        )
        if mode == "http":
            return await _ping_service(settings.WELL_TRAJECTORY_SERVICE_URL)
        return mode

    async def pad_earthwork() -> str:
        mode = _microservice_mode(
            inprocess=settings.PAD_EARTHWORK_INPROCESS,
            service_url=settings.PAD_EARTHWORK_SERVICE_URL,
        )
        if mode == "http":
            return await _ping_service(settings.PAD_EARTHWORK_SERVICE_URL)
        return mode

    autoroad_s, wt_s, pe_s = await asyncio.gather(autoroad(), well_trajectory(), pad_earthwork())
    return {
        "autoroad-network": autoroad_s,
        "well-trajectory": wt_s,
        "pad-earthwork": pe_s,
    }


async def build_health_payload(*, alembic_head: str | None) -> dict[str, Any]:
    db_status = await check_database()
    redis_status, arq_depth = await check_redis()
    microservices = await check_microservices()

    parts = [db_status]
    if redis_status != "disabled":
        parts.append(redis_status)
    if microservices:
        parts.extend(microservices.values())

    overall = "ok" if all(p in ("ok", "inprocess", "disabled") for p in parts) else "degraded"

    return {
        "status": overall if db_status == "ok" else "degraded",
        "database": db_status,
        "redis": redis_status,
        "arq_queue_depth": arq_depth,
        "microservices": microservices,
        "environment": settings.ENVIRONMENT,
        "alembic_head": alembic_head,
    }
