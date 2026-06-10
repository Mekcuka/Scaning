"""Formatter registry — deterministic answers after tool rounds."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from app.assistant.chat.formatters.admin import match_admin_health, match_admin_jobs
from app.assistant.chat.formatters.analysis import match_poi_analysis, match_poi_candidates
from app.assistant.chat.formatters.counts import (
    match_infra,
    match_layers,
    match_pois,
    match_project_card,
    match_projects,
)
from app.assistant.chat.formatters.errors import try_tool_error_answer
from app.assistant.chat.formatters.flow_sand import match_flow_schematic, match_sand_logistics
from app.assistant.chat.formatters.jobs import match_jobs
from app.assistant.chat.formatters.poi_engineering import match_poi_engineering
from app.assistant.chat.formatters.misc import (
    match_assistant_status,
    match_composite_projects_job,
    match_get_me,
    match_imports,
    match_map3d,
    match_networks,
    match_one_pagers,
)
from app.assistant.chat.formatters.rates import match_rates
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

MatchFn = Callable[
    [list[ToolCallSummary], dict[str, Any], list[ChatMessage], ChatRequest],
    str | None,
]


@dataclass(frozen=True)
class FormatterSpec:
    name: str
    tool_names: frozenset[str]
    match_fn: MatchFn
    priority: int = 100
    tool_first: bool = False


def _specs() -> list[FormatterSpec]:
    return [
        FormatterSpec("composite_projects_job", frozenset({"list_projects", "get_project_job"}), match_composite_projects_job, priority=10),
        FormatterSpec("infra", frozenset({"list_infra_objects"}), match_infra, priority=20, tool_first=True),
        FormatterSpec("projects", frozenset({"list_projects"}), match_projects, priority=30, tool_first=True),
        FormatterSpec(
            "poi_engineering",
            frozenset({"get_poi", "list_pois"}),
            match_poi_engineering,
            priority=35,
            tool_first=True,
        ),
        FormatterSpec("pois", frozenset({"list_pois"}), match_pois, priority=40, tool_first=True),
        FormatterSpec("layers", frozenset({"list_infra_layers"}), match_layers, priority=50, tool_first=True),
        FormatterSpec("project_card", frozenset({"get_project"}), match_project_card, priority=55),
        FormatterSpec("poi_analysis", frozenset({"get_poi_analysis"}), match_poi_analysis, priority=60),
        FormatterSpec("poi_candidates", frozenset({"get_poi_candidates"}), match_poi_candidates, priority=65),
        FormatterSpec("jobs", frozenset({"get_project_job", "list_project_jobs"}), match_jobs, priority=70),
        FormatterSpec("rates", frozenset({"get_cost_rates", "get_economic_params"}), match_rates, priority=80),
        FormatterSpec("admin_jobs", frozenset({"admin_list_jobs"}), match_admin_jobs, priority=90),
        FormatterSpec("admin_health", frozenset({"admin_jobs_health"}), match_admin_health, priority=95),
        FormatterSpec("flow", frozenset({"get_flow_schematic", "get_economic_flow"}), match_flow_schematic, priority=100),
        FormatterSpec("sand", frozenset({"get_sand_logistics_result"}), match_sand_logistics, priority=110),
        FormatterSpec("get_me", frozenset({"get_me"}), match_get_me, priority=200),
        FormatterSpec("assistant_status", frozenset({"get_assistant_status"}), match_assistant_status, priority=210),
        FormatterSpec("one_pagers", frozenset({"list_one_pagers", "get_one_pager"}), match_one_pagers, priority=220),
        FormatterSpec("imports", frozenset({"list_import_logs", "list_import_connections"}), match_imports, priority=230),
        FormatterSpec("networks", frozenset({"list_networks"}), match_networks, priority=240),
        FormatterSpec("map3d", frozenset({"list_map3d_custom_models"}), match_map3d, priority=250),
    ]


FORMATTER_SPECS: list[FormatterSpec] = sorted(_specs(), key=lambda s: s.priority)


def covered_tool_names() -> list[str]:
    names: set[str] = set()
    for spec in FORMATTER_SPECS:
        names.update(spec.tool_names)
    return sorted(names)


def try_server_answer_after_tools(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> tuple[str | None, str | None]:
    """Return (answer_text, answer_source) where source is formatter|tool_error."""
    error_answer = try_tool_error_answer(request, tool_summaries, tool_result_cache)
    if error_answer:
        return error_answer, "tool_error"

    messages = request.messages
    for spec in FORMATTER_SPECS:
        answer = spec.match_fn(tool_summaries, tool_result_cache, messages, request)
        if answer:
            return answer, "formatter"
    return None, None
