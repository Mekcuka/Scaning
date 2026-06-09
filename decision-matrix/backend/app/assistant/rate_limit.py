"""Per-role rate limits for assistant chat and HTTP MCP."""

from __future__ import annotations

from fastapi import Request
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import _extract_access_token
from app.core.config import settings
from app.core.rate_limit import get_client_ip
from app.core.security import decode_token
from app.models.enums import UserRole


def _credentials_from_request(request: Request) -> HTTPAuthorizationCredentials | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        if token:
            return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    return None


def role_from_request(request: Request) -> UserRole:
    try:
        token = _extract_access_token(request, _credentials_from_request(request))
        if not token:
            return UserRole.viewer
        payload = decode_token(token)
        return UserRole(payload.get("role", UserRole.viewer.value))
    except (ValueError, KeyError):
        return UserRole.viewer


def get_assistant_chat_rate_limit(role: UserRole) -> str:
    if role == UserRole.admin:
        return settings.ASSISTANT_CHAT_RATE_LIMIT_ADMIN
    if role == UserRole.viewer:
        return settings.ASSISTANT_CHAT_RATE_LIMIT_VIEWER
    return settings.ASSISTANT_CHAT_RATE_LIMIT_DEFAULT


def get_assistant_mcp_rate_limit(role: UserRole) -> str:
    if role == UserRole.admin:
        return settings.ASSISTANT_MCP_RATE_LIMIT_ADMIN
    if role == UserRole.viewer:
        return settings.ASSISTANT_MCP_RATE_LIMIT_VIEWER
    return settings.ASSISTANT_MCP_RATE_LIMIT_DEFAULT


def assistant_rate_limit_key(request: Request) -> str:
    ip = get_client_ip(request)
    try:
        token = _extract_access_token(request, _credentials_from_request(request))
        if token:
            payload = decode_token(token)
            sub = payload.get("sub", "anon")
            return f"{ip}:{sub}"
    except (ValueError, KeyError):
        pass
    return f"{ip}:anon"


def chat_rate_limit_value(request: Request) -> str:
    return get_assistant_chat_rate_limit(role_from_request(request))


def mcp_rate_limit_value(request: Request) -> str:
    return get_assistant_mcp_rate_limit(role_from_request(request))
