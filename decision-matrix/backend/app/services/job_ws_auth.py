"""WebSocket auth helpers — keep SQL out of route layer."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select

from app.core.database import async_session
from app.core.security import decode_token
from app.models import Project, User
from app.services.project_access import can_read_project


async def get_user_from_ws_token(token: str | None) -> User | None:
    if not token:
        return None
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        user_id = UUID(payload["sub"])
    except (ValueError, KeyError, Exception):
        return None
    async with async_session() as db:
        result = await db.execute(
            select(User).where(User.id == user_id, User.is_active.is_(True))
        )
        return result.scalar_one_or_none()


async def user_can_read_project(user: User, project_id: UUID) -> bool:
    async with async_session() as db:
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if project is None:
            return False
        return can_read_project(user, project)


async def project_exists(project_id: UUID) -> bool:
    async with async_session() as db:
        result = await db.execute(select(Project.id).where(Project.id == project_id))
        return result.scalar_one_or_none() is not None
