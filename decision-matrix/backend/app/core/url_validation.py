"""Validate outbound HTTP URLs to mitigate SSRF."""

from ipaddress import ip_address
from urllib.parse import urlparse

import httpx

ALLOWED_SCHEMES = frozenset({"http", "https"})
BLOCKED_HOSTS = frozenset({"localhost", "127.0.0.1", "0.0.0.0", "::1"})


def _is_private_ip(host: str) -> bool:
    try:
        addr = ip_address(host)
    except ValueError:
        return False
    return addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved


def validate_outbound_url(url: str) -> str:
    """Return normalized URL or raise ValueError with a safe message."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in ALLOWED_SCHEMES:
        raise ValueError("Only http and https URLs are allowed")
    if not parsed.hostname:
        raise ValueError("URL must include a hostname")
    host = parsed.hostname.lower()
    if host in BLOCKED_HOSTS or host.endswith(".local"):
        raise ValueError("URL host is not allowed")
    if _is_private_ip(host):
        raise ValueError("Private and loopback addresses are not allowed")
    return url.strip()


async def safe_http_get(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    auth: httpx.Auth | None = None,
    timeout: float = 15.0,
) -> httpx.Response:
    validate_outbound_url(url)
    async with httpx.AsyncClient(timeout=timeout) as client:
        return await client.get(url, headers=headers or {}, auth=auth)
