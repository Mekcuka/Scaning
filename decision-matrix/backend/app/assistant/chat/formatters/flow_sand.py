"""Formatters for flow schematics and sand logistics."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.formatters._common import DATA_FOOTER, last_user_text, tool_ok
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

_FLOW_HINTS = ("поток", "схем", "pfd", "technology", "economic flow")
_SAND_HINTS = ("песок", "логистик", "sand", "карьер", "quarry")


def wants_flow_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    if request.active_tab and request.active_tab.startswith("flows/"):
        return True
    return any(h in last_user_text(messages) for h in _FLOW_HINTS)


def wants_sand_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    tab = request.active_tab or ""
    if tab in ("flows/logistics", "logistics/schematic", "logistics/sand"):
        return True
    if tab.startswith("logistics/"):
        return True
    return any(h in last_user_text(messages) for h in _SAND_HINTS)


def format_flow_schematic_summary(data: dict[str, Any]) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    nodes = data.get("nodes") or []
    edges = data.get("edges") or []
    source = str(data.get("source") or "auto")
    scheme_type = "технологическая" if source == "auto" else source
    if "summary" in data:
        scheme_type = "экономическая"

    lines = [
        f"Схема потоков ({scheme_type}): узлов **{len(nodes)}**, связей **{len(edges)}**.",
    ]
    warnings = data.get("warnings") or []
    if warnings:
        lines.append(f"Предупреждений: {len(warnings)}.")
    summary = data.get("summary")
    if isinstance(summary, dict):
        net = summary.get("net_mln_per_year")
        if net is not None:
            lines.append(f"Чистый поток: **{float(net):.2f}** млн руб./год.")
    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_sand_logistics_summary(data: dict[str, Any]) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    timeline = data.get("timeline") or []
    subnets = data.get("subnets") or []
    year_label = ""
    total_demand = 0.0
    total_allocated = 0.0
    unmet = 0.0

    if timeline:
        last_step = timeline[-1] if isinstance(timeline[-1], dict) else {}
        year = last_step.get("year")
        if year:
            year_label = f" (год {year})"
        total_demand = float(last_step.get("total_demand_m3") or 0)
        total_allocated = float(last_step.get("total_allocated_m3") or 0)
        unmet = float(last_step.get("unmet_m3") or 0)
    elif subnets:
        for sn in subnets:
            if not isinstance(sn, dict):
                continue
            for c in sn.get("consumers") or []:
                if isinstance(c, dict):
                    total_demand += float(c.get("demand_m3") or 0)

    subnet_count = int(data.get("subnet_count") or len(subnets))
    lines = [
        f"Логистика песка{year_label}: подсетей **{subnet_count}**.",
    ]
    if total_demand or total_allocated:
        lines.append(
            f"Спрос: **{total_demand:,.0f}** м³, распределено: **{total_allocated:,.0f}** м³."
        )
    if unmet > 0:
        lines.append(f"Непокрытый спрос: **{unmet:,.0f}** м³.")

    if subnets:
        lines.append("")
        lines.append("Подсети:")
        for sn in subnets[:3]:
            if not isinstance(sn, dict):
                continue
            name = sn.get("name") or f"#{sn.get('subnet_index')}"
            qc = int(sn.get("quarry_count") or 0)
            cc = int(sn.get("consumer_count") or 0)
            lines.append(f"- {name}: карьеров {qc}, потребителей {cc}")
        if len(subnets) > 3:
            lines.append(f"… всего подсетей: {len(subnets)}.")

    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def match_flow_schematic(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not wants_flow_summary(messages, request):
        return None
    if tool_ok(tool_summaries, "get_flow_schematic"):
        data = cache.get("get_flow_schematic")
        if isinstance(data, dict):
            return format_flow_schematic_summary(data)
    if tool_ok(tool_summaries, "get_economic_flow"):
        data = cache.get("get_economic_flow")
        if isinstance(data, dict):
            return format_flow_schematic_summary(data)
    return None


def match_sand_logistics(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not wants_sand_summary(messages, request):
        return None
    if tool_ok(tool_summaries, "get_sand_logistics_result"):
        data = cache.get("get_sand_logistics_result")
        if isinstance(data, dict):
            return format_sand_logistics_summary(data)
    return None
