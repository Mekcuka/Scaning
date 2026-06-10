"""Backward-compatible re-exports — see formatters/ package."""

from app.assistant.chat.formatters import (
    format_cost_rates_summary,
    format_economic_params_summary,
    format_infra_objects_summary,
    format_job_summary,
    format_layers_summary,
    format_pois_summary,
    format_project_card,
    format_projects_summary,
    subtype_label_ru,
    wants_economic_summary,
    wants_job_summary,
    wants_map_infra_summary,
    wants_poi_summary,
    wants_projects_summary,
    wants_rates_summary,
)
from app.assistant.chat.formatters.registry import try_server_answer_after_tools as _try_answer
from app.assistant.chat.schemas import ChatRequest, ToolCallSummary


def try_server_answer_after_tools(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict,
) -> str | None:
    answer, _source = _try_answer(request, tool_summaries, tool_result_cache)
    return answer

__all__ = [
    "format_cost_rates_summary",
    "format_economic_params_summary",
    "format_infra_objects_summary",
    "format_job_summary",
    "format_layers_summary",
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
