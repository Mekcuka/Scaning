"""Singleton httpx.AsyncClient for outbound microservice calls.

A shared client reuses TCP connections (keep-alive) and centralizes timeout/limits
configuration. The client is lazily created on first use inside the running event
loop and must be closed on application shutdown via `close_http_client()`.

Sync code running in ``asyncio.to_thread`` workers can call ``run_on_main_loop(coro)``
to schedule coroutines on the main loop without blocking it with sync httpx.

Usage in services:
    from app.core.http_client import get_http_client
    client = await get_http_client()
    resp = await client.get(url)

Lifespan (main.py):
    set_main_event_loop(asyncio.get_running_loop())
    ...
    await close_http_client()
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Coroutine
from types import TracebackType
from typing import Any, TypeVar

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

_client: httpx.AsyncClient | None = None
_main_loop: asyncio.AbstractEventLoop | None = None


def _build_timeout() -> httpx.Timeout:
    return httpx.Timeout(
        connect=settings.HTTP_CONNECT_TIMEOUT_SECONDS,
        read=settings.HTTP_READ_TIMEOUT_SECONDS,
        write=settings.HTTP_READ_TIMEOUT_SECONDS,
        pool=settings.HTTP_CONNECT_TIMEOUT_SECONDS,
    )


def _build_limits() -> httpx.Limits:
    return httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
        keepalive_expiry=30.0,
    )


async def get_http_client() -> httpx.AsyncClient:
    """Return the process-wide AsyncClient; create it on first call.

    Must be called from within the running event loop. The client binds its
    connection pool to the loop that created it.
    """
    global _client
    if _client is not None:
        return _client
    logger.info("Initializing shared httpx.AsyncClient")
    _client = httpx.AsyncClient(
        timeout=_build_timeout(),
        limits=_build_limits(),
        http2=False,
    )
    return _client


def set_main_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    """Bind the process main event loop (call once from FastAPI lifespan)."""
    global _main_loop
    _main_loop = loop


def run_on_main_loop(coro: Coroutine[Any, Any, T], *, timeout: float | None = None) -> T:
    """Run *coro* on the main loop from a sync context or worker thread.

    When called from inside ``asyncio.to_thread``, schedules the coroutine on the
    main loop so the shared AsyncClient stays bound to a single event loop.
    """
    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None

    if running is not None:
        if running is _main_loop:
            raise RuntimeError("run_on_main_loop called from async handler; use await instead")
        if _main_loop is not None:
            future = asyncio.run_coroutine_threadsafe(coro, _main_loop)
            return future.result(timeout=timeout)
        return asyncio.run(coro)

    if _main_loop is not None and _main_loop.is_running():
        future = asyncio.run_coroutine_threadsafe(coro, _main_loop)
        return future.result(timeout=timeout)
    return asyncio.run(coro)


async def close_http_client() -> None:
    """Close the shared client; idempotent. Call on application shutdown."""
    global _client
    if _client is None:
        return
    logger.info("Closing shared httpx.AsyncClient")
    try:
        await _client.aclose()
    except Exception:
        logger.debug("Error closing httpx.AsyncClient", exc_info=True)
    _client = None


class _HttpClientContext:
    """Async context manager wrapping the singleton (for `stack.push_async_close`)."""

    async def __aenter__(self) -> httpx.AsyncClient:
        return await get_http_client()

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        await close_http_client()


def http_client_lifespan() -> _HttpClientContext:
    """Return an async context manager bound to the singleton client lifecycle."""
    return _HttpClientContext()


def is_http_client_initialized() -> bool:
    """True if the shared client has been created (for tests/diagnostics)."""
    return _client is not None


def reset_http_client_for_tests() -> None:
    """Drop the cached client so the next get_http_client() rebuilds it.

    Intended for unit tests that need to swap settings between cases.
    """
    global _client, _main_loop
    _client = None
    _main_loop = None
