"""POI environment analysis: compute, persist, read (FR-6, FR-2.4)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureObject,
    PoiInfrastructureAnalysis,
    PointOfInterest,
    ProjectCostRates,
    ProjectDistanceDefaults,
    Scenario,
)
from app.services.analysis_override import parse_point_wkt
from app.services.calculations import (
    EngineeringState,
    apply_engineering_rules,
    calc_distance_status_external,
    calc_engineering_equipment_cost,
    calc_internal_line_distance_km,
    calc_linear_cost_thousand_rub,
    calc_overall_status,
    calc_pads_cost_thousand_rub,
    calc_pads_count,
    calc_wells_total,
    format_internal_formula_label,
    thousand_to_million_rub,
)
from app.services.cost_rates import (
    ANALYSIS_LINEAR_SUBTYPES,
    DEFAULT_COST_RATES,
    EXTERNAL_LINEAR_SUBTYPES,
    EXTERNAL_POINT_SUBTYPES,
)
from app.services.spatial import (
    anchor_point_wkt,
    find_nearest_external_linear,
    find_nearest_object_by_subtype,
)


def engineering_state_from_poi(poi: PointOfInterest) -> EngineeringState:
    return EngineeringState(
        fluid_type=poi.fluid_type,
        eng_power=poi.eng_power,
        eng_injection=poi.eng_injection,
        eng_gas=poi.eng_gas,
        eng_oil_preparation=poi.eng_oil_preparation,
        eng_transport=poi.eng_transport,
        water_injection_volume=poi.water_injection_volume,
    )


def get_distance_maps(
    poi: PointOfInterest, defaults: ProjectDistanceDefaults | None
) -> tuple[dict[str, float], dict[str, float], dict[str, float]]:
    km_per_pad_map = {
        "autoroad": poi.km_per_pad_autoroad or (defaults.km_per_pad_autoroad if defaults else 3.0),
        "oil_pipeline": poi.km_per_pad_oil_pipeline or (defaults.km_per_pad_oil_pipeline if defaults else 3.0),
        "gas_pipeline": poi.km_per_pad_gas_pipeline or (defaults.km_per_pad_gas_pipeline if defaults else 3.0),
        "water_pipeline": poi.km_per_pad_water_pipeline or (defaults.km_per_pad_water_pipeline if defaults else 3.0),
        "power_line": poi.km_per_pad_power_line or (defaults.km_per_pad_power_line if defaults else 3.0),
    }
    max_line_map = {
        "autoroad": poi.max_total_line_autoroad_km or (defaults.max_total_line_autoroad_km if defaults else 50),
        "oil_pipeline": poi.max_total_line_oil_pipeline_km
        or (defaults.max_total_line_oil_pipeline_km if defaults else 40),
        "gas_pipeline": poi.max_total_line_gas_pipeline_km
        or (defaults.max_total_line_gas_pipeline_km if defaults else 40),
        "water_pipeline": poi.max_total_line_water_pipeline_km
        or (defaults.max_total_line_water_pipeline_km if defaults else 30),
        "power_line": poi.max_total_line_power_line_km or (defaults.max_total_line_power_line_km if defaults else 30),
    }
    threshold_map = {
        "gas_processing": poi.threshold_gas_processing_km
        or (defaults.threshold_gas_processing_km if defaults else 80),
        "gtes": poi.threshold_gtes_km or (defaults.threshold_gtes_km if defaults else 60),
        "substation": poi.threshold_substation_km or (defaults.threshold_substation_km if defaults else 25),
        "refinery": poi.threshold_refinery_km or (defaults.threshold_refinery_km if defaults else 100),
    }
    return km_per_pad_map, max_line_map, threshold_map


def _subtype_cost_thousand(
    row: PoiInfrastructureAnalysis | None,
    *,
    subtype: str,
    param_type: str,
    status: str,
    distance_km: float | None,
    rates: dict[str, float],
    pads_count: int,
) -> float:
    if status == "not_required":
        return 0.0
    if subtype == "pads":
        return calc_pads_cost_thousand_rub(pads_count, rates.get("pads", 0))
    if param_type in ("internal", "external_linear"):
        dist = distance_km or 0.0
        return calc_linear_cost_thousand_rub(dist, rates.get(subtype, 0))
    return rates.get(subtype, 0) if status != "not_required" else 0.0


def build_pads_analysis_item(poi: PointOfInterest, pads: int, rates: dict[str, float]) -> dict[str, Any]:
    cost = calc_pads_cost_thousand_rub(pads, rates.get("pads", 0))
    return {
        "subtype": "pads",
        "param_type": "internal",
        "status": "computed",
        "pads_count": pads,
        "wells_total": calc_wells_total(poi.planned_production_volume, poi.production_per_well),
        "distance_km": None,
        "limit_km": None,
        "cost_mln": thousand_to_million_rub(cost),
    }


def build_analysis_summary(
    poi: PointOfInterest,
    items: list[dict[str, Any]],
    *,
    rates: dict[str, float],
    eng: EngineeringState | None = None,
    overall_status_override: str | None = None,
) -> dict[str, Any]:
    eng = eng or engineering_state_from_poi(poi)
    pads = calc_pads_count(poi.planned_production_volume, poi.production_per_well, poi.wells_per_pad)
    equipment_thousand = calc_engineering_equipment_cost(eng, rates)
    subtype_status = apply_engineering_rules(eng)
    statuses_for_overall: list[str] = []
    total_thousand = equipment_thousand
    rows: list[dict[str, Any]] = []

    for raw in items:
        if raw.get("subtype") == "pads":
            continue
        item = dict(raw)
        st = str(item.get("status", ""))
        if st not in ("not_required", "computed"):
            statuses_for_overall.append(st)
        cost_mln = item.get("cost_mln")
        if cost_mln is None:
            param_type = str(item.get("param_type", ""))
            dist = item.get("distance_km")
            subtype = str(item.get("subtype", ""))
            cost_th = _subtype_cost_thousand(
                None,
                subtype=subtype,
                param_type=param_type,
                status=st,
                distance_km=float(dist) if dist is not None else None,
                rates=rates,
                pads_count=pads,
            )
            cost_mln = thousand_to_million_rub(cost_th)
            item["cost_mln"] = cost_mln
        if st != "not_required":
            total_thousand += float(cost_mln or 0) * 1000
        rows.append(item)

    rows.append(build_pads_analysis_item(poi, pads, rates))
    total_thousand += calc_pads_cost_thousand_rub(pads, rates.get("pads", 0))

    overall = overall_status_override or calc_overall_status(statuses_for_overall)
    return {
        "poi_id": str(poi.id),
        "total_cost_mln": thousand_to_million_rub(total_thousand),
        "overall_status": overall,
        "rows": rows,
        "analysis": rows,
        "engineering_status": subtype_status,
    }


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
                    # Object exists but layer hidden — keep name/distance for display, drop map link id.
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
    cost_th = _subtype_cost_thousand(
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
    rates = {**DEFAULT_COST_RATES, **(rates_row.rates if rates_row else {})}
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


async def _external_item_from_manual_row(
    db: AsyncSession,
    poi: PointOfInterest,
    old: PoiInfrastructureAnalysis,
    *,
    limit: float,
    rates: dict[str, float],
) -> tuple[PoiInfrastructureAnalysis, dict[str, Any]]:
    """Re-apply a manually overridden row on re-analyze (FR-6.3)."""
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
    cost = rates.get(old.subtype, 0)
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


async def _external_linear_item_from_manual_row(
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


async def run_poi_analysis(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
) -> dict:
    defaults = await db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id)
    )
    rates_row = await db.scalar(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates = {**DEFAULT_COST_RATES, **(rates_row.rates if rates_row else {})}

    pads = calc_pads_count(poi.planned_production_volume, poi.production_per_well, poi.wells_per_pad)
    eng = engineering_state_from_poi(poi)
    subtype_status = apply_engineering_rules(eng)
    analysis_items: list[dict] = []
    statuses_for_overall: list[str] = []

    km_per_pad_map, max_line_map, threshold_map = get_distance_maps(poi, defaults)

    manual_rows = (
        await db.execute(
            select(PoiInfrastructureAnalysis).where(
                PoiInfrastructureAnalysis.poi_id == poi.id,
                PoiInfrastructureAnalysis.is_manually_overridden.is_(True),
                PoiInfrastructureAnalysis.param_type.in_(("external", "external_linear")),
            )
        )
    ).scalars().all()
    manual_external = {r.subtype: r for r in manual_rows if r.param_type == "external"}
    manual_external_linear = {r.subtype: r for r in manual_rows if r.param_type == "external_linear"}

    await db.execute(delete(PoiInfrastructureAnalysis).where(PoiInfrastructureAnalysis.poi_id == poi.id))
    rows_to_save: list[PoiInfrastructureAnalysis] = []

    for subtype in ANALYSIS_LINEAR_SUBTYPES:
        limit = max_line_map[subtype]
        km_pp = km_per_pad_map[subtype]
        dist, dist_src = calc_internal_line_distance_km(pads, km_pp)
        cost = calc_linear_cost_thousand_rub(dist, rates.get(subtype, 0))
        st = "computed"
        rows_to_save.append(
            PoiInfrastructureAnalysis(
                poi_id=poi.id,
                param_type="internal",
                subtype=subtype,
                distance_km=dist,
                distance_source=dist_src,
                distance_status=st,
                max_allowed_distance_km=limit,
            )
        )
        analysis_items.append(
            {
                "subtype": subtype,
                "param_type": "internal",
                "status": st,
                "distance_km": round(dist, 1),
                "limit_km": None,
                "cost_mln": thousand_to_million_rub(cost),
                "km_per_pad": km_pp,
                "pads_count": pads,
                "formula_label": format_internal_formula_label(km_pp, pads, dist),
            }
        )

    for subtype in EXTERNAL_LINEAR_SUBTYPES:
        limit = max_line_map[subtype]
        if subtype in manual_external_linear:
            row, item = await _external_linear_item_from_manual_row(
                db, poi, manual_external_linear[subtype], limit=limit, rates=rates
            )
            rows_to_save.append(row)
            analysis_items.append(item)
            if item["status"] not in ("not_required", "computed"):
                statuses_for_overall.append(str(item["status"]))
            continue

        nearest = await find_nearest_external_linear(db, project_id, poi, subtype)
        if nearest:
            dist = round(nearest.distance_km, 2)
            cost = calc_linear_cost_thousand_rub(dist, rates.get(subtype, 0))
            st = calc_distance_status_external(dist, limit, object_found=True)
            statuses_for_overall.append(st)
            rows_to_save.append(
                PoiInfrastructureAnalysis(
                    poi_id=poi.id,
                    param_type="external_linear",
                    subtype=subtype,
                    nearest_object_id=nearest.object_id,
                    nearest_node_id=None,
                    distance_km=dist,
                    distance_source="geodesic",
                    distance_method="geodesic",
                    anchor_type=nearest.anchor_type,
                    anchor_geometry=anchor_point_wkt(nearest.anchor_lon, nearest.anchor_lat),
                    distance_status=st,
                    max_allowed_distance_km=limit,
                )
            )
            analysis_items.append(
                {
                    "subtype": subtype,
                    "param_type": "external_linear",
                    "status": st,
                    "distance_km": round(dist, 1),
                    "limit_km": limit,
                    "object_name": nearest.name,
                    "nearest_object_id": str(nearest.object_id) if nearest.object_id else None,
                    "anchor_lon": nearest.anchor_lon,
                    "anchor_lat": nearest.anchor_lat,
                    "anchor_type": nearest.anchor_type,
                    "cost_mln": thousand_to_million_rub(cost),
                }
            )
        else:
            cost = calc_linear_cost_thousand_rub(0, rates.get(subtype, 0))
            st = "construction_required"
            statuses_for_overall.append(st)
            rows_to_save.append(
                PoiInfrastructureAnalysis(
                    poi_id=poi.id,
                    param_type="external_linear",
                    subtype=subtype,
                    distance_km=None,
                    distance_source="geodesic",
                    distance_status=st,
                    max_allowed_distance_km=limit,
                )
            )
            analysis_items.append(
                {
                    "subtype": subtype,
                    "param_type": "external_linear",
                    "status": st,
                    "distance_km": None,
                    "limit_km": limit,
                    "cost_mln": thousand_to_million_rub(cost),
                }
            )

    for subtype in EXTERNAL_POINT_SUBTYPES:
        active = subtype_status.get(subtype, "active") != "not_required"
        limit = threshold_map[subtype]
        if not active:
            row = PoiInfrastructureAnalysis(
                poi_id=poi.id,
                param_type="external",
                subtype=subtype,
                distance_km=0,
                distance_source="geodesic",
                distance_status="not_required",
                max_allowed_distance_km=limit,
            )
            rows_to_save.append(row)
            analysis_items.append(
                {
                    "subtype": subtype,
                    "param_type": "external",
                    "status": "not_required",
                    "distance_km": 0,
                    "limit_km": limit,
                    "cost_mln": 0,
                }
            )
            continue

        if subtype in manual_external:
            row, item = await _external_item_from_manual_row(
                db, poi, manual_external[subtype], limit=limit, rates=rates
            )
            rows_to_save.append(row)
            analysis_items.append(item)
            if item["status"] not in ("not_required", "computed"):
                statuses_for_overall.append(str(item["status"]))
            continue

        # FR-6.1.2 MVP: external = nearest Point on map (not graph nodes from «Построить сеть»)
        nearest = await find_nearest_object_by_subtype(
            db, project_id, poi, subtype, nearest_policy="point_on_line"
        )
        if nearest:
            dist = round(nearest.distance_km, 2)
            cost = rates.get(subtype, 0)
            st = calc_distance_status_external(dist, limit, object_found=True)
            statuses_for_overall.append(st)
            rows_to_save.append(
                PoiInfrastructureAnalysis(
                    poi_id=poi.id,
                    param_type="external",
                    subtype=subtype,
                    nearest_object_id=nearest.object_id,
                    nearest_node_id=None,
                    distance_km=dist,
                    distance_source="geodesic",
                    distance_method="geodesic",
                    anchor_type=nearest.anchor_type,
                    anchor_geometry=anchor_point_wkt(nearest.anchor_lon, nearest.anchor_lat),
                    distance_status=st,
                    max_allowed_distance_km=limit,
                )
            )
            analysis_items.append(
                {
                    "subtype": subtype,
                    "param_type": "external",
                    "status": st,
                    "distance_km": round(dist, 1),
                    "limit_km": limit,
                    "object_name": nearest.name,
                    "nearest_object_id": str(nearest.object_id) if nearest.object_id else None,
                    "anchor_lon": nearest.anchor_lon,
                    "anchor_lat": nearest.anchor_lat,
                    "anchor_type": nearest.anchor_type,
                    "cost_mln": thousand_to_million_rub(cost),
                }
            )
        else:
            cost = rates.get(subtype, 0)
            st = "construction_required"
            statuses_for_overall.append(st)
            rows_to_save.append(
                PoiInfrastructureAnalysis(
                    poi_id=poi.id,
                    param_type="external",
                    subtype=subtype,
                    distance_km=None,
                    distance_source="geodesic",
                    distance_status=st,
                    max_allowed_distance_km=limit,
                )
            )
            analysis_items.append(
                {
                    "subtype": subtype,
                    "param_type": "external",
                    "status": st,
                    "distance_km": None,
                    "limit_km": limit,
                    "cost_mln": thousand_to_million_rub(cost),
                }
            )

    for row in rows_to_save:
        db.add(row)
    await db.flush()

    return build_analysis_summary(
        poi,
        analysis_items,
        rates=rates,
        eng=eng,
        overall_status_override=calc_overall_status(statuses_for_overall),
    )


async def get_poi_analysis_rows(db: AsyncSession, poi_id: UUID) -> list[PoiInfrastructureAnalysis]:
    result = await db.execute(
        select(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.poi_id == poi_id)
        .order_by(PoiInfrastructureAnalysis.subtype)
    )
    return list(result.scalars().all())


async def link_poi_scenarios(
    db: AsyncSession,
    project_id: UUID,
    poi_id: UUID,
    result: dict[str, Any],
) -> None:
    linked = (
        await db.execute(
            select(Scenario).where(Scenario.project_id == project_id, Scenario.poi_id == poi_id)
        )
    ).scalars().all()
    for sc in linked:
        sc.results = result


async def run_project_pois_analysis(db: AsyncSession, project_id: UUID) -> dict[str, Any]:
    """Run environment analysis for every POI in the project."""
    pois = (
        await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == project_id))
    ).scalars().all()
    results: list[dict[str, Any]] = []
    for poi in pois:
        result = await run_poi_analysis(db, project_id, poi)
        await link_poi_scenarios(db, project_id, poi.id, result)
        results.append(result)
    return {
        "project_id": str(project_id),
        "analyzed_count": len(results),
        "results": results,
    }
