"""Calculation journal — step-by-step progress for background jobs.

Steps are written in short separate sessions (not the main job session) so they
survive rollback and are immediately visible to the realtime UI.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session
from app.models import ProjectJob, ProjectJobStep

logger = logging.getLogger(__name__)

STEP_STATUS_PENDING = "pending"
STEP_STATUS_RUNNING = "running"
STEP_STATUS_OK = "ok"
STEP_STATUS_WARN = "warn"
STEP_STATUS_ERROR = "error"
STEP_STATUS_SKIPPED = "skipped"

ALLOWED_STEP_STATUSES = frozenset(
    {
        STEP_STATUS_PENDING,
        STEP_STATUS_RUNNING,
        STEP_STATUS_OK,
        STEP_STATUS_WARN,
        STEP_STATUS_ERROR,
        STEP_STATUS_SKIPPED,
    }
)

TERMINAL_STEP_STATUSES = frozenset(
    {STEP_STATUS_OK, STEP_STATUS_WARN, STEP_STATUS_ERROR, STEP_STATUS_SKIPPED}
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _duration_ms(started_at: datetime | None, finished_at: datetime | None) -> int | None:
    if not started_at or not finished_at:
        return None
    start = started_at.replace(tzinfo=timezone.utc) if started_at.tzinfo is None else started_at
    end = finished_at.replace(tzinfo=timezone.utc) if finished_at.tzinfo is None else finished_at
    return int((end - start).total_seconds() * 1000)


async def append_job_step(
    job_id: UUID,
    project_id: UUID,
    *,
    seq: int,
    step_code: str,
    title: str,
    status: str = STEP_STATUS_RUNNING,
    detail: dict[str, Any] | None = None,
    error_message: str | None = None,
) -> ProjectJobStep:
    """Create a new step row in a short separate session + publish event.

    The step is committed immediately (not in the main job transaction) so it
    is visible to the WebSocket layer even before the job finishes.
    """
    now = _utcnow()
    started = now if status == STEP_STATUS_RUNNING else None
    finished = now if status in TERMINAL_STEP_STATUSES else None

    async with async_session() as db:
        step = ProjectJobStep(
            job_id=job_id,
            project_id=project_id,
            seq=seq,
            step_code=step_code,
            title=title,
            status=status,
            started_at=started,
            finished_at=finished,
            duration_ms=_duration_ms(started, finished),
            detail=detail,
            error_message=error_message,
        )
        db.add(step)
        await db.commit()
        await db.refresh(step)

    try:
        from app.services.job_events import publish_job_event

        await publish_job_event(
            project_id,
            {
                "type": "job.step_added",
                "job_id": str(job_id),
                "project_id": str(project_id),
                "timestamp": now.isoformat(),
                "step": _step_to_dict(step),
            },
        )
    except Exception:
        logger.debug("job_events.publish not available (dev mode?)", exc_info=True)

    await _sync_job_progress_after_step(step)
    return step


async def _sync_job_progress_after_step(step: ProjectJobStep) -> None:
    """Recalculate job.progress in a short session and publish job.progress event."""
    async with async_session() as db:
        job = await db.get(ProjectJob, step.job_id)
        if job is None:
            return
        await update_job_progress(db, job)
        await db.commit()


async def update_job_step(
    step_id: UUID,
    *,
    status: str,
    detail: dict[str, Any] | None = None,
    error_message: str | None = None,
) -> ProjectJobStep | None:
    """Transition a step to a terminal/running status + publish event."""
    async with async_session() as db:
        step = await db.get(ProjectJobStep, step_id)
        if step is None:
            return None
        now = _utcnow()
        step.status = status
        if status == STEP_STATUS_RUNNING and step.started_at is None:
            step.started_at = now
        if status in TERMINAL_STEP_STATUSES:
            step.finished_at = now
            step.duration_ms = _duration_ms(step.started_at, now)
        if detail is not None:
            step.detail = detail
        if error_message is not None:
            step.error_message = error_message[:4000]
        await db.commit()
        await db.refresh(step)

    try:
        from app.services.job_events import publish_job_event

        await publish_job_event(
            step.project_id,
            {
                "type": "job.step_updated",
                "job_id": str(step.job_id),
                "project_id": str(step.project_id),
                "timestamp": now.isoformat(),
                "step": _step_to_dict(step),
            },
        )
    except Exception:
        logger.debug("job_events.publish not available (dev mode?)", exc_info=True)

    await _sync_job_progress_after_step(step)
    return step


async def update_job_progress(db: AsyncSession, job: ProjectJob) -> float | None:
    """Recalculate job.progress from step statuses. Returns new progress or None."""
    total = int(
        await db.scalar(
            select(func.count())
            .select_from(ProjectJobStep)
            .where(ProjectJobStep.job_id == job.id)
        )
        or 0
    )
    if total == 0:
        return None
    completed = int(
        await db.scalar(
            select(func.count())
            .select_from(ProjectJobStep)
            .where(
                ProjectJobStep.job_id == job.id,
                ProjectJobStep.status.in_(TERMINAL_STEP_STATUSES),
            )
        )
        or 0
    )
    progress = round(completed / total, 4)
    job.progress = progress
    await db.flush()
    from app.services.job_realtime_events import notify_job_progress

    await notify_job_progress(job)
    return progress


async def list_job_steps(
    db: AsyncSession,
    job_id: UUID,
) -> list[ProjectJobStep]:
    rows = (
        await db.execute(
            select(ProjectJobStep)
            .where(ProjectJobStep.job_id == job_id)
            .order_by(ProjectJobStep.seq)
        )
    ).scalars().all()
    return list(rows)


async def get_job_step(db: AsyncSession, step_id: UUID) -> ProjectJobStep | None:
    return await db.get(ProjectJobStep, step_id)


async def get_step_counts(db: AsyncSession, job_id: UUID) -> tuple[int, int]:
    """Return (total_steps, completed_steps)."""
    total = int(
        await db.scalar(
            select(func.count())
            .select_from(ProjectJobStep)
            .where(ProjectJobStep.job_id == job_id)
        )
        or 0
    )
    completed = int(
        await db.scalar(
            select(func.count())
            .select_from(ProjectJobStep)
            .where(
                ProjectJobStep.job_id == job_id,
                ProjectJobStep.status.in_(TERMINAL_STEP_STATUSES),
            )
        )
        or 0
    )
    return total, completed


def _step_to_dict(step: ProjectJobStep) -> dict[str, Any]:
    return {
        "id": str(step.id),
        "seq": step.seq,
        "step_code": step.step_code,
        "title": step.title,
        "status": step.status,
        "started_at": step.started_at.isoformat() if step.started_at else None,
        "finished_at": step.finished_at.isoformat() if step.finished_at else None,
        "duration_ms": step.duration_ms,
        "detail": step.detail,
        "error_message": step.error_message,
    }
