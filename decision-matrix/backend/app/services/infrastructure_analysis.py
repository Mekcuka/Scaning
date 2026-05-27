"""POI environment analysis: compute, persist, read (FR-6, FR-2.4)."""

from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    InfrastructureNetwork,
    InfrastructureObject,
    PoiInfrastructureAnalysis,
    PointOfInterest,
    ProjectCostRates,
    ProjectDistanceDefaults,
)
from app.services.calculations import (
    EngineeringState,
    apply_engineering_rules,
    calc_distance_status_external,
    calc_distance_status_internal,
    calc_engineering_equipment_cost,
    calc_internal_line_distance_km,
    calc_linear_cost_thousand_rub,
    calc_overall_status,
    calc_pads_cost_thousand_rub,
    calc_pads_count,
    calc_wells_total,
    thousand_to_million_rub,
)
from app.services.cost_rates import DEFAULT_COST_RATES, EXTERNAL_POINT_SUBTYPES, LINEAR_SUBTYPES
from app.services.spatial import anchor_point_wkt, find_nearest_object_by_subtype


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
    eng = EngineeringState(
        fluid_type=poi.fluid_type,
        eng_power=poi.eng_power,
        eng_injection=poi.eng_injection,
        eng_gas=poi.eng_gas,
        eng_oil_preparation=poi.eng_oil_preparation,
        eng_transport=poi.eng_transport,
        water_injection_volume=poi.water_injection_volume,
    )
    subtype_status = apply_engineering_rules(eng)
    analysis_items: list[dict] = []
    statuses_for_overall: list[str] = []
    total_cost_thousand = calc_pads_cost_thousand_rub(pads, rates.get("pads", 0))
    total_cost_thousand += calc_engineering_equipment_cost(eng, rates)

    km_per_pad_map = {
        "autoroad": poi.km_per_pad_autoroad or (defaults.km_per_pad_autoroad if defaults else 3.0),
        "oil_pipeline": poi.km_per_pad_oil_pipeline or (defaults.km_per_pad_oil_pipeline if defaults else 3.0),
        "gas_pipeline": poi.km_per_pad_gas_pipeline or (defaults.km_per_pad_gas_pipeline if defaults else 3.0),
        "water_pipeline": poi.km_per_pad_water_pipeline or (defaults.km_per_pad_water_pipeline if defaults else 3.0),
        "power_line": poi.km_per_pad_power_line or (defaults.km_per_pad_power_line if defaults else 3.0),
    }
    max_line_map = {
        "autoroad": poi.max_total_line_autoroad_km or (defaults.max_total_line_autoroad_km if defaults else 50),
        "oil_pipeline": poi.max_total_line_oil_pipeline_km or (defaults.max_total_line_oil_pipeline_km if defaults else 40),
        "gas_pipeline": poi.max_total_line_gas_pipeline_km or (defaults.max_total_line_gas_pipeline_km if defaults else 40),
        "water_pipeline": poi.max_total_line_water_pipeline_km or (defaults.max_total_line_water_pipeline_km if defaults else 30),
        "power_line": poi.max_total_line_power_line_km or (defaults.max_total_line_power_line_km if defaults else 30),
    }
    threshold_map = {
        "gas_processing": poi.threshold_gas_processing_km or (defaults.threshold_gas_processing_km if defaults else 80),
        "gtes": poi.threshold_gtes_km or (defaults.threshold_gtes_km if defaults else 60),
        "substation": poi.threshold_substation_km or (defaults.threshold_substation_km if defaults else 25),
        "refinery": poi.threshold_refinery_km or (defaults.threshold_refinery_km if defaults else 100),
    }

    await db.execute(delete(PoiInfrastructureAnalysis).where(PoiInfrastructureAnalysis.poi_id == poi.id))
    rows_to_save: list[PoiInfrastructureAnalysis] = []

    for subtype in LINEAR_SUBTYPES:
        active = subtype_status.get(subtype, "active") != "not_required"
        if not active:
            row = PoiInfrastructureAnalysis(
                poi_id=poi.id,
                param_type="internal",
                subtype=subtype,
                distance_km=0,
                distance_source="pads_per_pad_formula",
                distance_status="not_required",
                max_allowed_distance_km=max_line_map[subtype],
            )
            rows_to_save.append(row)
            analysis_items.append({"subtype": subtype, "status": "not_required", "distance_km": 0, "cost_mln": 0})
            continue

        dist, dist_src = calc_internal_line_distance_km(pads, km_per_pad_map[subtype])
        cost = calc_linear_cost_thousand_rub(dist, rates.get(subtype, 0))
        total_cost_thousand += cost
        limit = max_line_map[subtype]
        st = calc_distance_status_internal(dist, limit, active=True)
        statuses_for_overall.append(st)
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
                "status": st,
                "distance_km": round(dist, 1),
                "limit_km": limit,
                "cost_mln": thousand_to_million_rub(cost),
                "param_type": "internal",
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
            analysis_items.append({"subtype": subtype, "status": "not_required", "distance_km": 0, "cost_mln": 0})
            continue

        has_network = await db.scalar(
            select(InfrastructureNetwork.id).where(InfrastructureNetwork.project_id == project_id).limit(1)
        )
        policy = "network_node" if has_network else "point_on_line"
        nearest = await find_nearest_object_by_subtype(
            db, project_id, poi, subtype, nearest_policy=policy
        )
        if nearest:
            dist = nearest.distance_km
            cost = rates.get(subtype, 0)
            total_cost_thousand += cost
            st = calc_distance_status_external(dist, limit, object_found=True)
            statuses_for_overall.append(st)
            rows_to_save.append(
                PoiInfrastructureAnalysis(
                    poi_id=poi.id,
                    param_type="external",
                    subtype=subtype,
                    nearest_object_id=nearest.object_id,
                    nearest_node_id=nearest.nearest_node_id,
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
                    "status": st,
                    "distance_km": round(dist, 1),
                    "limit_km": limit,
                    "object_name": nearest.name,
                    "object_id": str(nearest.object_id) if nearest.object_id else None,
                    "anchor_lon": nearest.anchor_lon,
                    "anchor_lat": nearest.anchor_lat,
                    "anchor_type": nearest.anchor_type,
                    "cost_mln": thousand_to_million_rub(cost),
                    "param_type": "external",
                }
            )
        else:
            cost = rates.get(subtype, 0)
            total_cost_thousand += cost
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
                    "status": st,
                    "distance_km": None,
                    "limit_km": limit,
                    "cost_mln": thousand_to_million_rub(cost),
                    "param_type": "external",
                }
            )

    analysis_items.append(
        {
            "subtype": "pads",
            "status": "computed",
            "pads_count": pads,
            "wells_total": calc_wells_total(poi.planned_production_volume, poi.production_per_well),
            "cost_mln": thousand_to_million_rub(calc_pads_cost_thousand_rub(pads, rates.get("pads", 0))),
        }
    )

    for row in rows_to_save:
        db.add(row)
    await db.flush()

    overall = calc_overall_status(statuses_for_overall)
    return {
        "poi_id": str(poi.id),
        "total_cost_mln": thousand_to_million_rub(total_cost_thousand),
        "overall_status": overall,
        "analysis": analysis_items,
        "engineering_status": subtype_status,
    }


async def get_poi_analysis_rows(db: AsyncSession, poi_id: UUID) -> list[PoiInfrastructureAnalysis]:
    result = await db.execute(
        select(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.poi_id == poi_id)
        .order_by(PoiInfrastructureAnalysis.subtype)
    )
    return list(result.scalars().all())


def analysis_row_to_dict(row: PoiInfrastructureAnalysis, infra_name: str | None = None) -> dict:
    anchor_lon = anchor_lat = None
    if row.anchor_geometry is not None and hasattr(row, "anchor_geometry"):
        pass
    item = {
        "subtype": row.subtype,
        "param_type": row.param_type,
        "status": row.distance_status,
        "distance_km": row.distance_km,
        "limit_km": row.max_allowed_distance_km,
        "distance_source": row.distance_source,
        "nearest_object_id": str(row.nearest_object_id) if row.nearest_object_id else None,
        "object_name": infra_name,
        "anchor_type": row.anchor_type,
    }
    return item
