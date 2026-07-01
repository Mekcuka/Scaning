"""Compute project DEM bounding box from infrastructure objects."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.pad_earthwork.dem_store import compute_dem_bbox
from app.services.spatial import line_coords_from_object
from app.subtype_manifest import BOTTOMHOLE_CLUSTER_SUBTYPES
from app.core.config import settings


def _object_lonlat_points(obj: InfrastructureObject) -> list[tuple[float, float]]:
    if obj.subtype in LINE_SUBTYPES:
        coords = line_coords_from_object(obj)
        if len(coords) >= 2:
            return coords
    return [(float(obj.longitude), float(obj.latitude))]


async def collect_bbox_corners(
    db: AsyncSession,
    project_id: UUID,
) -> list[tuple[float, float]]:
    rows = (
        await db.execute(
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureLayer.is_visible.is_(True),
                InfrastructureObject.subtype.notin_(BOTTOMHOLE_CLUSTER_SUBTYPES),
            )
        )
    ).scalars().all()
    corners: list[tuple[float, float]] = []
    for obj in rows:
        corners.extend(_object_lonlat_points(obj))
    return corners


async def compute_project_dem_bbox(
    db: AsyncSession,
    project_id: UUID,
) -> tuple[float, float, float, float]:
    corners = await collect_bbox_corners(db, project_id)
    if not corners:
        raise HTTPException(status_code=400, detail="line_elevation_profile_no_objects")
    center_lat = sum(c[1] for c in corners) / len(corners)
    padding = float(settings.PAD_DEM_BBOX_PADDING_M)
    return compute_dem_bbox(corners, padding_m=padding, lat_deg=center_lat)
