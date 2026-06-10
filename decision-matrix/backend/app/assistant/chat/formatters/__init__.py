"""Server-side chat response formatters (phase 7.2+)."""

from app.assistant.chat.formatters.analysis import (
    format_poi_analysis_summary,
    format_poi_candidates_summary,
)
from app.assistant.chat.formatters.counts import (
    format_infra_objects_summary,
    format_layers_summary,
    format_pois_summary,
    format_project_card,
    format_projects_summary,
    wants_map_infra_summary,
    wants_poi_summary,
    wants_projects_summary,
)
from app.assistant.chat.formatters.jobs import format_job_summary, wants_job_summary
from app.assistant.chat.formatters.rates import (
    format_cost_rates_summary,
    format_economic_params_summary,
    wants_economic_summary,
    wants_rates_summary,
)
from app.assistant.chat.formatters.registry import (
    FORMATTER_SPECS,
    covered_tool_names,
    try_server_answer_after_tools,
)
from app.assistant.chat.formatters._common import subtype_label_ru

__all__ = [
    "FORMATTER_SPECS",
    "covered_tool_names",
    "format_cost_rates_summary",
    "format_economic_params_summary",
    "format_infra_objects_summary",
    "format_job_summary",
    "format_layers_summary",
    "format_poi_analysis_summary",
    "format_poi_candidates_summary",
    "format_pois_summary",
    "format_project_card",
    "format_projects_summary",
    "subtype_label_ru",
    "try_server_answer_after_tools",
    "wants_economic_summary",
    "wants_job_summary",
    "wants_map_infra_summary",
    "wants_poi_summary",
    "wants_projects_summary",
    "wants_rates_summary",
]
