"""Bootstrap DB schema before Alembic (migrations are incremental patches)."""

import asyncio

import app.models  # noqa: F401 — register ORM models on Base.metadata
from sqlalchemy import text

from app.core.config import settings
from app.core.database import Base, engine
from app.core.sqlite_migrate import patch_postgres_schema, patch_sqlite_schema


async def main() -> None:
    async with engine.begin() as conn:
        if not settings.is_sqlite:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        await conn.run_sync(Base.metadata.create_all)
        if settings.is_sqlite:
            await conn.run_sync(patch_sqlite_schema)
        else:
            await conn.run_sync(patch_postgres_schema)


if __name__ == "__main__":
    asyncio.run(main())
