"""Execute project jobs (ARQ worker and sync fallback)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import async_session
from app.models import ImportLog, ProjectJob
from app.services.job_step_defs import JOB_STEPS
from app.services.job_steps import (
    STEP_STATUS_OK,
    append_job_step,
    update_job_progress,
    update_job_step,
)
from app.services.project_jobs import (
    JOB_STATUS_PENDING,
    JOB_STATUS_RUNNING,
    JOB_TYPE_AUTOROAD_CONNECT,
    JOB_TYPE_IMPORT_FILE,
    JOB_TYPE_PAD_EARTHWORK_COMPUTE,
    JOB_TYPE_POI_ANALYZE_ALL,
    JOB_TYPE_SAND_LOGISTICS_ANALYZE,
    JOB_TYPE_WELL_TRAJECTORY_COMPUTE,
    JOB_TYPE_WELL_TRAJECTORY_IMPORT,
    JOB_TYPE_PAD_PLACEMENT_COMPUTE,
    JOB_TYPE_PAD_PLACEMENT_APPLY,
    mark_job_completed,
    mark_job_failed,
    mark_job_running,
)

logger = logging.getLogger(__name__)


class StepContext:
    """Records a single job step: creates a 'running' row on enter, finalizes on exit.

    Steps use a short separate DB session (see job_steps.append_job_step) so they
    survive rollback and are visible to the WebSocket layer immediately.
    """

    def __init__(self, job: ProjectJob, seq: int, step_code: str, title: str) -> None:
        self.job = job
        self.seq = seq
        self.step_code = step_code
        self.title = title
        self.step_id: UUID | None = None

    async def __aenter__(self) -> "StepContext":
        step = await append_job_step(
            self.job.id,
            self.job.project_id,
            seq=self.seq,
            step_code=self.step_code,
            title=self.title,
        )
        self.step_id = step.id
        return self

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        if self.step_id is None:
            return False
        if exc is None:
            await update_job_step(self.step_id, status=STEP_STATUS_OK)
        # On exception: do not mark step as 'error' here — let it propagate so
        # the outer execute_project_job marks the whole job failed. The step
        # remains 'running', which is acceptable: the job is failed anyway.
        return False

    async def update_progress(self, db: AsyncSession) -> float | None:
        """Recalculate job.progress after this step completes."""
        return await update_job_progress(db, self.job)


async def _acquire_project_advisory_lock(db: AsyncSession, project_id: UUID) -> None:
    if settings.is_sqlite:
        return
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:pid))"),
        {"pid": str(project_id)},
    )


async def _run_autoroad_connect(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.services.autoroad_connect import run_autoroad_connect
    from app.services.autoroad_network.pipeline import apply_network_plan_response
    from app.services.autoroad_network.schemas import NetworkPlanResponse

    object_ids = [UUID(x) for x in job.payload.get("object_ids", [])]
    full_rebuild = bool(job.payload.get("full_network_rebuild", True))
    raw_plan = job.payload.get("plan")
    if raw_plan:
        resp = NetworkPlanResponse.model_validate(raw_plan)
        return await apply_network_plan_response(
            db,
            job.project_id,
            resp,
            object_ids,
            full_network_rebuild=full_rebuild,
        )
    return await run_autoroad_connect(
        db,
        job.project_id,
        object_ids,
        dry_run=False,
        full_network_rebuild=full_rebuild,
    )


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


async def _run_pad_earthwork_compute(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from uuid import UUID

    from app.api.v1.map_deps import get_infra_object
    from app.services.pad_earthwork.schemas import PadEarthworkComputeRequest
    from app.services.pad_earthwork.service import (
        compute_pad_earthwork_for_object,
        persist_dem_properties_for_compute,
    )

    object_id = UUID(job.payload["object_id"])
    obj = await get_infra_object(object_id, job.project_id, db)
    body = PadEarthworkComputeRequest.model_validate(
        {k: v for k, v in (job.payload or {}).items() if k != "object_id"}
    )
    dem_patch = await persist_dem_properties_for_compute(db, job.project_id, obj, body)
    if dem_patch:
        props = dict(obj.properties or {})
        props.update(dem_patch)
        obj.properties = props
        await db.flush()
    result, props = await compute_pad_earthwork_for_object(
        db,
        obj,
        body,
        project_id=job.project_id,
    )
    obj.properties = props
    await db.flush()
    return result.model_dump(mode="json")


async def _run_well_trajectory_compute(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from uuid import UUID

    from app.services.well_trajectory.clearance_service import (
        fetch_project_pads,
        run_clearance_for_pad,
        run_clearance_for_project,
    )

    raw_object_id = (job.payload or {}).get("object_id")
    if raw_object_id:
        pad_id = UUID(str(raw_object_id))
        result = await run_clearance_for_pad(db, job.project_id, pad_id)
        pad = next((p for p in await fetch_project_pads(db, job.project_id) if p.id == pad_id), None)
        if pad is not None:
            await db.flush()
    else:
        pads = await fetch_project_pads(db, job.project_id)
        result = await run_clearance_for_project(db, job.project_id)
        await db.flush()
    return result.model_dump(mode="json")


async def _run_well_trajectory_import(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    import base64

    from app.api.v1.map_deps import get_infra_object
    from app.services.well_trajectory.import_service import ImportOptions, commit_import
    from app.services.well_trajectory.trajectory_store import (
        store_clearance_results,
        store_computed_at,
        store_trajectories_json,
    )

    pad_id = UUID(job.payload["pad_id"])
    fmt = str(job.payload.get("format", "csv"))
    raw_options = job.payload.get("options") or {}
    options = ImportOptions(
        step_m=raw_options.get("step_m"),
        interpolate=bool(raw_options.get("interpolate", True)),
        match_mode=raw_options.get("match_mode") or "name",
    )
    content_b64 = job.payload.get("content_b64", "")
    file_bytes = base64.b64decode(content_b64.encode("ascii"))
    content: bytes | str = (
        file_bytes.decode("utf-8", errors="replace") if fmt == "csv" else file_bytes
    )

    obj = await get_infra_object(pad_id, job.project_id, db)
    result = commit_import(obj, format=fmt, content=content, options=options)  # type: ignore[arg-type]
    props = store_trajectories_json(obj.properties, result.trajectories)
    props = store_computed_at(props)
    props = store_clearance_results(props, pairs=[], computed_at=result.computed_at)
    obj.properties = props
    await db.flush()
    return {
        "imported_count": result.imported_count,
        "computed_at": result.computed_at,
        "warnings": result.warnings,
    }


async def _run_pad_placement_compute(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.services.pad_placement.compute import run_compute
    from app.services.pad_placement.schemas import PadPlacementComputeRequest

    payload = job.payload or {}
    request_id = UUID(str(payload["request_id"]))
    body = PadPlacementComputeRequest.model_validate(payload["compute_request"])
    outcome = await run_compute(db, job.project_id, body, request_id=request_id)
    return outcome_to_job_result(outcome)


async def _run_pad_placement_apply(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    from app.services.pad_placement.apply import apply_variant

    payload = job.payload or {}
    result = await apply_variant(
        db,
        job.project_id,
        request_id=UUID(str(payload["request_id"])),
        variant_index=int(payload["variant_index"]),
    )
    return result.model_dump(mode="json")


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

            result = await _execute_job_body(db, job)

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


async def _execute_job_body(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    """Dispatch to the type-specific runner, recording coarse-grained steps.

    Each _run_* is wrapped in a single high-level step. This gives meaningful
    progress (0/1 → 1/1 = 100% for single-phase jobs) without threading a
    callback into every service. The service can later be instrumented with
    finer steps by inserting append_job_step calls inside it.
    """
    steps_def = JOB_STEPS.get(job.job_type, [("run", "Выполнение расчёта")])
    total = len(steps_def)

    if total == 1:
        # Single-step job: record one running step around the whole run.
        code, title = steps_def[0]
        async with StepContext(job, seq=1, step_code=code, title=title):
            return await _dispatch_run(db, job)

    # Multi-step job: for v1 we record one summary step covering all internal
    # work (the service APIs don't expose phase boundaries yet). Each phase is
    # recorded as a separate row so the UI can show the plan; transitions to
    # 'ok' happen as a batch at the end.
    recorded_ids: list[UUID] = []
    for seq, (code, title) in enumerate(steps_def, start=1):
        step = await append_job_step(
            job.id,
            job.project_id,
            seq=seq,
            step_code=code,
            title=title,
            status="pending" if seq > 1 else "running",
        )
        recorded_ids.append(step.id)

    try:
        result = await _dispatch_run(db, job)
    except Exception:
        # Mark the first still-pending/running step as error for visibility.
        from app.services.job_steps import STEP_STATUS_ERROR, update_job_step

        for sid in recorded_ids:
            await update_job_step(sid, status=STEP_STATUS_ERROR, error_message="Шаг не завершён")
        raise

    # Mark all steps ok and recalc progress
    from app.services.job_steps import STEP_STATUS_OK, update_job_step

    for sid in recorded_ids:
        await update_job_step(sid, status=STEP_STATUS_OK)
    await update_job_progress(db, job)
    await db.flush()
    return result


async def _dispatch_run(db: AsyncSession, job: ProjectJob) -> dict[str, Any]:
    if job.job_type == JOB_TYPE_AUTOROAD_CONNECT:
        return await _run_autoroad_connect(db, job)
    elif job.job_type == JOB_TYPE_IMPORT_FILE:
        return await _run_import_file(db, job)
    elif job.job_type == JOB_TYPE_SAND_LOGISTICS_ANALYZE:
        return await _run_sand_logistics(db, job)
    elif job.job_type == JOB_TYPE_POI_ANALYZE_ALL:
        return await _run_poi_analyze_all(db, job)
    elif job.job_type == JOB_TYPE_PAD_EARTHWORK_COMPUTE:
        return await _run_pad_earthwork_compute(db, job)
    elif job.job_type == JOB_TYPE_WELL_TRAJECTORY_COMPUTE:
        return await _run_well_trajectory_compute(db, job)
    elif job.job_type == JOB_TYPE_WELL_TRAJECTORY_IMPORT:
        return await _run_well_trajectory_import(db, job)
    elif job.job_type == JOB_TYPE_PAD_PLACEMENT_COMPUTE:
        return await _run_pad_placement_compute(db, job)
    elif job.job_type == JOB_TYPE_PAD_PLACEMENT_APPLY:
        return await _run_pad_placement_apply(db, job)
    raise ValueError(f"Unsupported job_type: {job.job_type}")
