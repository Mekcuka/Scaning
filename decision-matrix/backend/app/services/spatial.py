"""Spatial queries: PostGIS geodesic with SQLite haversine + line/network fallbacks."""

import math
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.geo.constants import subtypes_for_nearest_search
from app.geo.geometry_utils import point_wkt
from app.services.cost_rates import EXTERNAL_LINEAR_SUBTYPES
from app.models import (
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    PointOfInterest,
)


@dataclass
class NearestResult:
    object_id: UUID | None
    name: str
    distance_km: float
    anchor_type: str
    anchor_lon: float
    anchor_lat: float
    nearest_node_id: UUID | None = None


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def line_coords_from_object(obj: InfrastructureObject) -> list[tuple[float, float]]:
    from app.services.serializers import _infra_line_coordinates

    parsed = _infra_line_coordinates(obj)
    if parsed:
        return [(c[0], c[1]) for c in parsed]
    return [(obj.longitude, obj.latitude)]


def closest_point_on_segment(
    plon: float, plat: float, alon: float, alat: float, blon: float, blat: float
) -> tuple[float, float]:
    cos_lat = math.cos(math.radians((alat + blat + plat) / 3))
    ax, ay = alon * cos_lat, alat
    bx, by = blon * cos_lat, blat
    px, py = plon * cos_lat, plat
    abx, aby = bx - ax, by - ay
    ab2 = abx * abx + aby * aby
    if ab2 < 1e-15:
        t = 0.0
    else:
        t = max(0.0, min(1.0, ((px - ax) * abx + (py - ay) * aby) / ab2))
    clon = (ax + t * abx) / cos_lat
    clat = ay + t * aby
    return clon, clat


def distance_to_object(poi: PointOfInterest, obj: InfrastructureObject) -> NearestResult:
    coords = line_coords_from_object(obj)
    if len(coords) >= 2:
        best_d = float("inf")
        best_lon, best_lat = coords[0]
        for i in range(len(coords) - 1):
            clon, clat = closest_point_on_segment(
                poi.longitude,
                poi.latitude,
                coords[i][0],
                coords[i][1],
                coords[i + 1][0],
                coords[i + 1][1],
            )
            d = haversine_km(poi.longitude, poi.latitude, clon, clat)
            if d < best_d:
                best_d, best_lon, best_lat = d, clon, clat
        return NearestResult(
            object_id=obj.id,
            name=obj.name,
            distance_km=best_d,
            anchor_type="line_nearest_point",
            anchor_lon=best_lon,
            anchor_lat=best_lat,
        )
    d = haversine_km(poi.longitude, poi.latitude, obj.longitude, obj.latitude)
    return NearestResult(
        object_id=obj.id,
        name=obj.name,
        distance_km=d,
        anchor_type="point_object",
        anchor_lon=obj.longitude,
        anchor_lat=obj.latitude,
    )


async def find_nearest_object_by_subtype(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
    *,
    nearest_policy: str = "point_on_line",
) -> NearestResult | None:
    if nearest_policy == "network_node":
        net = await find_nearest_network_node(db, project_id, poi, subtype)
        if net:
            return net
    # External subtypes: nearest point on any visible geometry (Point or LineString).
    # MVP previously skipped lines (point_only=True), so objects drawn/imported as lines were invisible to analysis.
    point_only = False
    subtypes = subtypes_for_nearest_search(subtype)
    if settings.is_sqlite:
        return await _find_nearest_sqlite(db, project_id, poi, subtypes, point_only=point_only)
    return await _find_nearest_postgis(db, project_id, poi, subtypes, point_only=point_only)


async def _find_nearest_sqlite(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtypes: frozenset[str],
    *,
    point_only: bool = False,
) -> NearestResult | None:
    q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureLayer.is_visible.is_(True),
            InfrastructureObject.subtype.in_(subtypes),
        )
    )
    objects = (await db.execute(q)).scalars().all()
    best: NearestResult | None = None
    for obj in objects:
        if point_only and obj.end_longitude is not None:
            continue
        cand = distance_to_object(poi, obj)
        if best is None or cand.distance_km < best.distance_km:
            best = cand
    return best


async def _find_nearest_postgis(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtypes: frozenset[str],
    *,
    point_only: bool = False,
) -> NearestResult | None:
    geom_filter = (
        "AND ST_GeometryType(io.geometry) IN ('ST_Point', 'ST_MultiPoint')"
        if point_only
        else ""
    )
    subtype_list = sorted(subtypes)
    in_clause = ", ".join(f":st_{i}" for i in range(len(subtype_list)))
    bind = {f"st_{i}": st for i, st in enumerate(subtype_list)}
    sql = text(
        f"""
        SELECT io.id, io.name,
               ST_Distance(
                 poi.geometry::geography,
                 ST_ClosestPoint(io.geometry::geometry, poi.geometry::geometry)::geography
               ) / 1000.0 AS distance_km,
               ST_X(ST_ClosestPoint(io.geometry::geometry, poi.geometry::geometry)) AS anchor_lon,
               ST_Y(ST_ClosestPoint(io.geometry::geometry, poi.geometry::geometry)) AS anchor_lat,
               ST_GeometryType(io.geometry) AS gtype
        FROM infrastructure_objects io
        JOIN infrastructure_layers il ON il.id = io.layer_id
        JOIN points_of_interest poi ON poi.id = :poi_id
        WHERE il.project_id = :project_id AND il.is_visible = true AND io.subtype IN ({in_clause})
        {geom_filter}
        ORDER BY distance_km ASC
        LIMIT 1
        """
    )
    row = (
        await db.execute(
            sql,
            {"project_id": str(project_id), "poi_id": str(poi.id), **bind},
        )
    ).first()
    if not row:
        return None
    gtype = str(row.gtype or "")
    anchor_type = "line_nearest_point" if "Line" in gtype else "point_object"
    return NearestResult(
        object_id=UUID(str(row.id)),
        name=row.name,
        distance_km=float(row.distance_km),
        anchor_type=anchor_type,
        anchor_lon=float(row.anchor_lon),
        anchor_lat=float(row.anchor_lat),
    )


async def list_candidates_by_subtype(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
    limit: int = 20,
    *,
    nearest_policy: str = "point_on_line",
) -> list[NearestResult]:
    if nearest_policy == "network_node":
        nodes = await list_network_node_candidates(db, project_id, poi, subtype, limit)
        if nodes:
            return nodes

    point_only = False
    if settings.is_sqlite:
        q = (
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureLayer.is_visible.is_(True),
                InfrastructureObject.subtype == subtype,
            )
        )
        objects = (await db.execute(q)).scalars().all()
        ranked = [
            distance_to_object(poi, obj)
            for obj in objects
            if not (point_only and obj.end_longitude is not None)
        ]
        ranked.sort(key=lambda r: r.distance_km)
        return ranked[:limit]

    geom_filter = (
        "AND ST_GeometryType(io.geometry) IN ('ST_Point', 'ST_MultiPoint')"
        if point_only
        else ""
    )
    sql = text(
        f"""
        SELECT io.id, io.name,
               ST_Distance(
                 poi.geometry::geography,
                 ST_ClosestPoint(io.geometry::geometry, poi.geometry::geometry)::geography
               ) / 1000.0 AS distance_km,
               ST_X(ST_ClosestPoint(io.geometry::geometry, poi.geometry::geometry)) AS anchor_lon,
               ST_Y(ST_ClosestPoint(io.geometry::geometry, poi.geometry::geometry)) AS anchor_lat,
               ST_GeometryType(io.geometry) AS gtype
        FROM infrastructure_objects io
        JOIN infrastructure_layers il ON il.id = io.layer_id
        JOIN points_of_interest poi ON poi.id = :poi_id
        WHERE il.project_id = :project_id AND il.is_visible = true AND io.subtype = :subtype
        {geom_filter}
        ORDER BY distance_km ASC
        LIMIT :lim
        """
    )
    rows = (
        await db.execute(
            sql,
            {
                "project_id": str(project_id),
                "poi_id": str(poi.id),
                "subtype": subtype,
                "lim": limit,
            },
        )
    ).all()
    return [
        NearestResult(
            object_id=UUID(str(r.id)),
            name=r.name,
            distance_km=float(r.distance_km),
            anchor_type="line_nearest_point" if "Line" in str(r.gtype or "") else "point_object",
            anchor_lon=float(r.anchor_lon),
            anchor_lat=float(r.anchor_lat),
        )
        for r in rows
    ]


async def find_nearest_on_line(
    db: AsyncSession,
    poi: PointOfInterest,
    object_id: UUID,
) -> NearestResult | None:
    obj = await db.get(InfrastructureObject, object_id)
    if not obj:
        return None
    return distance_to_object(poi, obj)


async def find_nearest_network_node(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
) -> NearestResult | None:
    """Nearest graph node linked to an infra object of given subtype."""
    q = (
        select(InfrastructureNode, InfrastructureObject)
        .join(InfrastructureNetwork, InfrastructureNode.network_id == InfrastructureNetwork.id)
        .outerjoin(InfrastructureObject, InfrastructureNode.infrastructure_object_id == InfrastructureObject.id)
        .where(InfrastructureNetwork.project_id == project_id)
    )
    rows = (await db.execute(q)).all()
    best: NearestResult | None = None
    for node, obj in rows:
        if obj is None or obj.subtype != subtype:
            continue
        d = haversine_km(poi.longitude, poi.latitude, node.longitude, node.latitude)
        name = obj.name
        if best is None or d < best.distance_km:
            best = NearestResult(
                object_id=obj.id if obj else None,
                name=name,
                distance_km=d,
                anchor_type="network_node",
                anchor_lon=node.longitude,
                anchor_lat=node.latitude,
                nearest_node_id=node.id,
            )
    return best


async def list_network_node_candidates(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
    limit: int,
) -> list[NearestResult]:
    q = (
        select(InfrastructureNode, InfrastructureObject)
        .join(InfrastructureNetwork, InfrastructureNode.network_id == InfrastructureNetwork.id)
        .outerjoin(InfrastructureObject, InfrastructureNode.infrastructure_object_id == InfrastructureObject.id)
        .where(InfrastructureNetwork.project_id == project_id)
    )
    ranked: list[NearestResult] = []
    for node, obj in (await db.execute(q)).all():
        if obj is None or obj.subtype != subtype:
            continue
        d = haversine_km(poi.longitude, poi.latitude, node.longitude, node.latitude)
        ranked.append(
            NearestResult(
                object_id=obj.id,
                name=obj.name,
                distance_km=d,
                anchor_type="network_node",
                anchor_lon=node.longitude,
                anchor_lat=node.latitude,
                nearest_node_id=node.id,
            )
        )
    ranked.sort(key=lambda r: r.distance_km)
    return ranked[:limit]


def anchor_point_wkt(lon: float, lat: float):
    return point_wkt(lon, lat)


COORD_MATCH_EPS = 1e-6


def coords_match(lon_a: float, lat_a: float, lon_b: float, lat_b: float) -> bool:
    return abs(lon_a - lon_b) <= COORD_MATCH_EPS and abs(lat_a - lat_b) <= COORD_MATCH_EPS


def _is_line_infra_object(obj: InfrastructureObject) -> bool:
    coords = line_coords_from_object(obj)
    return len(coords) >= 2 or obj.end_longitude is not None


def _candidates_from_line_object(poi: PointOfInterest, obj: InfrastructureObject) -> list[NearestResult]:
    out: list[NearestResult] = [distance_to_object(poi, obj)]
    coords = line_coords_from_object(obj)
    if len(coords) < 2:
        return out
    for lon, lat in coords:
        d = haversine_km(poi.longitude, poi.latitude, lon, lat)
        out.append(
            NearestResult(
                object_id=obj.id,
                name=obj.name,
                distance_km=d,
                anchor_type="line_vertex",
                anchor_lon=lon,
                anchor_lat=lat,
            )
        )
    return out


async def _visible_infra_objects(
    db: AsyncSession, project_id: UUID, subtype: str | None = None
) -> list[InfrastructureObject]:
    q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureLayer.is_visible.is_(True),
        )
    )
    if subtype is not None:
        q = q.where(InfrastructureObject.subtype == subtype)
    return list((await db.execute(q)).scalars().all())


def _connection_node_candidates(
    poi: PointOfInterest,
    line_subtype: str,
    lines: list[InfrastructureObject],
    nodes: list[InfrastructureObject],
) -> list[NearestResult]:
    out: list[NearestResult] = []
    for line in lines:
        if line.subtype != line_subtype or not _is_line_infra_object(line):
            continue
        endpoints = [line_coords_from_object(line)[0], line_coords_from_object(line)[-1]]
        for node in nodes:
            for ep_lon, ep_lat in endpoints:
                if coords_match(node.longitude, node.latitude, ep_lon, ep_lat):
                    d = haversine_km(poi.longitude, poi.latitude, node.longitude, node.latitude)
                    out.append(
                        NearestResult(
                            object_id=line.id,
                            name=line.name,
                            distance_km=d,
                            anchor_type="connection_node",
                            anchor_lon=node.longitude,
                            anchor_lat=node.latitude,
                        )
                    )
    return out


def _pick_nearest(candidates: list[NearestResult]) -> NearestResult | None:
    best: NearestResult | None = None
    for c in candidates:
        if best is None or c.distance_km < best.distance_km:
            best = c
    return best


async def find_nearest_external_linear(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
) -> NearestResult | None:
    """Nearest vertex / point-on-line / connection node for drawable lines of subtype."""
    if subtype not in EXTERNAL_LINEAR_SUBTYPES:
        return None
    lines = [
        o
        for o in await _visible_infra_objects(db, project_id, subtype)
        if _is_line_infra_object(o)
    ]
    nodes = [o for o in await _visible_infra_objects(db, project_id, "node")]
    candidates: list[NearestResult] = []
    for line in lines:
        candidates.extend(_candidates_from_line_object(poi, line))
    candidates.extend(_connection_node_candidates(poi, subtype, lines, nodes))
    return _pick_nearest(candidates)


async def list_external_linear_candidates(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
    limit: int = 20,
) -> list[NearestResult]:
    if subtype not in EXTERNAL_LINEAR_SUBTYPES:
        return []
    lines = [
        o
        for o in await _visible_infra_objects(db, project_id, subtype)
        if _is_line_infra_object(o)
    ]
    nodes = [o for o in await _visible_infra_objects(db, project_id, "node")]
    candidates: list[NearestResult] = []
    for line in lines:
        candidates.extend(_candidates_from_line_object(poi, line))
    candidates.extend(_connection_node_candidates(poi, subtype, lines, nodes))
    candidates.sort(key=lambda r: r.distance_km)
    return candidates[:limit]
