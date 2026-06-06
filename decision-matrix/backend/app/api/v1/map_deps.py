"""Shared access helpers for map API routes."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject, PointOfInterest, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import resolve_project

async def get_user_project(project_id: UUID, user: User, db: AsyncSession) -> Project:
    return await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)


async def require_infra_write(project_id: UUID, user: User, db: AsyncSession) -> Project:
    return await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)


async def require_project_write(project_id: UUID, user: User, db: AsyncSession) -> Project:
    return await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.project)


async def get_poi(poi_id: UUID, project_id: UUID, db: AsyncSession) -> PointOfInterest:
    result = await db.execute(
        select(PointOfInterest).where(PointOfInterest.id == poi_id, PointOfInterest.project_id == project_id)
    )
    poi = result.scalar_one_or_none()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi


async def get_layer(layer_id: UUID, project_id: UUID, db: AsyncSession) -> InfrastructureLayer:
    result = await db.execute(
        select(InfrastructureLayer).where(
            InfrastructureLayer.id == layer_id, InfrastructureLayer.project_id == project_id
        )
    )
    layer = result.scalar_one_or_none()
    if not layer:
        raise HTTPException(status_code=404, detail="Layer not found")
    return layer


async def get_infra_object(object_id: UUID, project_id: UUID, db: AsyncSession) -> InfrastructureObject:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(InfrastructureObject.id == object_id, InfrastructureLayer.project_id == project_id)
    )
    obj = result.scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="Infrastructure object not found")
    return obj


async def get_or_create_default_layer(
    project_id: UUID,
    db: AsyncSession,
    source_type: str = "manual",
    name: str = "Инфраструктура",
) -> InfrastructureLayer:
    result = await db.execute(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id, InfrastructureLayer.source_type == source_type)
        .limit(1)
    )
    layer = result.scalar_one_or_none()
    if layer:
        return layer
    layer = InfrastructureLayer(
        project_id=project_id, name=name, layer_type="vector", source_type=source_type
    )
    db.add(layer)
    await db.flush()
    return layer
