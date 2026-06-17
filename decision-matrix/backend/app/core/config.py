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
    JOBS_SYNC_FALLBACK: bool = False
    # If ARQ enqueue succeeds but worker does not pick up the job, run in-process after this delay.
    JOB_QUEUE_WATCHDOG_SECONDS: int = 60
    # Expire stuck jobs so a new calculation can start (worker down / crash).
    JOB_STALE_PENDING_SECONDS: int = 900
    # Must be > worker job_timeout (600s) + safety margin to avoid expiring healthy jobs.
    JOB_STALE_RUNNING_SECONDS: int = 1200
    AUTOROAD_NETWORK_SERVICE_URL: str = ""
    AUTOROAD_NETWORK_INPROCESS: bool = True
    PAD_EARTHWORK_SERVICE_URL: str = ""
    PAD_EARTHWORK_INPROCESS: bool = True
    WELL_TRAJECTORY_SERVICE_URL: str = ""
    WELL_TRAJECTORY_INPROCESS: bool = True
    WELL_TRAJECTORY_IMPORT_ASYNC_THRESHOLD: int = 20
    WELL_TRAJECTORY_HTTP_TIMEOUT_SECONDS: float = 600.0
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
    OPENTOPOGRAPHY_API_KEY: str = ""
    OPENTOPOGRAPHY_DEM_TYPE: str = "COP30"
    OPENTOPOGRAPHY_TIMEOUT_SECONDS: int = 120
    PAD_DEM_DATA_ROOT: str = ""
    PAD_DEM_BBOX_PADDING_M: float = 50.0
    PAD_DEM_MIN_BBOX_SIDE_M: float = 300.0
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

    # === Backend stability: DB pool (phase 2) ===
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_PRE_PING: bool = True
    DB_POOL_RECYCLE_SECONDS: int = 1800
    DB_POOL_TIMEOUT_SECONDS: float = 30.0

    # === Backend stability: web server (phase 6) ===
    UVICORN_WORKERS: int = 1

    # === Backend stability: microservice HTTP timeouts (phase 4) ===
    HTTP_CONNECT_TIMEOUT_SECONDS: float = 10.0
    HTTP_READ_TIMEOUT_SECONDS: float = 60.0

    # === Backend stability: retry / circuit breaker (phase 4) ===
    MICROSERVICE_RETRY_MAX_ATTEMPTS: int = 3
    MICROSERVICE_RETRY_BASE_BACKOFF_SECONDS: float = 0.5
    MICROSERVICE_CIRCUIT_FAILURE_THRESHOLD: int = 5
    MICROSERVICE_CIRCUIT_RESET_TIMEOUT_SECONDS: int = 60

    # === Backend stability: worker / queue (phase 5) ===
    ARQ_MAX_JOBS: int = 4

    # === Backend stability: health checks (phase 5) ===
    HEALTH_CHECK_MICROSERVICES: bool = True
    HEALTH_CHECK_TIMEOUT_SECONDS: float = 2.0

    # === Backend stability: rate limit on compute endpoints (phase 5) ===
    COMPUTE_RATE_LIMIT: str = "30/minute"

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
