"""POI environment analysis package (FR-6, FR-2.4)."""

from app.services.analysis.compute import (
    build_analysis_summary,
    build_pads_analysis_item,
    engineering_state_from_poi,
    get_distance_maps,
    subtype_cost_thousand,
)
from app.services.analysis.external_items import (
    external_item_from_manual_row,
    external_linear_item_from_manual_row,
)
from app.services.analysis.persist import clear_poi_analysis_rows, persist_analysis_rows
from app.services.analysis.read import (
    build_enriched_analysis_from_db,
    get_poi_analysis_rows,
    row_to_analysis_item,
)
from app.services.analysis.run import run_poi_analysis, run_project_pois_analysis

# Legacy private names used in tests
_subtype_cost_thousand = subtype_cost_thousand
_external_item_from_manual_row = external_item_from_manual_row
_external_linear_item_from_manual_row = external_linear_item_from_manual_row

__all__ = [
    "build_analysis_summary",
    "build_enriched_analysis_from_db",
    "build_pads_analysis_item",
    "clear_poi_analysis_rows",
    "engineering_state_from_poi",
    "external_item_from_manual_row",
    "external_linear_item_from_manual_row",
    "get_distance_maps",
    "get_poi_analysis_rows",
    "persist_analysis_rows",
    "row_to_analysis_item",
    "run_poi_analysis",
    "run_project_pois_analysis",
    "subtype_cost_thousand",
    "_external_item_from_manual_row",
    "_external_linear_item_from_manual_row",
    "_subtype_cost_thousand",
]
