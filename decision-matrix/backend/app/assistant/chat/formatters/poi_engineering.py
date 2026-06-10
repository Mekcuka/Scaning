"""Formatters for POI engineering matrix settings (eng_power, etc.)."""

from __future__ import annotations

import re
from typing import Any

from app.assistant.chat.formatters._common import DATA_FOOTER, last_user_text, tool_ok
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary
from app.assistant.poi_engineering import (
    ENG_FIELD_LABELS_RU,
    format_engineering_summary_ru,
)

_ENGINEERING_HINTS = (
    "электроснабжен",
    "инженерн",
    "матриц",
    "ппд",
    "закачк",
    "подготовк",
    "транспорт",
    "сбор скваж",
    "обращен",
    "газ",
    "внешн",
    "внутренн",
    "eng_",
)
_FIELD_HINTS: list[tuple[tuple[str, ...], str]] = [
    (("электроснабжен", "электро"), "eng_power"),
    (("ппд", "закачк", "нагнетан"), "eng_injection"),
    (("газ", "факел"), "eng_gas"),
    (("подготовк", "нефт", "мкос", "мфнс"), "eng_oil_preparation"),
    (("сбор скваж", "однотруб", "двухтруб"), "eng_well_gathering"),
    (("транспорт", "автовывоз", "трубопровод", "морск"), "eng_transport"),
]


def wants_poi_engineering(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages).lower()
    return any(h in text for h in _ENGINEERING_HINTS)


def detect_engineering_field(messages: list[ChatMessage]) -> str | None:
    text = last_user_text(messages).lower()
    for hints, field in _FIELD_HINTS:
        if any(h in text for h in hints):
            return field
    return None


def _poi_name_hint(messages: list[ChatMessage], request: ChatRequest) -> str | None:
    if request.selected_poi_name:
        return request.selected_poi_name.strip()
    text = last_user_text(messages)
    m = re.search(r"poi\s*[-–:]\s*([^\n?.!,]+)", text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"точк[аи]\s*[_\s-]*(\S+)", text, re.IGNORECASE)
    if m:
        token = m.group(1).strip()
        return f"Точка_{token}" if token.isdigit() else token
    quoted = re.search(r"«([^»]+)»", text)
    if quoted:
        return quoted.group(1).strip()
    return None


def _find_poi_record(
    items: list[dict[str, Any]],
    *,
    name_hint: str | None,
    selected_poi_id: str | None,
) -> dict[str, Any] | None:
    if selected_poi_id:
        for item in items:
            if str(item.get("id")) == selected_poi_id:
                return item
    if not name_hint:
        return None
    hint = name_hint.lower()
    for item in items:
        name = str(item.get("name") or "").lower()
        if name == hint or hint in name:
            return item
    return None


def match_poi_engineering(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not wants_poi_engineering(messages, request):
        return None

    field = detect_engineering_field(messages)
    name_hint = _poi_name_hint(messages, request)
    selected_id = str(request.selected_poi_id) if request.selected_poi_id else None

    if tool_ok(tool_summaries, "get_poi"):
        data = cache.get("get_poi")
        if isinstance(data, dict):
            body = format_engineering_summary_ru(data, field=field)
            return f"{body}\n\n{DATA_FOOTER}"

    if tool_ok(tool_summaries, "list_pois"):
        data = cache.get("list_pois")
        if isinstance(data, dict):
            preview = data.get("preview") or []
            if isinstance(preview, list):
                poi = _find_poi_record(
                    preview,
                    name_hint=name_hint,
                    selected_poi_id=selected_id,
                )
                if poi:
                    body = format_engineering_summary_ru(poi, field=field)
                    return f"{body}\n\n{DATA_FOOTER}"

    return None
