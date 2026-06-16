"""Realtime job event payloads — WebSocket + Redis pub/sub (contract §1.2)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.models import ProjectJob
from app.services.project_jobs import (
    JOB_STATUS_CANCELLED,
    JOB_STATUS_COMPLETED,
    JOB_STATUS_FAILED,
)

logger = logging.getLogger(__name__)

TERMINAL_JOB_STATUSES = frozenset(
    {JOB_STATUS_COMPLETED, JOB_STATUS_FAILED, JOB_STATUS_CANCELLED}
)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _build_result_summary(job_id: UUID) -> dict[str, int]:
    from app.core.database import async_session
    from app.services.job_steps import (
        STEP_STATUS_ERROR,
        STEP_STATUS_OK,
        STEP_STATUS_WARN,
        list_job_steps,
    )

    async with async_session() as db:
        steps = await list_job_steps(db, job_id)
    return {
        "steps_total": len(steps),
        "steps_ok": sum(1 for s in steps if s.status == STEP_STATUS_OK),
        "steps_warn": sum(1 for s in steps if s.status == STEP_STATUS_WARN),
        "steps_error": sum(1 for s in steps if s.status == STEP_STATUS_ERROR),
    }


async def notify_job_status_changed(job: ProjectJob, *, previous_status: str | None) -> None:
    from app.services.job_events import publish_job_event

    try:
        await publish_job_event(
            job.project_id,
            {
                "type": "job.status_changed",
                "job_id": str(job.id),
                "project_id": str(job.project_id),
                "timestamp": _utcnow_iso(),
                "status": job.status,
                "previous_status": previous_status,
                "progress": job.progress if job.progress is not None else 0.0,
            },
        )
        if job.status in TERMINAL_JOB_STATUSES:
            await notify_job_result(job)
    except Exception:
        logger.debug("notify_job_status_changed failed", exc_info=True)


async def notify_job_progress(job: ProjectJob) -> None:
    if job.progress is None:
        return
    from app.services.job_events import publish_job_event

    try:
        await publish_job_event(
            job.project_id,
            {
                "type": "job.progress",
                "job_id": str(job.id),
                "project_id": str(job.project_id),
                "timestamp": _utcnow_iso(),
                "progress": job.progress,
            },
        )
    except Exception:
        logger.debug("notify_job_progress failed", exc_info=True)


async def notify_job_result(job: ProjectJob) -> None:
    from app.services.job_events import publish_job_event

    try:
        summary = await _build_result_summary(job.id)
        progress = job.progress
        if progress is None and job.status == JOB_STATUS_COMPLETED:
            progress = 1.0
        elif progress is None:
            progress = 0.0
        await publish_job_event(
            job.project_id,
            {
                "type": "job.result",
                "job_id": str(job.id),
                "project_id": str(job.project_id),
                "timestamp": _utcnow_iso(),
                "status": job.status,
                "progress": progress,
                "result_summary": summary,
                "error_message": job.error_message,
            },
        )
    except Exception:
        logger.debug("notify_job_result failed", exc_info=True)
