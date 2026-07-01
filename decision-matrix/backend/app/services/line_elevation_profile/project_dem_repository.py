"""PostgreSQL-backed project DEM cache (one GeoTIFF per project)."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ProjectLineDem
from app.services.line_elevation_profile.dem_paths import delete_project_dem_file, project_dem_file_path
from app.services.pad_earthwork.dem_store import (
    bbox_hash,
    cached_synthetic_dem_should_upgrade,
    dem_source_label,
    fetch_opentopography_dem_async,
    validate_geotiff,
)

logger = logging.getLogger(__name__)


async def get_project_line_dem_row(db: AsyncSession, project_id: UUID) -> ProjectLineDem | None:
    return await db.scalar(select(ProjectLineDem).where(ProjectLineDem.project_id == project_id))


async def ensure_project_line_dem(
    db: AsyncSession,
    *,
    project_id: UUID,
    bbox: tuple[float, float, float, float],
) -> tuple[Path, bool, bool]:
    """Return DEM path, dem_fetched, dem_reused."""
    bhash = bbox_hash(bbox)
    west, south, east, north = bbox
    row = await get_project_line_dem_row(db, project_id)
    path = project_dem_file_path(project_id)

    if (
        row is not None
        and row.bbox_hash == bhash
        and path.is_file()
        and not cached_synthetic_dem_should_upgrade(row.source)
    ):
        return path, False, True

    raw = await fetch_opentopography_dem_async(bbox)
    validate_geotiff(raw)
    now = datetime.now(UTC)
    source = dem_source_label()

    if row is not None and row.bbox_hash != bhash:
        delete_project_dem_file(project_id)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(raw)

    if row is None:
        row = ProjectLineDem(
            id=uuid.uuid4(),
            project_id=project_id,
            bbox_hash=bhash,
            bbox_west=west,
            bbox_south=south,
            bbox_east=east,
            bbox_north=north,
            source=source,
            file_size_bytes=len(raw),
            fetched_at=now,
        )
        db.add(row)
    else:
        row.bbox_hash = bhash
        row.bbox_west = west
        row.bbox_south = south
        row.bbox_east = east
        row.bbox_north = north
        row.source = source
        row.file_size_bytes = len(raw)
        row.fetched_at = now

    await db.flush()
    return path, True, False


async def delete_project_line_dem_files(db: AsyncSession, project_id: UUID) -> None:
    """Remove on-disk GeoTIFF before project delete."""
    row = await get_project_line_dem_row(db, project_id)
    if row is None:
        delete_project_dem_file(project_id)
        return
    try:
        delete_project_dem_file(project_id)
    except OSError:
        logger.warning("Failed to delete line profile DEM for project %s", project_id, exc_info=True)
