"""Formatters for list/count tools and project card."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.formatters._common import (
    DATA_FOOTER,
    PREVIEW_NAMES_LIMIT,
    has_map_intent,
    has_poi_intent,
    last_user_text,
    preview_names,
    subtype_label_ru,
    tool_ok,
    wants_count_without_domain,
)
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

_MAP_OBJECT_HINTS = (
    "объект",
    "карта",
    "инфраструктур",
    "какие",
    "тип",
    "слой",
    "на карте",
)
_PROJECT_HINTS = (
    "проект",
    "сколько проектов",
    "какие проект",
    "список проект",
    "сколько",
    "число",
    "количество",
    "кол-во",
)
_POI_HINTS = ("poi", "точк", "скважин", "интерес")
_LAYER_HINTS = ("слой", "слои", "слоёв", "слоёв", "layers", "подложк", "layer")
_PROJECT_CARD_HINTS = ("расскаж", "описан", "карточк", "о проекте", "информац")

TOOL_FIRST_LIST = frozenset(
    {"list_projects", "list_pois", "list_infra_objects", "list_infra_layers"}
)


def wants_map_infra_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages)
    if has_poi_intent(text):
        return False
    if "сколько" in text and not any(h in text for h in _MAP_OBJECT_HINTS):
        return False
    return any(h in text for h in _MAP_OBJECT_HINTS) or (
        "сколько" in text
        and any(h in text for h in ("объект", "карта", "инфраструктур", "слой"))
    )


def wants_poi_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    return has_poi_intent(last_user_text(messages))


def wants_projects_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages)
    if has_poi_intent(text) or has_map_intent(text):
        return False
    return any(h in text for h in _PROJECT_HINTS) or wants_count_without_domain(text)


def wants_layers_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    return any(h in last_user_text(messages) for h in _LAYER_HINTS)


def wants_project_card(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages)
    return any(h in text for h in _PROJECT_CARD_HINTS) or (
        request.project_id is not None and "проект" in text
    )


def format_infra_objects_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    count = int(data.get("count") or 0)
    by_subtype: dict[str, int] = data.get("count_by_subtype") or {}

    if project_name:
        header = (
            f"На карте проекта «{project_name}» объектов инфраструктуры "
            f"(видимые слои): **{count}**."
        )
    else:
        header = f"Объектов инфраструктуры на видимых слоях карты: **{count}**."

    lines = [header]
    if count == 0:
        lines.append("На видимых слоях объектов нет (или все слои скрыты).")
        lines.append("Точки интереса (POI) считаются отдельно — уточните, если нужен их список.")
        return "\n".join(lines)

    lines.append("")
    lines.append("По типам:")
    for subtype, n in sorted(by_subtype.items(), key=lambda x: (-x[1], x[0])):
        lines.append(f"- {subtype_label_ru(subtype)}: {n}")

    subtype_sum = sum(by_subtype.values())
    if subtype_sum != count:
        lines.append(f"- прочие / без подтипа: {count - subtype_sum}")

    lines.append("")
    lines.append(
        "Данные из системы (агрегация по всем объектам на видимых слоях). "
        "POI — отдельно, через список точек интереса."
    )
    return "\n".join(lines)


def format_pois_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
) -> str:
    count = int(data.get("count") or 0)
    if project_name:
        header = f"В проекте «{project_name}» точек интереса (POI): **{count}**."
    else:
        header = f"Точек интереса (POI) в проекте: **{count}**."

    lines = [header]
    if count == 0:
        lines.append("POI в проекте пока нет.")
        lines.append(DATA_FOOTER)
        return "\n".join(lines)

    names = preview_names(data.get("preview") or [], limit=PREVIEW_NAMES_LIMIT)
    if names:
        lines.append("")
        lines.append("Список:")
        for name in names:
            lines.append(f"- {name}")
    if data.get("truncated") or count > len(names):
        lines.append(f"… показаны первые {len(names)} из {count}.")

    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_projects_summary(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    lines = [f"Доступных проектов: **{count}**."]
    if count == 0:
        lines.append("Проектов нет или нет прав на просмотр.")
        lines.append(DATA_FOOTER)
        return "\n".join(lines)

    names = preview_names(data.get("preview") or [], limit=PREVIEW_NAMES_LIMIT)
    if names:
        lines.append("")
        lines.append("Проекты:")
        for name in names:
            lines.append(f"- {name}")
    if data.get("truncated") or count > len(names):
        lines.append(f"… показаны первые {len(names)} из {count}.")

    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_layers_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
) -> str:
    count = int(data.get("count") or 0)
    if project_name:
        header = f"В проекте «{project_name}» слоёв карты: **{count}**."
    else:
        header = f"Слоёв карты в проекте: **{count}**."
    lines = [header]
    by_type = data.get("count_by_layer_type") or {}
    if by_type:
        lines.append("")
        lines.append("По типам:")
        for layer_type, n in sorted(by_type.items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"- {layer_type}: {n}")
    preview = data.get("preview") or []
    if preview:
        titles = preview_names(preview, field="title", limit=PREVIEW_NAMES_LIMIT)
        if not titles:
            titles = preview_names(preview, limit=PREVIEW_NAMES_LIMIT)
        if titles:
            lines.append("")
            lines.append("Слои: " + ", ".join(titles) + ".")
    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_project_card(data: dict[str, Any]) -> str:
    name = data.get("name") or "—"
    status = data.get("status") or "—"
    poi_count = data.get("poi_count")
    owner = data.get("owner_name") or data.get("owner_email") or "—"
    lines = [
        f"Проект «{name}».",
        f"Статус: {status}.",
    ]
    if poi_count is not None:
        lines.append(f"Точек интереса: {poi_count}.")
    desc = data.get("description")
    if desc:
        lines.append(f"Описание: {desc}")
    lines.append(f"Владелец: {owner}.")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def match_infra(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "list_infra_objects"):
        return None
    data = cache.get("list_infra_objects")
    if not isinstance(data, dict) or "count" not in data:
        return None
    if wants_map_infra_summary(messages, request):
        return format_infra_objects_summary(data, project_name=request.project_name)
    # tool-first: count answer even without map intent
    count = int(data.get("count") or 0)
    if request.project_name:
        return (
            f"На карте проекта «{request.project_name}» объектов инфраструктуры: **{count}**.\n\n"
            f"{DATA_FOOTER}"
        )
    return f"Объектов инфраструктуры на карте: **{count}**.\n\n{DATA_FOOTER}"


def match_projects(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "list_projects"):
        return None
    data = cache.get("list_projects")
    if not isinstance(data, dict) or "count" not in data:
        return None
    return format_projects_summary(data)


def match_pois(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    from app.assistant.chat.formatters.poi_engineering import wants_poi_engineering

    if wants_poi_engineering(messages, request):
        return None
    if not tool_ok(tool_summaries, "list_pois"):
        return None
    data = cache.get("list_pois")
    if not isinstance(data, dict) or "count" not in data:
        return None
    return format_pois_summary(data, project_name=request.project_name)


def match_layers(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "list_infra_layers"):
        return None
    data = cache.get("list_infra_layers")
    if not isinstance(data, dict) or "count" not in data:
        return None
    # User asked for infra objects — do not short-circuit; let LLM call list_infra_objects.
    if wants_map_infra_summary(messages, request) and not wants_layers_summary(
        messages, request
    ):
        return None
    return format_layers_summary(data, project_name=request.project_name)


def match_project_card(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "get_project"):
        return None
    data = cache.get("get_project")
    if not isinstance(data, dict):
        return None
    if not wants_project_card(messages, request) and request.project_id is None:
        return None
    return format_project_card(data)
