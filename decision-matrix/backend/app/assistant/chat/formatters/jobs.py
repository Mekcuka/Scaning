"""Formatters for project background jobs."""

from __future__ import annotations

from typing import Any

from app.assistant.chat.formatters._common import DATA_FOOTER, JOB_LIST_LIMIT, last_user_text
from app.assistant.chat.job_labels import job_status_label_ru, job_type_label_ru
from app.assistant.chat.schemas import ChatMessage, ChatRequest, ToolCallSummary

_JOB_HINTS = ("задач", "job", "фонов", "выполня", "статус", "журнал")


def wants_job_summary(messages: list[ChatMessage], request: ChatRequest) -> bool:
    return any(h in last_user_text(messages) for h in _JOB_HINTS)


def format_job_summary(
    data: dict[str, Any],
    *,
    project_name: str | None = None,
) -> str:
    if data.get("formatted_summary_ru"):
        return str(data["formatted_summary_ru"])

    if data.get("active") is False:
        if project_name:
            return f"В проекте «{project_name}» активных фоновых задач нет.\n\n{DATA_FOOTER}"
        return f"Активных фоновых задач нет.\n\n{DATA_FOOTER}"

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
            for job in items[:JOB_LIST_LIMIT]:
                if isinstance(job, dict):
                    lines.extend(_format_single_job(job))
            if total > JOB_LIST_LIMIT:
                lines.append(f"… всего записей: {total}.")
        lines.append("")
        lines.append(DATA_FOOTER)
        return "\n".join(lines)

    if isinstance(data, dict) and data.get("job_type"):
        if project_name:
            lines = [f"Активная фоновая задача в проекте «{project_name}»:"]
        else:
            lines = ["Активная фоновая задача:"]
        lines.append("")
        lines.extend(_format_single_job(data))
        lines.append("")
        lines.append(DATA_FOOTER)
        return "\n".join(lines)

    return ""


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


def match_jobs(
    tool_summaries: list[ToolCallSummary],
    cache: dict[str, Any],
    messages: list[ChatMessage],
    request: ChatRequest,
) -> str | None:
    if not wants_job_summary(messages, request):
        return None
    from app.assistant.chat.formatters._common import tool_ok

    if tool_ok(tool_summaries, "get_project_job"):
        data = cache.get("get_project_job")
        if isinstance(data, dict):
            text = format_job_summary(data, project_name=request.project_name)
            if text:
                return text
    if tool_ok(tool_summaries, "list_project_jobs"):
        data = cache.get("list_project_jobs")
        if isinstance(data, dict):
            text = format_job_summary(data, project_name=request.project_name)
            if text:
                return text
    return None
