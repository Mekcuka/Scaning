"""Ensure demo accounts exist (idempotent; safe on every Postgres startup)."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash
from app.models import User
from app.models.enums import UserRole

DEMO_USERS: tuple[tuple[str, str, UserRole, str], ...] = (
    ("engineer@oilgas.ru", "Иванов И.И.", UserRole.analyst, "password123"),
    ("admin@oilgas.ru", "Админ Системы", UserRole.admin, "admin1234"),
    ("data@oilgas.ru", "Петров Д.М.", UserRole.data_manager, "data12345"),
    ("viewer@oilgas.ru", "Сидоров В.П.", UserRole.viewer, "viewer123"),
)


async def ensure_demo_users(db: AsyncSession) -> list[str]:
    """Create missing demo users. Returns emails that were created."""
    created: list[str] = []
    for email, username, role, password in DEMO_USERS:
        existing = await db.scalar(select(User).where(User.email == email))
        if existing:
            continue
        db.add(
            User(
                email=email,
                username=username,
                password_hash=get_password_hash(password),
                role=role.value,
            )
        )
        created.append(email)
    if created:
        await db.flush()
    return created
