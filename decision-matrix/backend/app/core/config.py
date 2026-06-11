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
    AUTH_RATE_LIMIT: str = "100/minute"
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
    AUTOROAD_NETWORK_SERVICE_URL: str = ""
    AUTOROAD_NETWORK_INPROCESS: bool = True
    AUTOROAD_NETWORK_SOLVER: str = "geosteiner"
    GEOSTEINER_BIN_DIR: str = ""
    ASSISTANT_MCP_ENABLED: bool = True
    ASSISTANT_MCP_PATH: str = "/api/v1/mcp"
    ASSISTANT_CHAT_ENABLED: bool = True
    ASSISTANT_LLM_BASE_URL: str = "http://127.0.0.1:1234/v1"
    ASSISTANT_LLM_API_KEY: str = "lm-studio"
    ASSISTANT_LLM_MODEL: str = ""
    ASSISTANT_LLM_MAX_TOKENS: int = 1024
    ASSISTANT_LLM_TIMEOUT_SECONDS: int = 120
    ASSISTANT_CHAT_MAX_TOOL_ROUNDS: int = 8
    ASSISTANT_CHAT_MAX_TOOL_ROUNDS_VIEWER: int = 4
    MAP3D_MODELS_ROOT: str = ""
    ASSISTANT_CHAT_MAX_ROUTED_TOOLS: int = 12
    ASSISTANT_CHAT_HISTORY_ENABLED: bool = True
    ASSISTANT_CHAT_RATE_LIMIT: str = "20/minute"
    ASSISTANT_CHAT_RATE_LIMIT_VIEWER: str = "10/minute"
    ASSISTANT_CHAT_RATE_LIMIT_DEFAULT: str = "20/minute"
    ASSISTANT_CHAT_RATE_LIMIT_ADMIN: str = "40/minute"
    ASSISTANT_MCP_RATE_LIMIT: str = "30/minute"
    ASSISTANT_MCP_RATE_LIMIT_VIEWER: str = "15/minute"
    ASSISTANT_MCP_RATE_LIMIT_DEFAULT: str = "30/minute"
    ASSISTANT_MCP_RATE_LIMIT_ADMIN: str = "60/minute"
    ASSISTANT_DEV_MCP_ENABLED: bool = True
    ASSISTANT_DEV_MCP_DOMAIN_TOOLS: bool = False
    ASSISTANT_DEV_MCP_USER_EMAIL: str = "admin@test.ru"
    ASSISTANT_DEV_MCP_REPO_ROOT: str = ""
    ASSISTANT_WIKI_ENABLED: bool = True
    ASSISTANT_WIKI_ROOT: str = ""
    ASSISTANT_WIKI_MAX_ARTICLE_CHARS: int = 12000
    ASSISTANT_WIKI_RAG_ENABLED: bool = True
    ASSISTANT_WIKI_EMBEDDING_MODEL: str = ""
    ASSISTANT_WIKI_EMBEDDING_BASE_URL: str = ""
    ASSISTANT_WIKI_EMBEDDING_API_KEY: str = ""
    ASSISTANT_WIKI_RAG_KEYWORD_WEIGHT: float = 0.35
    ASSISTANT_WIKI_RAG_VECTOR_WEIGHT: float = 0.65
    ASSISTANT_WIKI_RAG_MIN_SCORE: float = 0.15

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
