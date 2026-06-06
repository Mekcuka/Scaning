"""Spatial query port (DIP) for POI environment analysis."""

from __future__ import annotations

from typing import Protocol, runtime_checkable
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointOfInterest
from app.services.spatial import (
    NearestResult,
    find_nearest_external_linear,
    find_nearest_object_by_subtype,
)


@runtime_checkable
class SpatialQueryPort(Protocol):
    async def find_nearest_object_by_subtype(
        self,
        db: AsyncSession,
        project_id: UUID,
        poi: PointOfInterest,
        subtype: str,
        *,
        nearest_policy: str = "point_on_line",
    ) -> NearestResult | None: ...

    async def find_nearest_external_linear(
        self,
        db: AsyncSession,
        project_id: UUID,
        poi: PointOfInterest,
        subtype: str,
    ) -> NearestResult | None: ...


class DefaultSpatialQuery:
    async def find_nearest_object_by_subtype(
        self,
        db: AsyncSession,
        project_id: UUID,
        poi: PointOfInterest,
        subtype: str,
        *,
        nearest_policy: str = "point_on_line",
    ) -> NearestResult | None:
        return await find_nearest_object_by_subtype(
            db,
            project_id,
            poi,
            subtype,
            nearest_policy=nearest_policy,
        )

    async def find_nearest_external_linear(
        self,
        db: AsyncSession,
        project_id: UUID,
        poi: PointOfInterest,
        subtype: str,
    ) -> NearestResult | None:
        return await find_nearest_external_linear(db, project_id, poi, subtype)


_default_spatial_query: SpatialQueryPort = DefaultSpatialQuery()


def get_spatial_query() -> SpatialQueryPort:
    return _default_spatial_query
