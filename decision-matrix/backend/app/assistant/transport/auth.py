"""JWT auth for HTTP MCP — ContextVar user + Starlette middleware."""

from __future__ import annotations

from contextvars import ContextVar
from uuid import UUID

from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.types import ASGIApp

from app.api.deps import _extract_access_token
from limits import parse

from app.assistant.rate_limit import assistant_rate_limit_key, mcp_rate_limit_value
from app.core.database import async_session
from app.core.rate_limit import limiter
from app.core.security import decode_token
from app.models import User

_mcp_user_ctx: ContextVar[User | None] = ContextVar("mcp_user", default=None)


def require_mcp_user() -> User:
    user = _mcp_user_ctx.get()
    if user is None:
        raise RuntimeError("MCP user context not set")
    return user


def _credentials_from_request(request: Request) -> HTTPAuthorizationCredentials | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    return None


async def resolve_mcp_user(request: Request) -> User:
    """Resolve active user from Bearer JWT or access cookie (same as REST deps)."""
    token = _extract_access_token(request, _credentials_from_request(request))
    if not token:
        raise ValueError("missing_token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise ValueError("invalid_token")
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError):
        raise ValueError("invalid_token") from None

    async with async_session() as db:
        result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
        user = result.scalar_one_or_none()
        if not user:
            raise ValueError("user_not_found")
        return user


class McpAuthMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        try:
            user = await resolve_mcp_user(request)
        except ValueError:
            return JSONResponse(
                status_code=401,
                content={"detail": "Сессия не найдена. Войдите снова"},
            )
        if limiter.enabled:
            limit_value = mcp_rate_limit_value(request)
            key = assistant_rate_limit_key(request)
            if not limiter.limiter.hit(parse(limit_value), key):
                return JSONResponse(
                    status_code=429,
                    content={"detail": "Превышен лимит запросов MCP"},
                )
        token = _mcp_user_ctx.set(user)
        try:
            return await call_next(request)
        finally:
            _mcp_user_ctx.reset(token)
