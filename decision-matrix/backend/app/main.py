# release: Scaning main (deploy trigger)
import asyncio
import logging
import subprocess
import sys
from contextlib import AsyncExitStack, asynccontextmanager
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text

from app.api.v1.router import router
from app.api.v1.jobs_ws import jobs_ws_router
from app.assistant.transport import mcp_lifespan, mount_assistant_mcp
from app.core.config import settings
from app.core.http_client import close_http_client, set_main_event_loop
from app.core.database import Base, async_session, engine
from app.core.error_handlers import register_exception_handlers
from app.core.middleware import RequestLoggingMiddleware
from app.core.health_checks import build_health_payload
from app.core.rate_limit import limiter
from app.core.sqlite_migrate import patch_postgres_schema, patch_sqlite_schema
from app.core.startup_checks import validate_production_settings
from app.services.demo_users import ensure_demo_users
import app.services.pad_earthwork.pad_dem_listeners  # noqa: F401 — register ORM listeners

logger = logging.getLogger(__name__)
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def configure_logging() -> None:
    level = logging.INFO
    if settings.LOG_JSON:
        logging.basicConfig(level=level, format='{"level":"%(levelname)s","logger":"%(name)s","message":"%(message)s"}')
    else:
        logging.basicConfig(level=level, format="%(levelname)s %(name)s: %(message)s")


ALEMBIC_LOCK_KEY = 0x4D47_525A  # "MGRZ" — stable advisory lock key for migrations
ALEMBIC_LOCK_ACQUIRE_TIMEOUT = 60.0
ALEMBIC_LOCK_POLL_INTERVAL = 1.0
ALEMBIC_SUBPROCESS_TIMEOUT = 180


def _run_alembic_subprocess() -> None:
    """Synchronous alembic upgrade with timeout. Raises RuntimeError on failure or timeout."""
    try:
        proc = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=BACKEND_ROOT,
            capture_output=True,
            text=True,
            timeout=ALEMBIC_SUBPROCESS_TIMEOUT,
        )
    except subprocess.TimeoutExpired as exc:
        logger.error("Alembic upgrade timed out after %ss", ALEMBIC_SUBPROCESS_TIMEOUT)
        raise RuntimeError("Alembic upgrade timed out") from exc
    if proc.returncode != 0:
        logger.error("Alembic upgrade failed: %s", (proc.stderr or proc.stdout).strip())
        raise RuntimeError("Alembic upgrade failed")
    if proc.stdout.strip():
        logger.info("Alembic: %s", proc.stdout.strip())


async def run_alembic_upgrade_async() -> None:
    """Run alembic upgrade under a Postgres advisory lock.

    With multiple uvicorn workers, only the first one acquires the lock and runs
    migrations; others wait for the lock to be released (migrations done).
    SQLite and non-prod environments skip the lock and run unconditionally.
    """
    if settings.is_sqlite or settings.ENVIRONMENT != "production":
        _run_alembic_subprocess()
        return

    deadline = asyncio.get_event_loop().time() + ALEMBIC_LOCK_ACQUIRE_TIMEOUT
    async with engine.begin() as conn:
        acquired = False
        while asyncio.get_event_loop().time() < deadline:
            result = await conn.execute(text(f"SELECT pg_try_advisory_lock({ALEMBIC_LOCK_KEY})"))
            if result.scalar():
                acquired = True
                break
            await asyncio.sleep(ALEMBIC_LOCK_POLL_INTERVAL)
        if not acquired:
            raise RuntimeError(
                f"Could not acquire alembic advisory lock within {ALEMBIC_LOCK_ACQUIRE_TIMEOUT}s"
            )
        try:
            logger.info("Acquired alembic advisory lock; running migrations")
            await asyncio.to_thread(_run_alembic_subprocess)
        finally:
            await conn.execute(text(f"SELECT pg_advisory_unlock({ALEMBIC_LOCK_KEY})"))
            logger.info("Released alembic advisory lock")


def alembic_head_revision() -> str | None:
    try:
        cfg = Config(str(BACKEND_ROOT / "alembic.ini"))
        script = ScriptDirectory.from_config(cfg)
        return script.get_current_head()
    except Exception:
        logger.exception("Failed to read Alembic head revision")
        return None


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    validate_production_settings()
    set_main_event_loop(asyncio.get_running_loop())

    if settings.is_sqlite:
        Path("data").mkdir(exist_ok=True)

    async def init_db() -> None:
        async with engine.begin() as conn:
            if not settings.is_sqlite:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            if settings.is_sqlite:
                await conn.run_sync(Base.metadata.create_all)
                await conn.run_sync(patch_sqlite_schema)
            elif settings.ENVIRONMENT != "production":
                await conn.run_sync(Base.metadata.create_all)
            if not settings.is_sqlite:
                await conn.run_sync(patch_postgres_schema)

    async with AsyncExitStack() as stack:
        if settings.ASSISTANT_MCP_ENABLED:
            await stack.enter_async_context(mcp_lifespan())

        try:
            await asyncio.wait_for(init_db(), timeout=30.0)
            if not settings.is_sqlite and settings.ENVIRONMENT == "production":
                await run_alembic_upgrade_async()
            if settings.DEMO_USERS_ENABLED and not settings.is_sqlite:
                async with async_session() as db:
                    created = await ensure_demo_users(db)
                    await db.commit()
                    if created:
                        logger.info("Created demo users: %s", ", ".join(created))
        except TimeoutError:
            logger.error("Database init timed out after 30s")
            raise
        except Exception:
            logger.exception("Database init failed")
            raise

        yield

    await engine.dispose()
    await close_http_client()


app = FastAPI(
    title="СППР Нефтегаз API",
    description="MVP системы поддержки принятия решений",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)
app.state.limiter = limiter
# Rate limits apply in production only; local dev and CI test runs register many users.
if settings.ENVIRONMENT != "production":
    app.state.limiter.enabled = False
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
register_exception_handlers(app)
app.add_middleware(RequestLoggingMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Authorization",
        "Content-Type",
        "X-CSRF-Token",
        "X-Request-ID",
        "Mcp-Session-Id",
        "MCP-Protocol-Version",
    ],
    expose_headers=["X-CSRF-Token", "X-Request-ID", "Mcp-Session-Id"],
)

app.include_router(router, prefix="/api/v1")
# WebSocket routes live outside the CSRF-protected HTTP router.
app.include_router(jobs_ws_router, prefix="/api/v1")

if settings.ASSISTANT_MCP_ENABLED:
    mount_assistant_mcp(app)


@app.get("/", include_in_schema=False)
async def root():
    """Backend has no HTML UI — redirect to Swagger."""
    return RedirectResponse(url="/api/v1/docs")


@app.get("/health")
async def health():
    return await build_health_payload(alembic_head=alembic_head_revision())
