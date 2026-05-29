# release: Scaning main (deploy trigger)
import asyncio
import logging
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.v1.router import router
from app.core.config import settings
from app.core.database import Base, engine
from app.core.sqlite_migrate import patch_postgres_schema, patch_sqlite_schema


logger = logging.getLogger(__name__)
BACKEND_ROOT = Path(__file__).resolve().parent.parent


def run_alembic_upgrade() -> None:
    proc = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        logger.error("Alembic upgrade failed: %s", (proc.stderr or proc.stdout).strip())
        raise RuntimeError("Alembic upgrade failed")
    if proc.stdout.strip():
        logger.info("Alembic: %s", proc.stdout.strip())


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.is_sqlite:
        Path("data").mkdir(exist_ok=True)
    elif not settings.is_sqlite:
        run_alembic_upgrade()

    async def init_db() -> None:
        async with engine.begin() as conn:
            if not settings.is_sqlite:
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
            await conn.run_sync(Base.metadata.create_all)
            if settings.is_sqlite:
                await conn.run_sync(patch_sqlite_schema)
            else:
                await conn.run_sync(patch_postgres_schema)

    try:
        await asyncio.wait_for(init_db(), timeout=30.0)
    except TimeoutError:
        logger.error("Database init timed out after 30s")
        raise
    except Exception:
        logger.exception("Database init failed")
        raise

    yield
    await engine.dispose()


app = FastAPI(
    title="СППР Нефтегаз API",
    description="MVP системы поддержки принятия решений",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/v1/docs",
    redoc_url="/api/v1/redoc",
    openapi_url="/api/v1/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok"}
