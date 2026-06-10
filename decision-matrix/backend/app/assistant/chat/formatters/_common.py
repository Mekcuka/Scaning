"""Shared helpers for server-side chat formatters."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

DATA_FOOTER = "Данные из системы."
PREVIEW_NAMES_LIMIT = 10
JOB_LIST_LIMIT = 5


@lru_cache(maxsize=1)
def subtype_labels() -> dict[str, str]:
    backend = Path(__file__).resolve().parents[4]
    path = backend / "shared" / "infrastructure_subtypes.json"
    if not path.is_file():
        path = backend.parent / "shared" / "infrastructure_subtypes.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    labels = data.get("labels") or {}
    return {str(k): str(v) for k, v in labels.items()}


def subtype_label_ru(subtype: str) -> str:
    return subtype_labels().get(subtype, subtype)


def last_user_text(messages: list[ChatMessage]) -> str:
    user_msgs = [m for m in messages if m.role == "user"]
    return user_msgs[-1].content.lower() if user_msgs else ""


def tool_ok(tool_summaries: list[ToolCallSummary], name: str) -> bool:
    return any(t.name == name and t.ok for t in tool_summaries)


def preview_names(
    preview: list[Any],
    *,
    field: str = "name",
    limit: int = PREVIEW_NAMES_LIMIT,
) -> list[str]:
    names: list[str] = []
    for item in preview:
        if isinstance(item, dict) and item.get(field):
            names.append(str(item[field]))
        if len(names) >= limit:
            break
    return names


def has_poi_intent(text: str) -> bool:
    return any(h in text for h in ("poi", "точк", "скважин", "интерес"))


def has_map_intent(text: str) -> bool:
    return any(
        h in text
        for h in ("объект", "карта", "инфраструктур", "слой", "на карте", "подложк")
    )


def wants_count_without_domain(text: str) -> bool:
    """«сколько?» without POI/map context — likely projects when no project_id in UI."""
    if not any(h in text for h in ("сколько", "число", "количество", "кол-во")):
        return False
    return not has_poi_intent(text) and not has_map_intent(text)
