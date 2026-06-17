"""Tests for strict production startup validation."""

import logging

import pytest

from app.core import startup_checks


@pytest.fixture
def prod_env(monkeypatch):
    """Force production-like settings without SQLite."""
    monkeypatch.setattr(startup_checks.settings, "ENVIRONMENT", "production")
    # is_sqlite is a property reading DATABASE_URL; patch the URL to postgres.
    monkeypatch.setattr(
        startup_checks.settings, "DATABASE_URL", "postgresql+asyncpg://x:x@db:5432/sppr"
    )
    yield


def test_validate_raises_on_demo_users_in_production(prod_env, monkeypatch):
    monkeypatch.setattr(startup_checks.settings, "SECRET_KEY", "real-secret")
    monkeypatch.setattr(startup_checks.settings, "DEMO_USERS_ENABLED", True)
    monkeypatch.setattr(startup_checks.settings, "ALLOW_REGISTRATION", False)
    monkeypatch.setattr(startup_checks.settings, "REDIS_URL", "redis://redis:6379")
    with pytest.raises(RuntimeError, match="DEMO_USERS_ENABLED"):
        startup_checks.validate_production_settings()


def test_validate_raises_on_default_secret_in_production(prod_env, monkeypatch):
    monkeypatch.setattr(startup_checks.settings, "SECRET_KEY", startup_checks.DEFAULT_SECRET)
    monkeypatch.setattr(startup_checks.settings, "DEMO_USERS_ENABLED", False)
    with pytest.raises(RuntimeError, match="SECRET_KEY"):
        startup_checks.validate_production_settings()


def test_validate_warns_on_empty_redis_in_production(prod_env, monkeypatch, caplog):
    monkeypatch.setattr(startup_checks.settings, "SECRET_KEY", "real-secret")
    monkeypatch.setattr(startup_checks.settings, "DEMO_USERS_ENABLED", False)
    monkeypatch.setattr(startup_checks.settings, "REDIS_URL", "")
    with caplog.at_level(logging.WARNING):
        startup_checks.validate_production_settings()
    assert any("REDIS_URL" in rec.message for rec in caplog.records)


def test_validate_warns_on_open_registration(prod_env, monkeypatch, caplog):
    monkeypatch.setattr(startup_checks.settings, "SECRET_KEY", "real-secret")
    monkeypatch.setattr(startup_checks.settings, "DEMO_USERS_ENABLED", False)
    monkeypatch.setattr(startup_checks.settings, "ALLOW_REGISTRATION", True)
    monkeypatch.setattr(startup_checks.settings, "REDIS_URL", "redis://redis:6379")
    with caplog.at_level(logging.WARNING):
        startup_checks.validate_production_settings()
    assert any("ALLOW_REGISTRATION" in rec.message for rec in caplog.records)


def test_validate_passes_when_safe(prod_env, monkeypatch):
    monkeypatch.setattr(startup_checks.settings, "SECRET_KEY", "real-secret")
    monkeypatch.setattr(startup_checks.settings, "DEMO_USERS_ENABLED", False)
    monkeypatch.setattr(startup_checks.settings, "ALLOW_REGISTRATION", False)
    monkeypatch.setattr(startup_checks.settings, "REDIS_URL", "redis://redis:6379")
    # Should not raise.
    startup_checks.validate_production_settings()


def test_validate_skipped_for_non_production(monkeypatch):
    monkeypatch.setattr(startup_checks.settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(startup_checks.settings, "SECRET_KEY", startup_checks.DEFAULT_SECRET)
    monkeypatch.setattr(startup_checks.settings, "DEMO_USERS_ENABLED", True)
    # No exception.
    startup_checks.validate_production_settings()
