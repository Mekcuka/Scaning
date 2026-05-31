"""SSRF protection for import connection URLs."""

import pytest

from app.core.url_validation import validate_outbound_url


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1/api",
        "http://localhost/data",
        "http://169.254.169.254/latest/meta-data",
        "ftp://example.com/data",
        "http://",
    ],
)
def test_validate_outbound_url_blocks_unsafe(url: str):
    with pytest.raises(ValueError):
        validate_outbound_url(url)


def test_validate_outbound_url_allows_public_https():
    assert validate_outbound_url("https://api.example.com/v1/objects") == "https://api.example.com/v1/objects"
