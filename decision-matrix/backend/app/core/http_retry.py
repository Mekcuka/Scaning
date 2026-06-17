"""Retry helpers for outbound microservice HTTP calls."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

import httpx
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential_jitter,
)

from app.core.config import settings
from app.core.microservice_errors import (
    MicroserviceError,
    MicroserviceResponseError,
    map_httpx_error,
)

logger = logging.getLogger(__name__)

T = TypeVar("T")

_RETRY_EXCEPTIONS = (
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.ConnectTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    MicroserviceResponseError,
)


async def retry_microservice_call(
    fn: Callable[[], Awaitable[T]],
    *,
    service_name: str,
) -> T:
    """Retry async HTTP call with exponential backoff; map httpx errors."""
    attempt = 0
    async for attempt_state in AsyncRetrying(
        stop=stop_after_attempt(settings.MICROSERVICE_RETRY_MAX_ATTEMPTS),
        wait=wait_exponential_jitter(
            initial=settings.MICROSERVICE_RETRY_BASE_BACKOFF_SECONDS,
            max=8.0,
        ),
        retry=retry_if_exception_type(_RETRY_EXCEPTIONS),
        reraise=True,
    ):
        with attempt_state:
            attempt = attempt_state.retry_state.attempt_number
            try:
                return await fn()
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code >= 500:
                    logger.warning(
                        "microservice_http_5xx service=%s attempt=%s status=%s",
                        service_name,
                        attempt,
                        exc.response.status_code,
                    )
                    raise MicroserviceResponseError(
                        service_name=service_name,
                        upstream_status=exc.response.status_code,
                    ) from exc
                raise map_httpx_error(exc, service_name=service_name) from exc
            except Exception as exc:
                mapped = map_httpx_error(exc, service_name=service_name)
                if isinstance(mapped, MicroserviceResponseError):
                    logger.warning(
                        "microservice_retry service=%s attempt=%s error=%s",
                        service_name,
                        attempt,
                        mapped.error_code,
                    )
                raise mapped from exc

    raise MicroserviceError(service_name=service_name)  # pragma: no cover
