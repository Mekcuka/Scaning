from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

_connect_args: dict = {}
_engine_kwargs: dict = {"echo": False}

if settings.is_sqlite:
    _connect_args["check_same_thread"] = False
    Path("data").mkdir(exist_ok=True)
    # NullPool opens/closes a fresh connection per session — avoids cross-thread
    # transaction races and is safe for the aiosqlite + check_same_thread=False combo.
    # SQLite serializes writes via the on-connect PRAGMA busy_timeout below.
    _engine_kwargs["poolclass"] = NullPool
elif "postgresql" in settings.DATABASE_URL:
    _connect_args["timeout"] = 10
    # PostgreSQL: configure QueuePool via engine kwargs.
    _engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    _engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    _engine_kwargs["pool_pre_ping"] = settings.DB_POOL_PRE_PING
    _engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE_SECONDS
    _engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT_SECONDS

engine = create_async_engine(settings.DATABASE_URL, connect_args=_connect_args, **_engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


if settings.is_sqlite:

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _connection_record) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session
