"""Production startup validation."""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_SECRET = "change-me-in-production"


def validate_production_settings() -> None:
    if settings.is_sqlite:
        return
    if settings.ENVIRONMENT != "production":
        return

    if settings.SECRET_KEY == DEFAULT_SECRET:
        raise RuntimeError("SECRET_KEY must be set to a secure value in production")
    if settings.DEMO_USERS_ENABLED:
        raise RuntimeError(
            "DEMO_USERS_ENABLED must be false in production "
            "(demo accounts with known passwords are unsafe)"
        )
    if settings.ALLOW_REGISTRATION:
        # Open registration is a business decision; warn loudly but do not block startup
        # so that operators who intentionally enable it are not surprised.
        logger.warning(
            "ALLOW_REGISTRATION=true in production: open registration is enabled. "
            "Disable it unless this is intentional."
        )
    if not settings.jobs_use_queue:
        logger.warning(
            "REDIS_URL is empty: background jobs will run in-process inside the API. "
            "Configure REDIS_URL and run the ARQ worker container for reliable job execution."
        )
    if settings.DATABASE_URL.endswith("@localhost:5432/sppr"):
        logger.warning("DATABASE_URL appears to use default local credentials")
