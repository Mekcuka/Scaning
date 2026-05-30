"""Tests for client IP resolution behind reverse proxy."""

from unittest.mock import MagicMock

from app.core.rate_limit import get_client_ip


def test_get_client_ip_uses_x_forwarded_for():
    request = MagicMock()
    request.headers = {"X-Forwarded-For": "203.0.113.10, 10.0.0.1"}
    request.client = MagicMock(host="172.18.0.4")
    assert get_client_ip(request) == "203.0.113.10"


def test_get_client_ip_falls_back_to_client_host():
    request = MagicMock()
    request.headers = {}
    request.client = MagicMock(host="127.0.0.1")
    assert get_client_ip(request) == "127.0.0.1"
