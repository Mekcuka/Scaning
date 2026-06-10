"""Assistant per-role rate limit helpers."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.assistant.rate_limit import (
    enforce_chat_rate_limit,
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


def test_enforce_chat_rate_limit_raises_when_exceeded():
    request = MagicMock()
    with (
        patch("app.assistant.rate_limit.limiter") as mock_limiter,
        patch("app.assistant.rate_limit.chat_rate_limit_value", return_value="1/minute"),
        patch("app.assistant.rate_limit.assistant_rate_limit_key", return_value="1.2.3.4:user"),
    ):
        mock_limiter.enabled = True
        mock_limiter.limiter.hit.return_value = False
        with pytest.raises(HTTPException) as exc:
            enforce_chat_rate_limit(request)
        assert exc.value.status_code == 429
