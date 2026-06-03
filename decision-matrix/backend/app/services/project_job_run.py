"""Execute project jobs (ARQ worker and sync fallback)."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models import ImportLog, ProjectJob
from app.services.project_jobs import (
    JOB_STATUS_PENDING,
    JOB_STATUS_RUNNING,
    JOB_TYPE_AUTOROAD_CONNECT,
    JOB_TYPE_IMPORT_FILE,
    JOB_TYPE_POI_ANALYZE_ALL,
    JOB_TYPE_SAND_LOGISTICS_ANALYZE,
    mark_job_completed,
    mark_job_failed,
    mark_job_running,
)

logger = logging.getLogger(__name__)


async def _acquire_project_advisory_lock(db: AsyncSession, project_id: UUID) -> None:
    if settings.is_sqlite:
        return
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:pid))"),
        {"pid": str(project_id)},
    )


async def _run_autoroad_connect(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.services.autoroad_connect import run_autoroad_connect

    object_ids = [UUID(x) for x in job.payload.get("object_ids", [])]
    return await run_autoroad_connect(db, job.project_id, object_ids, dry_run=False)


async def _run_import_file(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.services.import_service import process_import_log

    log_id = UUID(job.payload["log_id"])
    layer_id = UUID(job.payload["layer_id"])
    content = job.payload.get("content", "")
    fmt = job.payload.get("format", "csv")
    await process_import_log(log_id, layer_id=layer_id, content=content, format=fmt)
    async with async_session() as read_db:
        log = await read_db.get(ImportLog, log_id)
    return {
        "log_id": str(log_id),
        "status": log.status if log else "unknown",
        "records_imported": log.records_imported if log else 0,
        "errors": log.errors if log else [],
    }


async def _run_sand_logistics(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.schemas import SandLogisticsAnalyzeRequest
    from app.services.sand_logistics import analyze_sand_logistics
    from app.services.sand_logistics_store import upsert_sand_logistics_result

    raw = job.payload or {}
    req = SandLogisticsAnalyzeRequest.model_validate(raw) if raw else SandLogisticsAnalyzeRequest()
    result = await analyze_sand_logistics(
        db,
        job.project_id,
        rebuild_network=req.rebuild_network,
        as_of=req.as_of,
        horizon_from=req.horizon_from,
        horizon_to=req.horizon_to,
    )
    row = await upsert_sand_logistics_result(db, job.project_id, result, user_id=job.user_id)
    return {"stored": True, "as_of": str(row.as_of) if row.as_of else None}


async def _run_poi_analyze_all(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.services.infrastructure_analysis import run_project_pois_analysis

    return await run_project_pois_analysis(db, job.project_id)


async def execute_project_job(job_id: UUID) -> None:
    async with async_session() as db:
        job = await db.get(ProjectJob, job_id)
        if not job:
            logger.warning("Job %s not found", job_id)
            return
        if job.status not in (JOB_STATUS_PENDING, JOB_STATUS_RUNNING):
            return
        try:
            await _acquire_project_advisory_lock(db, job.project_id)
            job = await db.get(ProjectJob, job_id)
            if not job or job.status not in (JOB_STATUS_PENDING, JOB_STATUS_RUNNING):
                return
            if job.status == JOB_STATUS_PENDING:
                await mark_job_running(db, job)
                await db.flush()

            if job.job_type == JOB_TYPE_AUTOROAD_CONNECT:
                result = await _run_autoroad_connect(db, job)
            elif job.job_type == JOB_TYPE_IMPORT_FILE:
                result = await _run_import_file(db, job)
            elif job.job_type == JOB_TYPE_SAND_LOGISTICS_ANALYZE:
                result = await _run_sand_logistics(db, job)
            elif job.job_type == JOB_TYPE_POI_ANALYZE_ALL:
                result = await _run_poi_analyze_all(db, job)
            else:
                raise ValueError(f"Unsupported job_type: {job.job_type}")

            job = await db.get(ProjectJob, job_id)
            if job and job.status == JOB_STATUS_RUNNING:
                await mark_job_completed(db, job, result)
            await db.commit()
        except Exception as e:
            logger.exception("Job %s failed", job_id)
            await db.rollback()
            async with async_session() as db2:
                job = await db2.get(ProjectJob, job_id)
                if job and job.status == JOB_STATUS_RUNNING:
                    await mark_job_failed(db2, job, str(e))
                    await db2.commit()
