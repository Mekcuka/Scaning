from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql+asyncpg://sppr:sppr_secret@localhost:5432/sppr"
    )
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173,http://127.0.0.1:5174"
    ALGORITHM: str = "HS256"
    COOKIE_SECURE: bool | None = None
    AUTH_RATE_LIMIT: str = "10/minute"
    ENVIRONMENT: str = "development"
    DEMO_USERS_ENABLED: bool = True
    ALLOW_REGISTRATION: bool = True
    LOG_JSON: bool = False
    REDIS_URL: str = ""
    ARQ_QUEUE_NAME: str = "decision-matrix"
    JOBS_SYNC_FALLBACK: bool = True
    # Expire stuck jobs so a new calculation can start (worker down / crash).
    JOB_STALE_PENDING_SECONDS: int = 900
    JOB_STALE_RUNNING_SECONDS: int = 660

    @property
    def jobs_use_queue(self) -> bool:
        return bool(self.REDIS_URL.strip())

    @property
    def use_secure_cookies(self) -> bool:
        """HTTPS + cross-origin SPA (GitHub Pages) needs Secure cookies."""
        if self.COOKIE_SECURE is not None:
            return self.COOKIE_SECURE
        return not self.is_sqlite

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


settings = Settings()
