"""Shared project/POI access helpers for v1 API routes."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointOfInterest, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import resolve_project


async def get_user_project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    min_access: AccessLevel = AccessLevel.read,
    write_scope: WriteScope = WriteScope.project,
) -> Project:
    return await resolve_project(
        project_id, user, db, min_access=min_access, write_scope=write_scope
    )


async def get_poi(poi_id: UUID, project_id: UUID, db: AsyncSession) -> PointOfInterest:
    result = await db.execute(
        select(PointOfInterest).where(PointOfInterest.id == poi_id, PointOfInterest.project_id == project_id)
    )
    poi = result.scalar_one_or_none()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi
