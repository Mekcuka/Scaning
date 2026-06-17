"""Exceptions for outbound microservice HTTP calls."""

from __future__ import annotations

import httpx


class MicroserviceError(Exception):
    """Base for all microservice interaction errors."""

    status_code: int = 502
    error_code: str = "microservice_error"

    def __init__(
        self,
        *,
        service_name: str = "unknown",
        upstream_status: int | None = None,
        message: str | None = None,
    ) -> None:
        self.service_name = service_name
        self.upstream_status = upstream_status
        super().__init__(message or self.error_code)


class MicroserviceUnavailableError(MicroserviceError):
    """Microservice is unreachable (connect refused, circuit open)."""

    status_code = 503
    error_code = "microservice_unavailable"


class MicroserviceTimeoutError(MicroserviceError):
    """Microservice read/connect timeout."""

    status_code = 503
    error_code = "microservice_timeout"


class MicroserviceResponseError(MicroserviceError):
    """Microservice returned HTTP 5xx."""

    status_code = 502
    error_code = "microservice_error"


def map_httpx_error(exc: Exception, *, service_name: str) -> MicroserviceError:
    if isinstance(exc, MicroserviceError):
        return exc
    if isinstance(exc, httpx.ConnectError):
        return MicroserviceUnavailableError(service_name=service_name)
    if isinstance(exc, (httpx.ReadTimeout, httpx.ConnectTimeout, httpx.WriteTimeout, httpx.PoolTimeout)):
        return MicroserviceTimeoutError(service_name=service_name)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status >= 500:
            return MicroserviceResponseError(
                service_name=service_name,
                upstream_status=status,
            )
    return MicroserviceResponseError(service_name=service_name, message=str(exc))
