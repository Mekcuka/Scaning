"""Formatters for admin job journal."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.formatters._common import DATA_FOOTER, last_user_text, tool_ok
from app.assistant.chat.job_labels import job_status_label_ru, job_type_label_ru
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

_ADMIN_HINTS = ("admin", "админ", "журнал задач", "все задач", "очеред")


def wants_admin_jobs(messages: list[ChatMessage], request: ChatRequest) -> bool:
    if request.active_tab == "admin/jobs":
        return True
    text = last_user_text(messages)
    return any(h in text for h in _ADMIN_HINTS) or (
        "задач" in text and any(h in text for h in ("все", "систем", "очеред"))
    )


def wants_admin_health(messages: list[ChatMessage], request: ChatRequest) -> bool:
    text = last_user_text(messages)
    return request.active_tab == "admin/jobs" or any(
        h in text for h in ("redis", "очеред", "health", "здоров")
    )


def format_admin_jobs_summary(data: dict[str, Any]) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    total = int(data.get("total") or 0)
    items = data.get("items") or []
    by_status: dict[str, int] = {}
    for item in items:
        if isinstance(item, dict) and item.get("status"):
            st = str(item["status"])
            by_status[st] = by_status.get(st, 0) + 1

    lines = [f"Журнал фоновых задач (выборка): **{total}** записей.", ""]
    if by_status:
        lines.append("По статусам (в выборке):")
        for status, n in sorted(by_status.items(), key=lambda x: (-x[1], x[0])):
            lines.append(f"- {job_status_label_ru(status)}: {n}")
        lines.append("")

    if items:
        lines.append("Последние задачи:")
        for job in items[:5]:
            if not isinstance(job, dict):
                continue
            jt = job_type_label_ru(str(job.get("job_type") or ""))
            st = job_status_label_ru(str(job.get("status") or ""))
            pname = job.get("project_name") or "—"
            lines.append(f"- {jt} ({st}) — проект «{pname}»")

    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def format_admin_jobs_health(data: dict[str, Any]) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    redis_ok = bool(data.get("redis_ok"))
    by_status = data.get("jobs_by_status") or {}
    pending = int(by_status.get("pending") or 0)
    running = int(by_status.get("running") or 0)

    lines = [
        f"Redis: **{'OK' if redis_ok else 'ошибка'}**.",
    ]
    if not redis_ok and data.get("redis_error"):
        lines.append(f"Ошибка Redis: {data['redis_error']}")
    lines.append(f"В очереди: **{pending}**, выполняется: **{running}**.")
    if data.get("queue_name"):
        lines.append(f"Очередь: {data['queue_name']}.")
    lines.append("")
    lines.append(DATA_FOOTER)
    return "\n".join(lines)


def match_admin_jobs(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not wants_admin_jobs(messages, request):
        return None
    if tool_ok(tool_summaries, "admin_list_jobs"):
        data = cache.get("admin_list_jobs")
        if isinstance(data, dict):
            return format_admin_jobs_summary(data)
    return None


def match_admin_health(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not wants_admin_health(messages, request):
        return None
    if tool_ok(tool_summaries, "admin_jobs_health"):
        data = cache.get("admin_jobs_health")
        if isinstance(data, dict):
            return format_admin_jobs_health(data)
    return None
