"""Internal linear analysis rows (autoroad, pipelines, power_line)."""

from __future__ import annotations

from app.models import PoiInfrastructureAnalysis
from app.services.analysis.builders.types import AnalysisBuildContext, BuildBatchResult
from app.services.calculations import (
    calc_internal_line_distance_km,
    calc_linear_cost_thousand_rub,
    format_internal_formula_label,
    internal_analysis_status,
    thousand_to_million_rub,
)
from app.services.cost_rates import ANALYSIS_LINEAR_SUBTYPES


class InternalLinearBuilder:
    param_type = "internal"

    async def build_all(self, ctx: AnalysisBuildContext) -> BuildBatchResult:
        rows: list[PoiInfrastructureAnalysis] = []
        items: list[dict] = []

        for subtype in ANALYSIS_LINEAR_SUBTYPES:
            limit = ctx.max_line_map[subtype]
            active = ctx.subtype_status.get(subtype, "active") != "not_required"
            st = internal_analysis_status(active=active)

            if not active:
                rows.append(
                    PoiInfrastructureAnalysis(
                        poi_id=ctx.poi.id,
                        param_type="internal",
                        subtype=subtype,
                        distance_km=0,
                        distance_source="pads_per_pad_formula",
                        distance_status=st,
                        max_allowed_distance_km=limit,
                    )
                )
                items.append(
                    {
                        "subtype": subtype,
                        "param_type": "internal",
                        "status": st,
                        "distance_km": 0,
                        "limit_km": None,
                        "cost_mln": 0,
                    }
                )
                continue

            km_pp = ctx.km_per_pad_map[subtype]
            dist, dist_src = calc_internal_line_distance_km(ctx.pads, km_pp)
            cost = calc_linear_cost_thousand_rub(dist, ctx.rates.get(subtype, 0))
            rows.append(
                PoiInfrastructureAnalysis(
                    poi_id=ctx.poi.id,
                    param_type="internal",
                    subtype=subtype,
                    distance_km=dist,
                    distance_source=dist_src,
                    distance_status=st,
                    max_allowed_distance_km=limit,
                )
            )
            items.append(
                {
                    "subtype": subtype,
                    "param_type": "internal",
                    "status": st,
                    "distance_km": round(dist, 1),
                    "limit_km": None,
                    "cost_mln": thousand_to_million_rub(cost),
                    "km_per_pad": km_pp,
                    "pads_count": ctx.pads,
                    "formula_label": format_internal_formula_label(km_pp, ctx.pads, dist),
                }
            )

        return BuildBatchResult(rows=rows, items=items, statuses_for_overall=[])
