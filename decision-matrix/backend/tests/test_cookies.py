"""Tests for auth cookie attributes."""

from unittest.mock import MagicMock

from app.core.cookies import clear_auth_cookies, set_auth_cookies
from app.core.config import settings


def test_set_auth_cookies_secure_uses_samesite_none(monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    response = MagicMock()

    set_auth_cookies(response, access_token="a", refresh_token="r")

    for call in response.set_cookie.call_args_list:
        assert call.kwargs["secure"] is True
        assert call.kwargs["samesite"] == "none"


def test_set_auth_cookies_local_uses_samesite_lax(monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SECURE", False)
    response = MagicMock()

    set_auth_cookies(response, access_token="a", refresh_token="r")

    for call in response.set_cookie.call_args_list:
        assert call.kwargs["secure"] is False
        assert call.kwargs["samesite"] == "lax"


def test_clear_auth_cookies_expires_cookies(monkeypatch):
    monkeypatch.setattr(settings, "COOKIE_SECURE", True)
    response = MagicMock()

    clear_auth_cookies(response)

    assert response.delete_cookie.call_count == 0
    assert response.set_cookie.call_count == 3
    for call in response.set_cookie.call_args_list:
        assert call.kwargs["max_age"] == 0
        assert call.kwargs["secure"] is True
        assert call.kwargs["samesite"] == "none"
        assert call.kwargs["value"] == ""
