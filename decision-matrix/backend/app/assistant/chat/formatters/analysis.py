"""Formatters for POI analysis and infrastructure candidates."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.analysis_labels import overall_status_label_ru, row_status_label_ru
from app.assistant.chat.formatters._common import DATA_FOOTER, last_user_text, subtype_label_ru, tool_ok
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

_ANALYSIS_HINTS = ("анализ", "превыш", "матриц", "стоимост", "окружен")
_CANDIDATE_HINTS = ("кандидат", "ближайш", "расстояни")


def wants_poi_analysis_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages)
    return any(h in text for h in _ANALYSIS_HINTS)


def wants_poi_candidates_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages)
    return any(h in text for h in _CANDIDATE_HINTS)


def format_poi_analysis_summary(data: dict[str, Any], *, poi_name: str | None = None) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    total = data.get("total_cost_mln")
    overall = str(data.get("overall_status") or "unknown")
    rows = data.get("rows") or data.get("analysis") or []

    header = "Анализ инфраструктуры POI"
    if poi_name:
        header += f" «{poi_name}»"
    lines = [f"{header}:", ""]
    if total is not None:
        lines.append(f"Суммарная стоимость: **{float(total):.2f}** млн руб.")
    lines.append(f"Общий статус: **{overall_status_label_ru(overall)}**.")

    exceed_rows = [
        r
        for r in rows
        if isinstance(r, dict)
        and str(r.get("status", "")) in ("exceed", "exceeded", "warning")
    ]
    if exceed_rows:
        lines.append(f"Строк с превышением/предупреждением: **{len(exceed_rows)}**.")

    costed = [
        r
        for r in rows
        if isinstance(r, dict) and r.get("cost_mln") is not None and r.get("subtype") != "pads"
    ]
    costed.sort(key=lambda r: float(r.get("cost_mln") or 0), reverse=True)
    if costed:
        lines.append("")
        lines.append("Топ подтипов по стоимости:")
        for row in costed[:5]:
            subtype = str(row.get("subtype") or "—")
            cost = float(row.get("cost_mln") or 0)
            st = row_status_label_ru(str(row.get("status") or ""))
            lines.append(f"- {subtype_label_ru(subtype)}: {cost:.2f} млн руб. ({st})")

    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_poi_candidates_summary(
    data: dict[str, Any],
    *,
    limit: int = 10,
) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    items = data.get("preview") if isinstance(data.get("preview"), list) else None
    if items is None and isinstance(data, list):
        items = data
    if not isinstance(items, list):
        return ""

    count = int(data.get("count", len(items))) if isinstance(data, dict) else len(items)
    lines = [f"Кандидаты инфраструктуры: **{count}**.", ""]
    if not items:
        lines.append("Кандидаты не найдены.")
    else:
        lines.append("Имя | расстояние, км")
        for item in items[:limit]:
            if not isinstance(item, dict):
                continue
            name = item.get("name") or item.get("object_id") or "—"
            dist = item.get("distance_km")
            dist_s = f"{float(dist):.2f}" if dist is not None else "—"
            lines.append(f"- {name}: {dist_s}")
        if count > limit:
            lines.append(f"… показаны первые {limit} из {count}.")
    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def _single_ok_tool(tool_summaries: list[ToolCallSummary], name: str) -> bool:
    ok_names = [t.name for t in tool_summaries if t.ok]
    return ok_names == [name]


def match_poi_analysis(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "get_poi_analysis"):
        return None
    data = cache.get("get_poi_analysis")
    if not isinstance(data, dict) or "overall_status" not in data:
        return None
    tool_first = _single_ok_tool(tool_summaries, "get_poi_analysis")
    if (
        not wants_poi_analysis_summary(messages, request)
        and request.active_tab not in ("matrix", "project-detail")
        and not tool_first
    ):
        return None
    return format_poi_analysis_summary(data)


def match_poi_candidates(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "get_poi_candidates"):
        return None
    data = cache.get("get_poi_candidates")
    if data is None:
        return None
    if not wants_poi_candidates_summary(messages, request) and not _single_ok_tool(
        tool_summaries, "get_poi_candidates"
    ):
        return None
    if isinstance(data, dict):
        return format_poi_candidates_summary(data)
    if isinstance(data, list):
        return format_poi_candidates_summary({"count": len(data), "preview": data})
    return None
