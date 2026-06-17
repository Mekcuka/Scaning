"""Centralized API error responses."""

import json
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.microservice_errors import MicroserviceError

logger = logging.getLogger(__name__)


def _json_safe(value: object) -> object:
    """Make Pydantic/FastAPI error payloads JSON-serializable."""
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, dict):
        cleaned = {k: _json_safe(v) for k, v in value.items() if k != "input"}
        return cleaned
    try:
        json.dumps(value)
        return value
    except (TypeError, ValueError):
        return str(value)


def _error_detail(exc: Exception, *, fallback: str = "Internal server error") -> str:
    if settings.ENVIRONMENT == "development":
        return f"{type(exc).__name__}: {exc}"
    return fallback


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(MicroserviceError)
    async def microservice_error_handler(request: Request, exc: MicroserviceError):
        request_id = getattr(request.state, "request_id", None)
        headers: dict[str, str] = {}
        if exc.status_code == 503:
            headers["Retry-After"] = "5"
        content: dict[str, object] = {
            "detail": exc.error_code,
            "request_id": request_id,
            "microservice": exc.service_name,
        }
        if exc.upstream_status is not None:
            content["upstream_status"] = exc.upstream_status
        logger.warning(
            "Microservice error [%s] service=%s code=%s upstream=%s",
            request_id,
            exc.service_name,
            exc.error_code,
            exc.upstream_status,
        )
        return JSONResponse(status_code=exc.status_code, content=content, headers=headers)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        request_id = getattr(request.state, "request_id", None)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "detail": exc.detail,
                "request_id": request_id,
            },
            headers=getattr(exc, "headers", None) or {},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        request_id = getattr(request.state, "request_id", None)
        if settings.ENVIRONMENT == "development":
            logger.warning(
                "Request validation failed [%s] on %s %s: %s",
                request_id,
                request.method,
                request.url.path,
                exc.errors()[:3],
            )
        return JSONResponse(
            status_code=422,
            content={
                "detail": _json_safe(exc.errors()),
                "request_id": request_id,
            },
        )

    @app.exception_handler(ResponseValidationError)
    async def response_validation_exception_handler(request: Request, exc: ResponseValidationError):
        request_id = getattr(request.state, "request_id", None)
        logger.exception("Response validation failed [%s] on %s %s", request_id, request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={
                "detail": _error_detail(exc),
                "request_id": request_id,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "Unhandled error [%s] on %s %s",
            request_id,
            request.method,
            request.url.path,
        )
        return JSONResponse(
            status_code=500,
            content={
                "detail": _error_detail(exc),
                "request_id": request_id,
            },
        )
