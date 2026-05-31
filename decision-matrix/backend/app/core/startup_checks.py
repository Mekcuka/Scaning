"""Production startup validation."""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_SECRET = "change-me-in-production"


def validate_production_settings() -> None:
    if settings.is_sqlite:
        return
    if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == DEFAULT_SECRET:
        raise RuntimeError("SECRET_KEY must be set to a secure value in production")
    if settings.ENVIRONMENT == "production" and settings.DATABASE_URL.endswith("@localhost:5432/sppr"):
        logger.warning("DATABASE_URL appears to use default local credentials")
