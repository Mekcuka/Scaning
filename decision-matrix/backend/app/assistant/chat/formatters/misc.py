"""Miscellaneous read-tool formatters and composite answers."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.formatters._common import DATA_FOOTER, last_user_text, tool_ok
from app.assistant.chat.formatters.counts import format_projects_summary
from app.assistant.chat.formatters.jobs import format_job_summary
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary


def format_me_summary(data: dict[str, Any]) -> str:
    email = data.get("email") or "—"
    role = data.get("role") or "—"
    username = data.get("username") or ""
    lines = [f"Пользователь: **{email}** ({role})."]
    if username:
        lines.append(f"Имя: {username}.")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_assistant_status_summary(data: dict[str, Any]) -> str:
    if not data.get("enabled"):
        return "Чат-помощник отключён."
    ready = "готов" if data.get("provider_ready") else "недоступен"
    model = data.get("model") or "не задан"
    return f"LLM: {model} ({ready}).\n\n{DATA_FOOTER}"


def format_one_pagers_list(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    lines = [f"One-pager отчётов: **{count}**."]
    for item in (data.get("preview") or [])[:5]:
        if isinstance(item, dict) and item.get("title"):
            status = item.get("generation_status") or ""
            lines.append(f"- {item['title']} ({status})")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_one_pager_card(data: dict[str, Any]) -> str:
    title = data.get("title") or "—"
    poi = data.get("poi_name") or "—"
    status = data.get("generation_status") or "—"
    lines = [
        f"Отчёт «{title}» (POI: {poi}).",
        f"Статус генерации: {status}.",
        DATA_FOOTER,
    ]
    return "\n".join(lines)


def format_import_logs_summary(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    lines = [f"Записей журнала импорта: **{count}**."]
    preview = data.get("preview") or []
    if preview and isinstance(preview[0], dict):
        last = preview[0]
        st = last.get("status") or last.get("state") or "—"
        lines.append(f"Последний импорт: статус **{st}**.")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_import_connections_summary(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    return f"Подключений импорта: **{count}**.\n\n{DATA_FOOTER}"


def format_networks_summary(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    lines = [f"Транспортных сетей: **{count}**."]
    for item in (data.get("preview") or [])[:5]:
        if isinstance(item, dict):
            name = item.get("name") or item.get("id") or "—"
            lines.append(f"- {name}")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_map3d_models_summary(data: dict[str, Any]) -> str:
    count = int(data.get("count") or 0)
    lines = [f"3D-моделей на карте: **{count}**."]
    names = [
        str(i.get("name"))
        for i in (data.get("preview") or [])
        if isinstance(i, dict) and i.get("name")
    ]
    if names:
        lines.append("Модели: " + ", ".join(names[:10]) + ".")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def match_composite_projects_job(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not (
        tool_ok(tool_summaries, "list_projects")
        and tool_ok(tool_summaries, "get_project_job")
    ):
        return None
    projects = cache.get("list_projects")
    job = cache.get("get_project_job")
    if not isinstance(projects, dict) or not isinstance(job, dict):
        return None
    text = last_user_text(messages)
    if "проект" not in text and "задач" not in text:
        return None
    parts = [format_projects_summary(projects).rstrip()]
    job_text = format_job_summary(job, project_name=request.project_name)
    if job_text:
        parts.append(job_text.rstrip())
    return "\n\n".join(parts)


def match_get_me(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "get_me"):
        return None
    data = cache.get("get_me")
    if not isinstance(data, dict):
        return None
    text = last_user_text(messages)
    if not any(h in text for h in ("кто я", "профил", "роль", "get_me", "пользователь")):
        return None
    return format_me_summary(data)


def match_assistant_status(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not tool_ok(tool_summaries, "get_assistant_status"):
        return None
    data = cache.get("get_assistant_status")
    if not isinstance(data, dict):
        return None
    text = last_user_text(messages)
    if not any(h in text for h in ("статус", "llm", "помощник", "модель")):
        return None
    return format_assistant_status_summary(data)


def match_one_pagers(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    text = last_user_text(messages)
    if "one-pager" not in text and "отчёт" not in text and "one pager" not in text:
        return None
    if tool_ok(tool_summaries, "get_one_pager"):
        data = cache.get("get_one_pager")
        if isinstance(data, dict):
            return format_one_pager_card(data)
    if tool_ok(tool_summaries, "list_one_pagers"):
        data = cache.get("list_one_pagers")
        if isinstance(data, dict):
            return format_one_pagers_list(data)
    return None


def match_imports(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    text = last_user_text(messages)
    if "импорт" not in text:
        return None
    if tool_ok(tool_summaries, "list_import_logs"):
        data = cache.get("list_import_logs")
        if isinstance(data, dict):
            return format_import_logs_summary(data)
    if tool_ok(tool_summaries, "list_import_connections"):
        data = cache.get("list_import_connections")
        if isinstance(data, dict):
            return format_import_connections_summary(data)
    return None


def match_networks(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    text = last_user_text(messages)
    if not any(h in text for h in ("сеть", "network", "автодорог")):
        return None
    if tool_ok(tool_summaries, "list_networks"):
        data = cache.get("list_networks")
        if isinstance(data, dict):
            return format_networks_summary(data)
    return None


def match_map3d(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    text = last_user_text(messages)
    if "3d" not in text and "модел" not in text:
        return None
    if tool_ok(tool_summaries, "list_map3d_custom_models"):
        data = cache.get("list_map3d_custom_models")
        if isinstance(data, dict):
            return format_map3d_models_summary(data)
    return None
