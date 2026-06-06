"""Manual override rows for external / external_linear analysis."""

from __future__ import annotations

from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureObject, PoiInfrastructureAnalysis, PointOfInterest
from app.services.analysis_override import parse_point_wkt
from app.services.calculations import (
    calc_distance_status_external,
    calc_external_point_cost_thousand,
    calc_linear_cost_thousand_rub,
    thousand_to_million_rub,
)


async def external_item_from_manual_row(
    db: AsyncSession,
    poi: PointOfInterest,
    old: PoiInfrastructureAnalysis,
    *,
    limit: float,
    rates: dict[str, float],
) -> tuple[PoiInfrastructureAnalysis, dict[str, Any]]:
    """Re-apply a manually overridden row on re-analyze (FR-6.3)."""
    force_construction = getattr(old, "force_construction", False)
    object_found = old.nearest_object_id is not None or old.distance_km is not None
    st = calc_distance_status_external(
        old.distance_km,
        limit,
        object_found=object_found,
        force_construction=force_construction,
    )
    name = None
    anchor_lon = anchor_lat = None
    if old.nearest_object_id:
        obj = await db.get(InfrastructureObject, old.nearest_object_id)
        if obj:
            name = obj.name
            anchor_lon, anchor_lat = obj.longitude, obj.latitude
    if anchor_lon is None:
        pt = parse_point_wkt(old.anchor_geometry if isinstance(old.anchor_geometry, str) else None)
        if pt:
            anchor_lon, anchor_lat = pt
    row = PoiInfrastructureAnalysis(
        poi_id=poi.id,
        param_type="external",
        subtype=old.subtype,
        nearest_object_id=old.nearest_object_id,
        nearest_node_id=old.nearest_node_id,
        distance_km=old.distance_km,
        distance_source=old.distance_source,
        distance_method=old.distance_method,
        anchor_type=old.anchor_type,
        anchor_geometry=old.anchor_geometry,
        distance_status=st,
        max_allowed_distance_km=limit,
        is_manually_overridden=True,
        force_construction=force_construction,
        overridden_object_id=old.overridden_object_id,
    )
    cost = calc_external_point_cost_thousand(st, rate=rates.get(old.subtype, 0))
    item: dict[str, Any] = {
        "subtype": old.subtype,
        "param_type": "external",
        "status": st,
        "distance_km": round(old.distance_km, 1) if old.distance_km is not None else None,
        "limit_km": limit,
        "object_name": name,
        "nearest_object_id": str(old.nearest_object_id) if old.nearest_object_id else None,
        "nearest_node_id": str(old.nearest_node_id) if old.nearest_node_id else None,
        "anchor_lon": anchor_lon,
        "anchor_lat": anchor_lat,
        "anchor_type": old.anchor_type,
        "cost_mln": thousand_to_million_rub(cost),
        "is_manually_overridden": True,
        "force_construction": force_construction,
    }
    return row, item


async def external_linear_item_from_manual_row(
    db: AsyncSession,
    poi: PointOfInterest,
    old: PoiInfrastructureAnalysis,
    *,
    limit: float,
    rates: dict[str, float],
) -> tuple[PoiInfrastructureAnalysis, dict[str, Any]]:
    """Re-apply a manually overridden external_linear row on re-analyze."""
    st = old.distance_status
    force_construction = getattr(old, "force_construction", False)
    if force_construction and st != "not_required":
        st = calc_distance_status_external(
            old.distance_km,
            limit,
            object_found=old.distance_km is not None,
            force_construction=True,
        )
    name = None
    anchor_lon = anchor_lat = None
    if old.nearest_object_id:
        obj = await db.get(InfrastructureObject, old.nearest_object_id)
        if obj:
            name = obj.name
    if anchor_lon is None:
        pt = parse_point_wkt(old.anchor_geometry if isinstance(old.anchor_geometry, str) else None)
        if pt:
            anchor_lon, anchor_lat = pt
    dist = old.distance_km or 0.0
    cost = calc_linear_cost_thousand_rub(dist, rates.get(old.subtype, 0))
    row = PoiInfrastructureAnalysis(
        poi_id=poi.id,
        param_type="external_linear",
        subtype=old.subtype,
        nearest_object_id=old.nearest_object_id,
        nearest_node_id=old.nearest_node_id,
        distance_km=old.distance_km,
        distance_source=old.distance_source,
        distance_method=old.distance_method,
        anchor_type=old.anchor_type,
        anchor_geometry=old.anchor_geometry,
        distance_status=st,
        max_allowed_distance_km=limit,
        is_manually_overridden=True,
        force_construction=force_construction,
        overridden_object_id=old.overridden_object_id,
    )
    item: dict[str, Any] = {
        "subtype": old.subtype,
        "param_type": "external_linear",
        "status": st,
        "distance_km": round(old.distance_km, 1) if old.distance_km is not None else None,
        "limit_km": limit,
        "object_name": name,
        "nearest_object_id": str(old.nearest_object_id) if old.nearest_object_id else None,
        "nearest_node_id": str(old.nearest_node_id) if old.nearest_node_id else None,
        "anchor_lon": anchor_lon,
        "anchor_lat": anchor_lat,
        "anchor_type": old.anchor_type,
        "cost_mln": thousand_to_million_rub(cost),
        "is_manually_overridden": True,
        "force_construction": force_construction,
    }
    return row, item
