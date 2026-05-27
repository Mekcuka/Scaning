"""Manual override of analysis rows (FR-6.3)."""

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    PoiInfrastructureAnalysis,
    PointOfInterest,
)
from app.services.calculations import calc_distance_status_external, calc_distance_status_internal
from app.services.spatial import anchor_point_wkt, distance_to_object, haversine_km


def parse_point_wkt(wkt: str | None) -> tuple[float, float] | None:
    if not wkt:
        return None
    m = re.match(r"POINT\s*\(\s*([-\d.eE+]+)\s+([-\d.eE+]+)\s*\)", wkt.strip(), re.I)
    if not m:
        return None
    return float(m.group(1)), float(m.group(2))


async def set_force_construction(
    db: AsyncSession,
    poi: PointOfInterest,
    subtype: str,
    *,
    force: bool,
) -> PoiInfrastructureAnalysis:
    subtype = subtype.lower()
    row = await db.scalar(
        select(PoiInfrastructureAnalysis).where(
            PoiInfrastructureAnalysis.poi_id == poi.id,
            PoiInfrastructureAnalysis.subtype == subtype,
        )
    )
    if not row:
        raise ValueError("No analysis row for subtype. Run analyze first.")
    if row.distance_status == "not_required":
        raise ValueError("Subtype is not required")

    row.force_construction = force
    limit = row.max_allowed_distance_km or 0
    if row.param_type == "internal":
        row.distance_status = calc_distance_status_internal(
            row.distance_km or 0.0,
            limit,
            active=True,
            force_construction=force,
        )
    else:
        row.distance_status = calc_distance_status_external(
            row.distance_km,
            limit,
            object_found=row.distance_km is not None,
            force_construction=force,
        )
    await db.flush()
    return row


async def override_external_analysis(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
    *,
    nearest_object_id: UUID | None = None,
    nearest_node_id: UUID | None = None,
) -> PoiInfrastructureAnalysis:
    subtype = subtype.lower()
    if nearest_node_id and not nearest_object_id:
        node = await db.get(InfrastructureNode, nearest_node_id)
        if not node:
            raise ValueError("Node not found")
        net = await db.get(InfrastructureNetwork, node.network_id)
        if not net or net.project_id != project_id:
            raise ValueError("Node not in project")
        dist = haversine_km(poi.longitude, poi.latitude, node.longitude, node.latitude)
        anchor_lon, anchor_lat = node.longitude, node.latitude
        anchor_type = "network_node"
        obj_id = node.infrastructure_object_id
        row = await _apply_override(
            db, poi, subtype, dist, anchor_lon, anchor_lat, anchor_type, obj_id, nearest_node_id
        )
        return row

    if not nearest_object_id:
        raise ValueError("nearest_object_id or nearest_node_id required")
    obj = await db.get(InfrastructureObject, nearest_object_id)
    if not obj:
        raise ValueError("Object not found")
    layer = await db.get(InfrastructureLayer, obj.layer_id)
    if not layer or layer.project_id != project_id:
        raise ValueError("Object not in project")
    if obj.subtype != subtype:
        raise ValueError("Object subtype mismatch")

    nearest = distance_to_object(poi, obj)
    dist = nearest.distance_km
    anchor_lon, anchor_lat = nearest.anchor_lon, nearest.anchor_lat
    anchor_type = nearest.anchor_type

    return await _apply_override(
        db, poi, subtype, dist, anchor_lon, anchor_lat, anchor_type, obj.id, None
    )


async def patch_analysis_subtype(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    subtype: str,
    *,
    nearest_object_id: UUID | None = None,
    nearest_node_id: UUID | None = None,
    force_construction: bool | None = None,
) -> PoiInfrastructureAnalysis:
    if force_construction is not None:
        return await set_force_construction(db, poi, subtype, force=force_construction)
    return await override_external_analysis(
        db,
        project_id,
        poi,
        subtype,
        nearest_object_id=nearest_object_id,
        nearest_node_id=nearest_node_id,
    )


async def _apply_override(
    db: AsyncSession,
    poi: PointOfInterest,
    subtype: str,
    dist: float,
    anchor_lon: float,
    anchor_lat: float,
    anchor_type: str,
    object_id: UUID | None,
    node_id: UUID | None,
) -> PoiInfrastructureAnalysis:
    row = await db.scalar(
        select(PoiInfrastructureAnalysis).where(
            PoiInfrastructureAnalysis.poi_id == poi.id,
            PoiInfrastructureAnalysis.subtype == subtype,
            PoiInfrastructureAnalysis.param_type == "external",
        )
    )
    if not row:
        raise ValueError("No analysis row for subtype. Run analyze first.")
    limit = row.max_allowed_distance_km or 0
    st = calc_distance_status_external(
        dist, limit, object_found=True, force_construction=row.force_construction
    )
    row.nearest_object_id = object_id
    row.nearest_node_id = node_id
    row.distance_km = dist
    row.distance_status = st
    row.is_manually_overridden = True
    row.overridden_object_id = object_id
    row.anchor_type = anchor_type
    row.anchor_geometry = anchor_point_wkt(anchor_lon, anchor_lat)
    row.distance_source = "geodesic"
    await db.flush()
    return row
