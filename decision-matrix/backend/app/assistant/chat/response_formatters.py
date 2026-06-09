"""Server-side formatting of tool results for user-facing chat (phase 7.2)."""

from __future__ import annotations

import json
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.assistant.chat.job_labels import job_status_label_ru, job_type_label_ru
from app.assistant.chat.rate_labels import CAPEX_RATE_GROUPS, OPEX_PARAM_GROUPS, rate_key_label_ru
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

_POI_HINTS = (
    "poi",
    "точк",
    "скважин",
    "интерес",
)

_PROJECT_HINTS = (
    "проект",
    "сколько проектов",
    "какие проект",
    "список проект",
)

_JOB_HINTS = (
    "задач",
    "job",
    "фонов",
    "выполня",
    "статус",
    "журнал",
)

_RATE_HINTS = (
    "тариф",
    "ставк",
    "rates",
)

_ECONOMIC_HINTS = (
    "эконом",
    "opex",
    "цен",
)

_DATA_FOOTER = "Данные из системы."

_PREVIEW_NAMES_LIMIT = 10
_JOB_LIST_LIMIT = 5


@lru_cache(maxsize=1)
def _subtype_labels() -> dict[str, str]:
    backend = Path(__file__).resolve().parents[3]
    path = backend / "shared" / "infrastructure_subtypes.json"
    if not path.is_file():
        path = backend.parent / "shared" / "infrastructure_subtypes.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    labels = data.get("labels") or {}
    return {str(k): str(v) for k, v in labels.items()}


def subtype_label_ru(subtype: str) -> str:
    return _subtype_labels().get(subtype, subtype)


def _last_user_text(messages: list[ChatMessage]) -> str:
    user_msgs = [m for m in messages if m.role == "user"]
    return user_msgs[-1].content.lower() if user_msgs else ""


def _tool_ok(tool_summaries: list[ToolCallSummary], name: str) -> bool:
    return any(t.name == name and t.ok for t in tool_summaries)


def _has_poi_intent(text: str) -> bool:
    return any(hint in text for hint in _POI_HINTS)


def wants_map_infra_summary(messages: list[ChatMessage]) -> bool:
    text = _last_user_text(messages)
    if _has_poi_intent(text):
        return False
    if "сколько" in text and not any(h in text for h in _MAP_OBJECT_HINTS):
        return False
    return any(hint in text for hint in _MAP_OBJECT_HINTS) or (
        "сколько" in text and any(h in text for h in ("объект", "карта", "инфраструктур", "слой"))
    )


def wants_poi_summary(messages: list[ChatMessage]) -> bool:
    text = _last_user_text(messages)
    if _has_poi_intent(text):
        return True
    return False


def wants_projects_summary(messages: list[ChatMessage]) -> bool:
    text = _last_user_text(messages)
    return any(hint in text for hint in _PROJECT_HINTS)


def wants_job_summary(messages: list[ChatMessage]) -> bool:
    text = _last_user_text(messages)
    return any(hint in text for hint in _JOB_HINTS)


def wants_rates_summary(messages: list[ChatMessage]) -> bool:
    text = _last_user_text(messages)
    return any(hint in text for hint in _RATE_HINTS)


def wants_economic_summary(messages: list[ChatMessage]) -> bool:
    text = _last_user_text(messages)
    return any(hint in text for hint in _ECONOMIC_HINTS)


def format_infra_objects_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
) -> str:
    """Authoritative Russian summary from list_infra_objects compact payload."""
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    count = int(data.get("count") or 0)
    by_subtype: dict[str, int] = data.get("count_by_subtype") or {}

    if project_name:
        header = f"На карте проекта «{project_name}» объектов инфраструктуры (видимые слои): **{count}**."
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


def _preview_names(preview: list[Any], *, field: str = "name", limit: int = _PREVIEW_NAMES_LIMIT) -> list[str]:
    names: list[str] = []
    for item in preview:
        if isinstance(item, dict) and item.get(field):
            names.append(str(item[field]))
        if len(names) >= limit:
            break
    return names


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
        lines.append(_DATA_FOOTER)
        return "\n".join(lines)

    names = _preview_names(data.get("preview") or [])
    if names:
        lines.append("")
        lines.append("Список:")
        for name in names:
            lines.append(f"- {name}")
    if data.get("truncated") or count > len(names):
        lines.append(f"… показаны первые {len(names)} из {count}.")

    lines.append("")
    lines.append(_DATA_FOOTER)
    return "\n".join(lines)


def format_projects_summary(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    lines = [f"Доступных проектов: **{count}**."]
    if count == 0:
        lines.append("Проектов нет или нет прав на просмотр.")
        lines.append(_DATA_FOOTER)
        return "\n".join(lines)

    names = _preview_names(data.get("preview") or [])
    if names:
        lines.append("")
        lines.append("Проекты:")
        for name in names:
            lines.append(f"- {name}")
    if data.get("truncated") or count > len(names):
        lines.append(f"… показаны первые {len(names)} из {count}.")

    lines.append("")
    lines.append(_DATA_FOOTER)
    return "\n".join(lines)


def _format_single_job(job: dict[str, Any]) -> list[str]:
    job_type = job_type_label_ru(str(job.get("job_type") or "unknown"))
    status = job_status_label_ru(str(job.get("status") or "unknown"))
    lines = [f"**{job_type}** — {status}."]
    progress = job.get("progress")
    if progress is not None and str(job.get("status")) == "running":
        lines.append(f"Прогресс: {float(progress):.0f}%.")
    error = job.get("error_message")
    if error and str(job.get("status")) == "failed":
        lines.append(f"Ошибка: {error}")
    return lines


def format_job_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
) -> str:
    if data.get("active") is False:
        if project_name:
            return f"В проекте «{project_name}» активных фоновых задач нет.\n\n{_DATA_FOOTER}"
        return f"Активных фоновых задач нет.\n\n{_DATA_FOOTER}"

    if "items" in data:
        total = int(data.get("total") or 0)
        items = data.get("items") or []
        if project_name:
            header = f"Фоновые задачи проекта «{project_name}»: **{total}** (последние записи)."
        else:
            header = f"Фоновых задач в проекте: **{total}**."
        lines = [header]
        if not items:
            lines.append("Записей в журнале нет.")
        else:
            lines.append("")
            for job in items[:_JOB_LIST_LIMIT]:
                if isinstance(job, dict):
                    lines.extend(_format_single_job(job))
            if total > _JOB_LIST_LIMIT:
                lines.append(f"… всего записей: {total}.")
        lines.append("")
        lines.append(_DATA_FOOTER)
        return "\n".join(lines)

    if isinstance(data, dict) and data.get("job_type"):
        if project_name:
            lines = [f"Активная фоновая задача в проекте «{project_name}»:"]
        else:
            lines = ["Активная фоновая задача:"]
        lines.append("")
        lines.extend(_format_single_job(data))
        lines.append("")
        lines.append(_DATA_FOOTER)
        return "\n".join(lines)

    return ""


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
    lines.append(_DATA_FOOTER)
    return "\n".join(lines)


def format_economic_params_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
    detailed: bool = False,
) -> str:
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
    lines.append(_DATA_FOOTER)
    return "\n".join(lines)


def _match_infra(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> str | None:
    if not _tool_ok(tool_summaries, "list_infra_objects"):
        return None
    data = tool_result_cache.get("list_infra_objects")
    if not isinstance(data, dict) or "count" not in data:
        return None
    if not wants_map_infra_summary(request.messages):
        return None
    return format_infra_objects_summary(data, project_name=request.project_name)


def _match_projects(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> str | None:
    if not _tool_ok(tool_summaries, "list_projects"):
        return None
    data = tool_result_cache.get("list_projects")
    if not isinstance(data, dict) or "count" not in data:
        return None
    if not wants_projects_summary(request.messages):
        return None
    return format_projects_summary(data)


def _match_pois(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> str | None:
    if not _tool_ok(tool_summaries, "list_pois"):
        return None
    data = tool_result_cache.get("list_pois")
    if not isinstance(data, dict) or "count" not in data:
        return None
    if not wants_poi_summary(request.messages):
        return None
    return format_pois_summary(data, project_name=request.project_name)


def _match_jobs(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> str | None:
    if not wants_job_summary(request.messages):
        return None
    if _tool_ok(tool_summaries, "get_project_job"):
        data = tool_result_cache.get("get_project_job")
        if isinstance(data, dict):
            text = format_job_summary(data, project_name=request.project_name)
            if text:
                return text
    if _tool_ok(tool_summaries, "list_project_jobs"):
        data = tool_result_cache.get("list_project_jobs")
        if isinstance(data, dict):
            text = format_job_summary(data, project_name=request.project_name)
            if text:
                return text
    return None


def _match_rates(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> str | None:
    detailed = wants_rates_summary(request.messages) and any(
        w in _last_user_text(request.messages) for w in ("покажи", "все", "полный", "список")
    )
    if wants_economic_summary(request.messages) and _tool_ok(tool_summaries, "get_economic_params"):
        data = tool_result_cache.get("get_economic_params")
        if isinstance(data, dict) and data.get("params") is not None:
            return format_economic_params_summary(
                data, project_name=request.project_name, detailed=detailed
            )
    if wants_rates_summary(request.messages) and _tool_ok(tool_summaries, "get_cost_rates"):
        data = tool_result_cache.get("get_cost_rates")
        if isinstance(data, dict) and data.get("rates") is not None:
            return format_cost_rates_summary(data, project_name=request.project_name, detailed=detailed)
    return None


_FORMATTERS: list[
    Callable[[ChatRequest, list[ToolCallSummary], dict[str, Any]], str | None]
] = [
    _match_infra,
    _match_projects,
    _match_pois,
    _match_jobs,
    _match_rates,
]


def try_server_answer_after_tools(
    request: ChatRequest,
    tool_summaries: list[ToolCallSummary],
    tool_result_cache: dict[str, Any],
) -> str | None:
    """Return deterministic user-facing answer when a formatter matches tool results."""
    for matcher in _FORMATTERS:
        answer = matcher(request, tool_summaries, tool_result_cache)
        if answer:
            return answer
    return None
