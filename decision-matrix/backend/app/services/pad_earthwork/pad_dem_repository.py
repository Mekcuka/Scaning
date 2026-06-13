"""PostgreSQL-backed pad DEM cache with on-disk GeoTIFF storage."""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import InfraObjectPadDem, InfrastructureObject
from app.services.pad_earthwork.dem_store import (
    bbox_hash,
    compute_dem_bbox,
    dem_file_path,
    dem_source_label,
    fetch_opentopography_dem,
    store_dem_file,
    validate_geotiff,
)
from app.services.pad_earthwork.properties import (
    PAD_DEM_ASSET_ID,
    PAD_DEM_BBOX_HASH,
    PAD_DEM_FETCHED_AT,
    PAD_DEM_SOURCE,
)

logger = logging.getLogger(__name__)


def _property_updates(
    *,
    asset_id: str,
    bhash: str,
    fetched_at: datetime,
    source: str,
) -> dict[str, Any]:
    return {
        PAD_DEM_ASSET_ID: asset_id,
        PAD_DEM_BBOX_HASH: bhash,
        PAD_DEM_FETCHED_AT: fetched_at.isoformat(),
        PAD_DEM_SOURCE: source,
    }


def _delete_legacy_dem_file(project_id: UUID, asset_id: str, *, keep_asset_id: str) -> None:
    if asset_id == keep_asset_id:
        return
    try:
        dem_file_path(project_id, asset_id).unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete legacy pad DEM file %s", asset_id, exc_info=True)


def _cleanup_legacy_files(
    project_id: UUID,
    obj: InfrastructureObject,
    *,
    current_asset_id: str,
) -> None:
    props = dict(obj.properties or {})
    legacy_id = props.get(PAD_DEM_ASSET_ID)
    if isinstance(legacy_id, str) and legacy_id.strip():
        _delete_legacy_dem_file(project_id, legacy_id.strip(), keep_asset_id=current_asset_id)


def _try_parse_uuid(raw: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


def _row_from_legacy_properties(
    project_id: UUID,
    obj: InfrastructureObject,
    *,
    bhash: str,
    bbox: tuple[float, float, float, float],
) -> InfraObjectPadDem | None:
    props = dict(obj.properties or {})
    legacy_id = props.get(PAD_DEM_ASSET_ID)
    legacy_hash = props.get(PAD_DEM_BBOX_HASH)
    if not isinstance(legacy_id, str) or not legacy_id.strip():
        return None
    if legacy_hash != bhash:
        return None
    asset_uuid = _try_parse_uuid(legacy_id.strip())
    if asset_uuid is None:
        return None
    path = dem_file_path(project_id, legacy_id.strip())
    if not path.is_file():
        return None
    west, south, east, north = bbox
    fetched_at = datetime.now(UTC)
    raw_fetched = props.get(PAD_DEM_FETCHED_AT)
    if isinstance(raw_fetched, str):
        try:
            fetched_at = datetime.fromisoformat(raw_fetched.replace("Z", "+00:00"))
        except ValueError:
            pass
    source_raw = props.get(PAD_DEM_SOURCE)
    source = str(source_raw) if isinstance(source_raw, str) else dem_source_label()
    return InfraObjectPadDem(
        id=asset_uuid,
        infrastructure_object_id=obj.id,
        project_id=project_id,
        bbox_hash=bhash,
        bbox_west=west,
        bbox_south=south,
        bbox_east=east,
        bbox_north=north,
        source=source,
        file_size_bytes=path.stat().st_size,
        fetched_at=fetched_at,
    )


async def get_pad_dem_row(db: AsyncSession, object_id: UUID) -> InfraObjectPadDem | None:
    return await db.scalar(
        select(InfraObjectPadDem).where(InfraObjectPadDem.infrastructure_object_id == object_id)
    )


async def delete_pad_dem_files_for_object_ids(db: AsyncSession, object_ids: set[UUID]) -> None:
    """Remove on-disk GeoTIFF before bulk infra delete (ORM listeners are not fired)."""
    if not object_ids:
        return
    rows = (
        await db.execute(
            select(InfraObjectPadDem).where(InfraObjectPadDem.infrastructure_object_id.in_(object_ids))
        )
    ).scalars().all()
    for row in rows:
        try:
            dem_file_path(row.project_id, str(row.id)).unlink(missing_ok=True)
        except OSError:
            logger.warning("Failed to delete pad DEM file for asset %s", row.id, exc_info=True)


async def ensure_pad_dem(
    db: AsyncSession,
    *,
    project_id: UUID,
    obj: InfrastructureObject,
    footprint_corners_lonlat: list[tuple[float, float]],
) -> tuple[str, Path, dict[str, Any]]:
    """Return asset_id, file path, and property updates for DEM cache."""
    padding = float(settings.PAD_DEM_BBOX_PADDING_M)
    bbox = compute_dem_bbox(
        footprint_corners_lonlat,
        padding_m=padding,
        lat_deg=float(obj.latitude),
    )
    bhash = bbox_hash(bbox)
    west, south, east, north = bbox

    row = await get_pad_dem_row(db, obj.id)
    if row is None:
        row = _row_from_legacy_properties(project_id, obj, bhash=bhash, bbox=bbox)
        if row is not None:
            db.add(row)
            await db.flush()

    if row is not None and row.bbox_hash == bhash:
        path = dem_file_path(project_id, str(row.id))
        if path.is_file():
            return str(row.id), path, {}

    raw = fetch_opentopography_dem(bbox)
    validate_geotiff(raw)
    now = datetime.now(UTC)
    source = dem_source_label()

    if row is None:
        asset_uuid = uuid.uuid4()
        row = InfraObjectPadDem(
            id=asset_uuid,
            infrastructure_object_id=obj.id,
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
        path = store_dem_file(project_id, raw, str(asset_uuid))
    else:
        path = store_dem_file(project_id, raw, str(row.id))
        row.bbox_hash = bhash
        row.bbox_west = west
        row.bbox_south = south
        row.bbox_east = east
        row.bbox_north = north
        row.source = source
        row.file_size_bytes = len(raw)
        row.fetched_at = now

    await db.flush()
    _cleanup_legacy_files(project_id, obj, current_asset_id=str(row.id))
    return str(row.id), path, _property_updates(
        asset_id=str(row.id),
        bhash=bhash,
        fetched_at=now,
        source=source,
    )
