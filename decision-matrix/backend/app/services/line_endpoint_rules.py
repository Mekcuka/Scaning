"""Validation and exact snap of line endpoints to point infrastructure objects."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES, SUBTYPE_LABELS
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.spatial import haversine_km

# Endpoint must be close to an infrastructure point object to be considered connected.
ENDPOINT_SNAP_TOLERANCE_KM = 0.3


class LineEndpointRuleError(ValueError):
    """Raised when line endpoints are not snapped to a nearby point object."""


@dataclass
class _NearestPointObject:
    subtype: str
    name: str
    distance_km: float


def _line_endpoints(
    *,
    lon: float,
    lat: float,
    end_lon: float | None,
    end_lat: float | None,
    coordinates: list[list[float]] | None,
) -> tuple[tuple[float, float], tuple[float, float]]:
    if coordinates and len(coordinates) >= 2:
        start = (float(coordinates[0][0]), float(coordinates[0][1]))
        finish = (float(coordinates[-1][0]), float(coordinates[-1][1]))
        return start, finish
    if end_lon is not None and end_lat is not None:
        return (float(lon), float(lat)), (float(end_lon), float(end_lat))
    raise LineEndpointRuleError("Линейный объект должен иметь start/end или минимум 2 координаты.")


def _label(subtype: str) -> str:
    return SUBTYPE_LABELS.get(subtype, subtype)


def _nearest_object_for_point(
    point: tuple[float, float], candidates: list[InfrastructureObject]
) -> tuple[InfrastructureObject, float] | None:
    lon, lat = point
    best: InfrastructureObject | None = None
    best_dist = float("inf")
    for obj in candidates:
        d = haversine_km(lon, lat, obj.longitude, obj.latitude)
        if d < best_dist:
            best_dist = d
            best = obj
    if best is None:
        return None
    return best, best_dist


def _nearest_for_point(
    point: tuple[float, float], candidates: list[InfrastructureObject]
) -> _NearestPointObject | None:
    found = _nearest_object_for_point(point, candidates)
    if not found:
        return None
    obj, dist = found
    return _NearestPointObject(subtype=obj.subtype, name=obj.name, distance_km=dist)


async def _point_candidates(
    db: AsyncSession,
    *,
    project_id: UUID,
    exclude_object_id: UUID | None = None,
) -> list[InfrastructureObject]:
    q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.notin_(LINE_SUBTYPES),
        )
    )
    if exclude_object_id:
        q = q.where(InfrastructureObject.id != exclude_object_id)
    return list((await db.execute(q)).scalars().all())


def snap_line_endpoint_coords(
    *,
    lon: float,
    lat: float,
    end_lon: float | None,
    end_lat: float | None,
    coordinates: list[list[float]] | None,
    candidates: list[InfrastructureObject],
) -> tuple[float, float, float | None, float | None, list[list[float]] | None]:
    """Rewrite start/finish to exact longitude/latitude of nearest point objects within tolerance."""
    start_pt, finish_pt = _line_endpoints(
        lon=lon, lat=lat, end_lon=end_lon, end_lat=end_lat, coordinates=coordinates
    )
    start_match = _nearest_object_for_point(start_pt, candidates)
    finish_match = _nearest_object_for_point(finish_pt, candidates)
    if not start_match or not finish_match:
        raise LineEndpointRuleError("Не удалось определить ближайшие объекты для концов линии.")

    start_obj, start_dist = start_match
    finish_obj, finish_dist = finish_match
    if start_dist > ENDPOINT_SNAP_TOLERANCE_KM or finish_dist > ENDPOINT_SNAP_TOLERANCE_KM:
        raise LineEndpointRuleError("Концы линии вне допуска привязки.")

    out_lon = float(start_obj.longitude)
    out_lat = float(start_obj.latitude)
    out_end_lon = float(finish_obj.longitude)
    out_end_lat = float(finish_obj.latitude)

    out_coords: list[list[float]] | None = None
    if coordinates and len(coordinates) >= 2:
        out_coords = [[float(c[0]), float(c[1])] for c in coordinates]
        out_coords[0] = [out_lon, out_lat]
        out_coords[-1] = [out_end_lon, out_end_lat]

    return out_lon, out_lat, out_end_lon, out_end_lat, out_coords


async def snap_line_endpoints_to_point_objects(
    db: AsyncSession,
    *,
    project_id: UUID,
    line_subtype: str,
    lon: float,
    lat: float,
    end_lon: float | None,
    end_lat: float | None,
    coordinates: list[list[float]] | None,
    exclude_object_id: UUID | None = None,
) -> tuple[float, float, float | None, float | None, list[list[float]] | None]:
    """Validate tolerance then return coordinates equal to attached point objects."""
    await validate_line_endpoint_matrix(
        db,
        project_id=project_id,
        line_subtype=line_subtype,
        lon=lon,
        lat=lat,
        end_lon=end_lon,
        end_lat=end_lat,
        coordinates=coordinates,
        exclude_object_id=exclude_object_id,
    )
    candidates = await _point_candidates(db, project_id=project_id, exclude_object_id=exclude_object_id)
    return snap_line_endpoint_coords(
        lon=lon,
        lat=lat,
        end_lon=end_lon,
        end_lat=end_lat,
        coordinates=coordinates,
        candidates=candidates,
    )


async def validate_line_endpoint_matrix(
    db: AsyncSession,
    *,
    project_id: UUID,
    line_subtype: str,
    lon: float,
    lat: float,
    end_lon: float | None,
    end_lat: float | None,
    coordinates: list[list[float]] | None,
    exclude_object_id: UUID | None = None,
) -> None:
    """Ensure both line ends are within snap tolerance of any point infrastructure object (no subtype filter)."""
    subtype = line_subtype.lower().strip()
    if subtype not in LINE_SUBTYPES:
        return

    start, finish = _line_endpoints(
        lon=lon, lat=lat, end_lon=end_lon, end_lat=end_lat, coordinates=coordinates
    )

    candidates = await _point_candidates(db, project_id=project_id, exclude_object_id=exclude_object_id)
    if not candidates:
        raise LineEndpointRuleError(
            f"Для {_label(subtype)} нужны точечные опорные объекты. Добавьте минимум один объект."
        )

    start_obj = _nearest_for_point(start, candidates)
    finish_obj = _nearest_for_point(finish, candidates)
    if not start_obj or not finish_obj:
        raise LineEndpointRuleError("Не удалось определить ближайшие объекты для концов линии.")

    if start_obj.distance_km > ENDPOINT_SNAP_TOLERANCE_KM:
        raise LineEndpointRuleError(
            "Начальная точка линии не привязана к объекту. "
            f"Ближайший объект: {start_obj.name} ({_label(start_obj.subtype)}), "
            f"{round(start_obj.distance_km, 2)} км. Допуск: {ENDPOINT_SNAP_TOLERANCE_KM} км."
        )
    if finish_obj.distance_km > ENDPOINT_SNAP_TOLERANCE_KM:
        raise LineEndpointRuleError(
            "Конечная точка линии не привязана к объекту. "
            f"Ближайший объект: {finish_obj.name} ({_label(finish_obj.subtype)}), "
            f"{round(finish_obj.distance_km, 2)} км. Допуск: {ENDPOINT_SNAP_TOLERANCE_KM} км."
        )
