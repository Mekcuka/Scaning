"""Read and enrich persisted POI analysis rows."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    InfrastructureLayer,
    InfrastructureObject,
    PoiInfrastructureAnalysis,
    PointOfInterest,
    ProjectCostRates,
    ProjectDistanceDefaults,
)
from app.services.analysis.compute import (
    build_analysis_summary,
    engineering_state_from_poi,
    get_distance_maps,
    subtype_cost_thousand,
)
from app.services.analysis_override import parse_point_wkt
from app.services.calculations import (
    calc_distance_status_external,
    calc_pads_count,
    format_internal_formula_label,
    thousand_to_million_rub,
)
from app.services.cost_rates import merge_project_cost_rates


async def row_to_analysis_item(
    db: AsyncSession,
    row: PoiInfrastructureAnalysis,
    poi: PointOfInterest,
    *,
    rates: dict[str, float],
    km_per_pad_map: dict[str, float],
    pads_count: int,
    project_id: UUID | None = None,
) -> dict[str, Any]:
    name = None
    anchor_lon = anchor_lat = None
    linked_object: InfrastructureObject | None = None
    if row.nearest_object_id:
        linked_object = await db.get(InfrastructureObject, row.nearest_object_id)
        if linked_object:
            name = linked_object.name

    orphan_network_ref = False
    if row.param_type in ("external", "external_linear"):
        if row.distance_status == "not_required":
            linked_object = None
            name = None
        else:
            pt = parse_point_wkt(row.anchor_geometry if isinstance(row.anchor_geometry, str) else None)
            if pt:
                anchor_lon, anchor_lat = pt
            elif linked_object:
                anchor_lon, anchor_lat = linked_object.longitude, linked_object.latitude
            if not linked_object:
                if row.anchor_type == "network_node" or row.nearest_node_id:
                    orphan_network_ref = True
            elif project_id and linked_object:
                layer = await db.get(InfrastructureLayer, linked_object.layer_id)
                if not layer or layer.project_id != project_id or not layer.is_visible:
                    linked_object = None

    if row.param_type == "internal":
        st = "computed"
    else:
        st = row.distance_status
    force_construction = getattr(row, "force_construction", False)
    if force_construction and st != "not_required" and row.param_type != "internal":
        st = calc_distance_status_external(
            row.distance_km,
            row.max_allowed_distance_km,
            object_found=row.distance_km is not None,
            force_construction=True,
        )

    if orphan_network_ref and st != "not_required":
        st = calc_distance_status_external(
            None,
            row.max_allowed_distance_km,
            object_found=False,
        )

    dist_km = None if orphan_network_ref else row.distance_km
    cost_th = subtype_cost_thousand(
        row,
        subtype=row.subtype,
        param_type=row.param_type,
        status=st,
        distance_km=dist_km,
        rates=rates,
        pads_count=pads_count,
    )

    item: dict[str, Any] = {
        "subtype": row.subtype,
        "param_type": row.param_type,
        "status": st,
        "distance_km": round(dist_km, 1) if dist_km is not None else None,
        "limit_km": (
            None
            if row.param_type == "internal"
            else round(row.max_allowed_distance_km, 1)
        ),
        "distance_source": row.distance_source,
        "nearest_object_id": (
            str(row.nearest_object_id)
            if row.nearest_object_id and not orphan_network_ref and name
            else None
        ),
        "object_name": name if not orphan_network_ref else None,
        "anchor_lon": anchor_lon,
        "anchor_lat": anchor_lat,
        "anchor_type": None if orphan_network_ref else row.anchor_type,
        "is_manually_overridden": row.is_manually_overridden,
        "force_construction": getattr(row, "force_construction", False),
        "nearest_node_id": None if orphan_network_ref else (str(row.nearest_node_id) if row.nearest_node_id else None),
        "cost_mln": thousand_to_million_rub(cost_th),
    }
    if row.param_type == "internal" and row.subtype in km_per_pad_map:
        km_pp = km_per_pad_map[row.subtype]
        item["km_per_pad"] = km_pp
        item["pads_count"] = pads_count
        item["formula_label"] = format_internal_formula_label(km_pp, pads_count, row.distance_km)
    return item


async def build_enriched_analysis_from_db(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
) -> dict[str, Any]:
    defaults = await db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id)
    )
    rates_row = await db.scalar(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates = merge_project_cost_rates(rates_row.rates if rates_row else None)
    km_per_pad_map, _, _ = get_distance_maps(poi, defaults)
    pads = calc_pads_count(poi.planned_production_volume, poi.production_per_well, poi.wells_per_pad)
    eng = engineering_state_from_poi(poi)

    db_rows = (
        await db.execute(
            select(PoiInfrastructureAnalysis)
            .where(PoiInfrastructureAnalysis.poi_id == poi.id)
            .order_by(PoiInfrastructureAnalysis.subtype)
        )
    ).scalars().all()

    items: list[dict[str, Any]] = []
    for row in db_rows:
        items.append(
            await row_to_analysis_item(
                db,
                row,
                poi,
                rates=rates,
                km_per_pad_map=km_per_pad_map,
                pads_count=pads,
                project_id=project_id,
            )
        )
    return build_analysis_summary(poi, items, rates=rates, eng=eng)


async def get_poi_analysis_rows(db: AsyncSession, poi_id: UUID) -> list[PoiInfrastructureAnalysis]:
    result = await db.execute(
        select(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.poi_id == poi_id)
        .order_by(PoiInfrastructureAnalysis.subtype)
    )
    return list(result.scalars().all())
