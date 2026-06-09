"""Assistant per-role rate limit helpers."""

from app.assistant.rate_limit import (
    get_assistant_chat_rate_limit,
    get_assistant_mcp_rate_limit,
)
from app.core.config import settings
from app.models.enums import UserRole


def test_chat_rate_limit_by_role():
    assert get_assistant_chat_rate_limit(UserRole.viewer) == settings.ASSISTANT_CHAT_RATE_LIMIT_VIEWER
    assert get_assistant_chat_rate_limit(UserRole.analyst) == settings.ASSISTANT_CHAT_RATE_LIMIT_DEFAULT
    assert get_assistant_chat_rate_limit(UserRole.admin) == settings.ASSISTANT_CHAT_RATE_LIMIT_ADMIN


def test_mcp_rate_limit_by_role():
    assert get_assistant_mcp_rate_limit(UserRole.viewer) == settings.ASSISTANT_MCP_RATE_LIMIT_VIEWER
    assert get_assistant_mcp_rate_limit(UserRole.analyst) == settings.ASSISTANT_MCP_RATE_LIMIT_DEFAULT
    assert get_assistant_mcp_rate_limit(UserRole.admin) == settings.ASSISTANT_MCP_RATE_LIMIT_ADMIN
