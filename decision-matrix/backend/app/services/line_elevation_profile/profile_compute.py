"""Compute line elevation profiles for a project."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES
from app.geo.render_3d_properties import RENDER_3D_BASE_FROM_DEM_KEY, RENDER_3D_BASE_KEY
from app.models import InfrastructureLayer, InfrastructureObject, ProjectLineDem
from app.services.line_elevation_profile.bbox import compute_project_dem_bbox
from app.services.line_elevation_profile.polyline_sample import sample_polyline_chainage
from app.services.line_elevation_profile.project_dem_repository import ensure_project_line_dem
from app.services.line_elevation_profile.properties import (
    LINE_ELEVATION_PROFILE_COMPUTED_AT,
    LINE_ELEVATION_PROFILE_JSON,
    LINE_ELEVATION_PROFILE_STEP_M,
    PROFILE_LINE_EXCLUDE_SUBTYPE,
    read_step_m,
)
from app.services.line_elevation_profile.schemas import LineElevationProfileComputeOut
from app.services.pad_earthwork.dem_elevation_sample import sample_elevation_at_lonlat
from app.services.pad_earthwork.gdal_proj import configure_rasterio_proj
from app.services.spatial import haversine_km, line_coords_from_object
from app.subtype_manifest import BOTTOMHOLE_CLUSTER_SUBTYPES

logger = logging.getLogger(__name__)


def _profile_line_subtypes() -> frozenset[str]:
    return frozenset(st for st in LINE_SUBTYPES if st != PROFILE_LINE_EXCLUDE_SUBTYPE)


async def _load_profile_lines(db: AsyncSession, project_id: UUID) -> list[InfrastructureObject]:
    subtypes = _profile_line_subtypes()
    return list(
        (
            await db.execute(
                select(InfrastructureObject)
                .join(InfrastructureLayer)
                .where(
                    InfrastructureLayer.project_id == project_id,
                    InfrastructureLayer.is_visible.is_(True),
                    InfrastructureObject.subtype.in_(subtypes),
                )
            )
        ).scalars().all()
    )


async def _load_point_objects_for_dem_base(
    db: AsyncSession,
    project_id: UUID,
) -> list[InfrastructureObject]:
    return list(
        (
            await db.execute(
                select(InfrastructureObject)
                .join(InfrastructureLayer)
                .where(
                    InfrastructureLayer.project_id == project_id,
                    InfrastructureLayer.is_visible.is_(True),
                    InfrastructureObject.subtype.notin_(LINE_SUBTYPES),
                    InfrastructureObject.subtype.notin_(BOTTOMHOLE_CLUSTER_SUBTYPES),
                )
            )
        ).scalars().all()
    )


def _update_point_objects_dem_base_m(
    points: list[InfrastructureObject],
    dem_path: Path,
) -> tuple[int, list[str]]:
    """Sample project DEM at each point object; overwrite render_3d_base_m (absolute AMSL)."""
    configure_rasterio_proj()
    try:
        import rasterio
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="rasterio_not_available") from exc

    updated = 0
    errors: list[str] = []
    with rasterio.open(dem_path) as dataset:
        nodata = dataset.nodata
        for obj in points:
            try:
                elev = sample_elevation_at_lonlat(
                    dataset,
                    float(obj.longitude),
                    float(obj.latitude),
                    nodata,
                )
                if elev is None:
                    errors.append(f"{obj.name or obj.id}: не удалось снять отметку ЦМР")
                    continue
                props = dict(obj.properties or {})
                props[RENDER_3D_BASE_KEY] = round(elev, 2)
                props[RENDER_3D_BASE_FROM_DEM_KEY] = True
                obj.properties = props
                updated += 1
            except Exception as exc:
                logger.warning("Point DEM base failed for %s", obj.id, exc_info=True)
                errors.append(f"{obj.name or obj.id}: {exc}")
    return updated, errors


def _polyline_total_length_m(coords: list[tuple[float, float]]) -> float:
    total = 0.0
    for i in range(len(coords) - 1):
        total += haversine_km(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]) * 1000.0
    return round(total, 3)


def _sample_elevations(
    dem_path: Path,
    samples: list[tuple[float, float, float]],
) -> list[dict[str, Any]]:
    configure_rasterio_proj()
    try:
        import rasterio
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="rasterio_not_available") from exc

    points: list[dict[str, Any]] = []
    with rasterio.open(dem_path) as dataset:
        nodata = dataset.nodata
        for chainage_m, lon, lat in samples:
            elev = sample_elevation_at_lonlat(dataset, lon, lat, nodata)
            if elev is None:
                raise HTTPException(status_code=502, detail="dem_elevation_sample_failed")
            points.append(
                {
                    "chainage_m": round(chainage_m, 3),
                    "lon": round(lon, 6),
                    "lat": round(lat, 6),
                    "elevation_m": round(elev, 2),
                }
            )
    return points


def _build_profile_json(
    *,
    step_m: float,
    computed_at: datetime,
    dem_source: str,
    total_length_m: float,
    points: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "step_m": step_m,
        "computed_at": computed_at.isoformat(),
        "dem_source": dem_source,
        "total_length_m": total_length_m,
        "points": points,
    }


async def compute_line_elevation_profiles(
    db: AsyncSession,
    project_id: UUID,
) -> LineElevationProfileComputeOut:
    lines = await _load_profile_lines(db, project_id)
    if not lines:
        raise HTTPException(status_code=400, detail="line_elevation_profile_no_lines")

    bbox = await compute_project_dem_bbox(db, project_id)
    dem_path, dem_fetched, dem_reused = await ensure_project_line_dem(db, project_id=project_id, bbox=bbox)
    dem_row = await db.scalar(select(ProjectLineDem).where(ProjectLineDem.project_id == project_id))
    dem_source = dem_row.source if dem_row else "opentopography:COP30"

    computed_count = 0
    errors: list[str] = []
    now = datetime.now(UTC)

    point_objects = await _load_point_objects_for_dem_base(db, project_id)
    points_updated_count, point_errors = _update_point_objects_dem_base_m(point_objects, dem_path)
    errors.extend(point_errors)

    for obj in lines:
        coords = line_coords_from_object(obj)
        if len(coords) < 2:
            errors.append(f"{obj.id}: недостаточно вершин линии")
            continue
        step_m = read_step_m(obj.properties)
        try:
            samples = sample_polyline_chainage(coords, step_m)
            points = _sample_elevations(dem_path, samples)
            total_length_m = _polyline_total_length_m(coords)
            profile = _build_profile_json(
                step_m=step_m,
                computed_at=now,
                dem_source=dem_source,
                total_length_m=total_length_m,
                points=points,
            )
            props = dict(obj.properties or {})
            props[LINE_ELEVATION_PROFILE_STEP_M] = step_m
            props[LINE_ELEVATION_PROFILE_JSON] = profile
            props[LINE_ELEVATION_PROFILE_COMPUTED_AT] = now.isoformat()
            obj.properties = props
            computed_count += 1
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Line profile failed for %s", obj.id, exc_info=True)
            errors.append(f"{obj.name or obj.id}: {exc}")

    await db.flush()
    return LineElevationProfileComputeOut(
        computed_count=computed_count,
        points_updated_count=points_updated_count,
        dem_fetched=dem_fetched,
        dem_reused=dem_reused,
        errors=errors,
    )


def profile_from_properties(properties: dict[str, Any] | None) -> dict[str, Any] | None:
    if not properties:
        return None
    raw = properties.get(LINE_ELEVATION_PROFILE_JSON)
    return raw if isinstance(raw, dict) else None
