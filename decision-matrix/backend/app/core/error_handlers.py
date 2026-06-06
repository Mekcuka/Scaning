"""Centralized API error responses."""

import json
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError, ResponseValidationError
from fastapi.responses import JSONResponse

from app.core.config import settings

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
