"""Job realtime events — in-memory pub/sub hub + optional Redis bridge.

Two modes:
- Redis available (jobs_use_queue): worker PUBLISHes to `job-events:{project_id}`;
  web process subscribes and forwards to connected WebSocket clients via hub.
- No Redis (dev fallback): hub works in-memory within the single process.

public API:
- publish_job_event(project_id, event) — called from worker (job_steps.py)
- JobEventHub — singleton holding per-project subscriber queues
- start_redis_bridge() — background task, call once at app startup
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from uuid import UUID

from app.core.config import settings

logger = logging.getLogger(__name__)

_CHANNEL_PREFIX = "job-events:"


class JobEventHub:
    """In-memory fan-out: project_id → set of subscriber queues."""

    def __init__(self) -> None:
        self._subscribers: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}
        self._lock = asyncio.Lock()

    async def subscribe(self, project_id: UUID) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        key = str(project_id)
        async with self._lock:
            self._subscribers.setdefault(key, set()).add(queue)
        return queue

    async def unsubscribe(self, project_id: UUID, queue: asyncio.Queue[dict[str, Any]]) -> None:
        key = str(project_id)
        async with self._lock:
            subs = self._subscribers.get(key)
            if subs and queue in subs:
                subs.discard(queue)
                if not subs:
                    self._subscribers.pop(key, None)

    async def broadcast(self, project_id: UUID | str, event: dict[str, Any]) -> None:
        key = str(project_id)
        async with self._lock:
            subs = list(self._subscribers.get(key, ()))
        for q in subs:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("job event queue full for project %s, dropping", key)

    def subscriber_count(self, project_id: UUID | str) -> int:
        return len(self._subscribers.get(str(project_id), ()))


hub = JobEventHub()


async def publish_job_event(project_id: UUID | str, event: dict[str, Any]) -> None:
    """Publish a job event. Uses Redis PUBLISH if available, else in-memory."""
    pid = str(project_id)
    # Always broadcast locally (covers in-process dev fallback).
    await hub.broadcast(pid, event)
    # If Redis is configured, also publish so other processes (ARQ worker)
    # can reach the web process.
    if settings.jobs_use_queue:
        try:
            await _redis_publish(pid, event)
        except Exception:
            logger.debug("redis publish failed (non-fatal)", exc_info=True)


async def _redis_publish(project_id: str, event: dict[str, Any]) -> None:
    from app.services.redis_client import get_redis

    redis = await get_redis()
    if redis is None:
        return
    channel = f"{_CHANNEL_PREFIX}{project_id}"
    await redis.publish(channel, json.dumps(event, default=str))


# ─────────────────────────────────────────────────────────────────────────────
# Redis bridge: subscribe to job-events:* and forward to hub
# ─────────────────────────────────────────────────────────────────────────────

_bridge_task: asyncio.Task[None] | None = None


def start_redis_bridge() -> None:
    """Start the Redis pub/sub → hub bridge as a background task (if Redis)."""
    global _bridge_task
    if not settings.jobs_use_queue:
        return
    if _bridge_task is not None and not _bridge_task.done():
        return
    _bridge_task = asyncio.create_task(_redis_bridge_loop())


async def _redis_bridge_loop() -> None:
    from app.services.redis_client import get_redis

    redis = await get_redis()
    if redis is None:
        return
    pubsub = redis.pubsub()
    # Pattern subscribe to all project channels
    await pubsub.psubscribe(f"{_CHANNEL_PREFIX}*")
    logger.info("job-events redis bridge started")
    try:
        async for message in pubsub.listen():
            if message.get("type") != "pmessage":
                continue
            raw_channel = message.get("channel")
            raw_data = message.get("data")
            if not raw_channel or not raw_data:
                continue
            channel = raw_channel.decode() if isinstance(raw_channel, bytes) else str(raw_channel)
            project_id = channel[len(_CHANNEL_PREFIX):]
            try:
                event = json.loads(raw_data)
            except (json.JSONDecodeError, TypeError):
                continue
            await hub.broadcast(project_id, event)
    except asyncio.CancelledError:
        pass
    except Exception:
        logger.exception("job-events redis bridge crashed")
    finally:
        try:
            await pubsub.punsubscribe(f"{_CHANNEL_PREFIX}*")
            await pubsub.close()
        except Exception:
            pass
