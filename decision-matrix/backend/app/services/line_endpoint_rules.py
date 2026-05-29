"""Validation that line endpoints snap to a nearby point infrastructure object."""

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


def _nearest_for_point(
    point: tuple[float, float], candidates: list[InfrastructureObject]
) -> _NearestPointObject | None:
    lon, lat = point
    best: _NearestPointObject | None = None
    for obj in candidates:
        d = haversine_km(lon, lat, obj.longitude, obj.latitude)
        if best is None or d < best.distance_km:
            best = _NearestPointObject(subtype=obj.subtype, name=obj.name, distance_km=d)
    return best


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
    """Ensure both line ends are within snap tolerance of any point infrastructure object."""
    subtype = line_subtype.lower().strip()
    if subtype not in LINE_SUBTYPES:
        return

    start, finish = _line_endpoints(
        lon=lon, lat=lat, end_lon=end_lon, end_lat=end_lat, coordinates=coordinates
    )

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
    candidates = list((await db.execute(q)).scalars().all())
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
