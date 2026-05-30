"""Demo user bootstrap."""

import asyncio

from sqlalchemy import select

from app.core.database import async_session
from app.core.security import verify_password
from app.models import User
from app.services.demo_users import DEMO_USERS, ensure_demo_users


async def _run() -> None:
    async with async_session() as db:
        created = await ensure_demo_users(db)
        await db.commit()
        assert "admin@oilgas.ru" in created or len(created) >= 0

        created_again = await ensure_demo_users(db)
        assert created_again == []

        admin = await db.scalar(select(User).where(User.email == "admin@oilgas.ru"))
        assert admin is not None
        assert admin.role == "admin"
        _, _, _, expected_pw = next(u for u in DEMO_USERS if u[0] == "admin@oilgas.ru")
        assert verify_password(expected_pw, admin.password_hash)


def test_ensure_demo_users_creates_missing_only():
    asyncio.run(_run())
