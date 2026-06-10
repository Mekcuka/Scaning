"""Formatters for CAPEX/OPEX project rates."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.formatters._common import DATA_FOOTER, last_user_text
from app.assistant.chat.rate_labels import CAPEX_RATE_GROUPS, OPEX_PARAM_GROUPS, rate_key_label_ru
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

_RATE_HINTS = ("тариф", "ставк", "rates")
_ECONOMIC_HINTS = ("эконом", "opex", "цен")


def wants_rates_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    return any(h in last_user_text(messages) for h in _RATE_HINTS)


def wants_economic_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    return any(h in last_user_text(messages) for h in _ECONOMIC_HINTS)


def _format_rate_groups(
    rates: dict[str, float],
    groups: tuple[Any, ...],
    *,
    detailed: bool,
) -> list[str]:
    lines: list[str] = []
    for group in groups:
        group_lines: list[str] = []
        for key in group.keys:
            if key not in rates:
                continue
            value = rates[key]
            group_lines.append(f"- {rate_key_label_ru(key)}: {value:g} {group.unit_label}")
        if not group_lines:
            continue
        if detailed:
            lines.append(f"**{group.label}** ({group.unit_label}):")
            lines.extend(group_lines)
            lines.append("")
        else:
            sample = ", ".join(line.removeprefix("- ") for line in group_lines[:3])
            extra = len(group_lines) - 3
            suffix = f" и ещё {extra}" if extra > 0 else ""
            lines.append(f"- {group.label}: {len(group_lines)} ставок ({sample}{suffix})")
    return lines


def format_cost_rates_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
    detailed: bool = False,
) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])
    rates = data.get("rates") or {}
    if not isinstance(rates, dict):
        return ""

    if project_name:
        header = f"Тарифы (ставки CAPEX) проекта «{project_name}»:"
    else:
        header = "Тарифы (ставки CAPEX) проекта:"
    lines = [header, ""]
    group_lines = _format_rate_groups(rates, CAPEX_RATE_GROUPS, detailed=detailed)
    if not group_lines:
        lines.append("Ставки не заданы.")
    else:
        lines.extend(group_lines)
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_economic_params_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
    detailed: bool = False,
) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])
    params = data.get("params") or {}
    if not isinstance(params, dict):
        return ""

    if project_name:
        header = f"Экономические параметры (OPEX) проекта «{project_name}»:"
    else:
        header = "Экономические параметры (OPEX) проекта:"
    lines = [header, ""]
    group_lines = _format_rate_groups(params, OPEX_PARAM_GROUPS, detailed=detailed)
    if not group_lines:
        lines.append("Параметры не заданы.")
    else:
        lines.extend(group_lines)
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def match_rates(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    from app.assistant.chat.formatters._common import tool_ok

    text = last_user_text(messages)
    detailed = wants_rates_summary(messages, request) and any(
        w in text for w in ("покажи", "все", "полный", "список")
    )
    if wants_economic_summary(messages, request) and tool_ok(tool_summaries, "get_economic_params"):
        data = cache.get("get_economic_params")
        if isinstance(data, dict) and data.get("params") is not None:
            return format_economic_params_summary(
                data, project_name=request.project_name, detailed=detailed
            )
    if wants_rates_summary(messages, request) and tool_ok(tool_summaries, "get_cost_rates"):
        data = cache.get("get_cost_rates")
        if isinstance(data, dict) and data.get("rates") is not None:
            return format_cost_rates_summary(
                data, project_name=request.project_name, detailed=detailed
            )
    return None
