"""Run POI environment analysis and persist results."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    PoiInfrastructureAnalysis,
    PointOfInterest,
    ProjectCostRates,
    ProjectDistanceDefaults,
)
from app.services.analysis.builders import ANALYSIS_PARAM_BUILDERS
from app.services.analysis.builders.types import AnalysisBuildContext
from app.services.analysis.compute import (
    build_analysis_summary,
    engineering_state_from_poi,
    get_distance_maps,
)
from app.services.analysis.persist import clear_poi_analysis_rows, persist_analysis_rows
from app.services.calculations import (
    apply_engineering_rules,
    calc_overall_status,
    calc_pads_count,
)
from app.services.cost_rates import resolve_cost_rates
from app.services.spatial_port import SpatialQueryPort, get_spatial_query


async def run_poi_analysis(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
    *,
    spatial: SpatialQueryPort | None = None,
) -> dict:
    spatial_query = spatial or get_spatial_query()

    defaults = await db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id)
    )
    rates_row = await db.scalar(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates = resolve_cost_rates(
        rates_row.rates if rates_row else None,
        poi.cost_rates,
    )

    pads = calc_pads_count(poi.planned_production_volume, poi.production_per_well, poi.wells_per_pad)
    eng = engineering_state_from_poi(poi)
    subtype_status = apply_engineering_rules(eng)

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

    await clear_poi_analysis_rows(db, poi.id)

    ctx = AnalysisBuildContext(
        db=db,
        project_id=project_id,
        poi=poi,
        spatial=spatial_query,
        rates=rates,
        pads=pads,
        subtype_status=subtype_status,
        km_per_pad_map=km_per_pad_map,
        max_line_map=max_line_map,
        threshold_map=threshold_map,
        manual_external=manual_external,
        manual_external_linear=manual_external_linear,
    )

    for builder in ANALYSIS_PARAM_BUILDERS:
        batch = await builder.build_all(ctx)
        ctx.rows_to_save.extend(batch.rows)
        ctx.analysis_items.extend(batch.items)
        ctx.statuses_for_overall.extend(batch.statuses_for_overall)

    await persist_analysis_rows(db, ctx.rows_to_save)

    return build_analysis_summary(
        poi,
        ctx.analysis_items,
        rates=rates,
        eng=eng,
        overall_status_override=calc_overall_status(ctx.statuses_for_overall),
    )


async def run_project_pois_analysis(db: AsyncSession, project_id: UUID) -> dict[str, Any]:
    """Run environment analysis for every POI in the project."""
    pois = (
        await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == project_id))
    ).scalars().all()
    results: list[dict[str, Any]] = []
    for poi in pois:
        result = await run_poi_analysis(db, project_id, poi)
        results.append(result)
    return {
        "project_id": str(project_id),
        "analyzed_count": len(results),
        "results": results,
    }
