"""External point analysis rows (gas_processing, gtes, substation, etc.)."""

from __future__ import annotations

from app.models import PoiInfrastructureAnalysis
from app.services.analysis.builders.types import AnalysisBuildContext, BuildBatchResult
from app.services.analysis.external_items import external_item_from_manual_row
from app.services.calculations import (
    calc_distance_status_external,
    calc_external_point_cost_thousand,
    thousand_to_million_rub,
)
from app.services.cost_rates import EXTERNAL_POINT_SUBTYPES
from app.services.spatial import anchor_point_wkt


class ExternalPointBuilder:
    param_type = "external"

    async def build_all(self, ctx: AnalysisBuildContext) -> BuildBatchResult:
        rows: list[PoiInfrastructureAnalysis] = []
        items: list[dict] = []
        statuses: list[str] = []

        for subtype in EXTERNAL_POINT_SUBTYPES:
            active = ctx.subtype_status.get(subtype, "active") != "not_required"
            limit = ctx.threshold_map[subtype]
            if not active:
                rows.append(
                    PoiInfrastructureAnalysis(
                        poi_id=ctx.poi.id,
                        param_type="external",
                        subtype=subtype,
                        distance_km=0,
                        distance_source="geodesic",
                        distance_status="not_required",
                        max_allowed_distance_km=limit,
                    )
                )
                items.append(
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

            if subtype in ctx.manual_external:
                row, item = await external_item_from_manual_row(
                    ctx.db,
                    ctx.poi,
                    ctx.manual_external[subtype],
                    limit=limit,
                    rates=ctx.rates,
                )
                rows.append(row)
                items.append(item)
                if item["status"] not in ("not_required", "computed"):
                    statuses.append(str(item["status"]))
                continue

            nearest = await ctx.spatial.find_nearest_object_by_subtype(
                ctx.db, ctx.project_id, ctx.poi, subtype, nearest_policy="point_on_line"
            )
            if nearest:
                dist = round(nearest.distance_km, 2)
                st = calc_distance_status_external(dist, limit, object_found=True)
                cost = calc_external_point_cost_thousand(st, rate=ctx.rates.get(subtype, 0))
                statuses.append(st)
                rows.append(
                    PoiInfrastructureAnalysis(
                        poi_id=ctx.poi.id,
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
                items.append(
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
                st = "construction_required"
                cost = calc_external_point_cost_thousand(st, rate=ctx.rates.get(subtype, 0))
                statuses.append(st)
                rows.append(
                    PoiInfrastructureAnalysis(
                        poi_id=ctx.poi.id,
                        param_type="external",
                        subtype=subtype,
                        distance_km=None,
                        distance_source="geodesic",
                        distance_status=st,
                        max_allowed_distance_km=limit,
                    )
                )
                items.append(
                    {
                        "subtype": subtype,
                        "param_type": "external",
                        "status": st,
                        "distance_km": None,
                        "limit_km": limit,
                        "cost_mln": thousand_to_million_rub(cost),
                    }
                )

        return BuildBatchResult(rows=rows, items=items, statuses_for_overall=statuses)
