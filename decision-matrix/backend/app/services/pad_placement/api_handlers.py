"""HTTP orchestration for pad placement BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import require_infra_write
from app.models import User
from app.schemas import ProjectJobCreateResponse
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.pad_placement.apply import PadPlacementApplyError, apply_variant
from app.services.pad_placement.compute import PadPlacementComputeError, build_request_preview, run_compute
from app.services.pad_placement.geojson_preview import build_variant_geojson
from app.services.pad_placement.result_cache import get
from app.services.pad_placement.schemas import (
    PadPlacementApplyRequest,
    PadPlacementApplyResponse,
    PadPlacementComputeRequest,
    PadPlacementComputeResponse,
    PadPlacementGeoJsonResponse,
    PadPlacementRequestResponse,
)
from app.services.project_jobs import (
    JOB_TYPE_PAD_PLACEMENT_APPLY,
    JOB_TYPE_PAD_PLACEMENT_COMPUTE,
    ActiveProjectJobError,
)


async def handle_request(
    project_id: UUID,
    data: PadPlacementComputeRequest,
    user: User,
    db: AsyncSession,
) -> PadPlacementRequestResponse:
    await require_infra_write(project_id, user, db)
    return await build_request_preview(db, project_id, data)


async def handle_compute(
    project_id: UUID,
    data: PadPlacementComputeRequest,
    user: User,
    db: AsyncSession,
    *,
    async_mode: bool = False,
) -> PadPlacementComputeResponse | JSONResponse:
    await require_infra_write(project_id, user, db)
    preview = await build_request_preview(db, project_id, data)
    if not preview.sync_allowed and not async_mode:
        raise HTTPException(
            status_code=400,
            detail="Selection too large for sync compute; retry with ?async=true",
        )
    if async_mode:
        if not jobs_async_enabled():
            raise HTTPException(
                status_code=400,
                detail="Async jobs disabled; reduce selection or enable ARQ worker",
            )
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_PAD_PLACEMENT_COMPUTE,
                payload={
                    "request_id": str(preview.request_id),
                    "compute_request": data.model_dump(mode="json"),
                },
            )
            await commit_and_schedule(db, job)
        except ActiveProjectJobError as e:
            raise HTTPException(status_code=409, detail=str(e)) from e
        return JSONResponse(
            status_code=202,
            content=ProjectJobCreateResponse(
                job_id=job.id,
                job_type=JOB_TYPE_PAD_PLACEMENT_COMPUTE,
                status="queued",
            ).model_dump(mode="json"),
        )

    try:
        return await run_compute(
            db,
            project_id,
            data,
            request_id=preview.request_id,
        )
    except PadPlacementComputeError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


async def handle_get_compute(
    project_id: UUID,
    request_id: UUID,
    user: User,
    db: AsyncSession,
) -> PadPlacementComputeResponse:
    await require_infra_write(project_id, user, db)
    entry = get(request_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Compute result not found or expired")
    return entry.response


async def handle_preview_geojson(
    project_id: UUID,
    request_id: UUID,
    variant_index: int,
    user: User,
    db: AsyncSession,
) -> PadPlacementGeoJsonResponse:
    await require_infra_write(project_id, user, db)
    entry = get(request_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Compute result not found or expired")
    variant = next(
        (v for v in entry.response.variants if v.variant_index == variant_index),
        None,
    )
    if variant is None and 0 <= variant_index < len(entry.response.variants):
        variant = entry.response.variants[variant_index]
    if variant is None:
        raise HTTPException(status_code=404, detail="Variant not found")
    return build_variant_geojson(variant)


async def handle_apply(
    project_id: UUID,
    data: PadPlacementApplyRequest,
    user: User,
    db: AsyncSession,
    *,
    async_mode: bool = False,
) -> PadPlacementApplyResponse | JSONResponse:
    await require_infra_write(project_id, user, db)
    entry = get(data.request_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Compute result not found or expired")
    variant = next(
        (v for v in entry.response.variants if v.variant_index == data.variant_index),
        None,
    )
    pad_count = variant.pad_count if variant else 0
    use_async = async_mode or pad_count > 2

    if use_async and jobs_async_enabled():
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_PAD_PLACEMENT_APPLY,
                payload={
                    "request_id": str(data.request_id),
                    "variant_index": data.variant_index,
                },
            )
            await commit_and_schedule(db, job)
        except ActiveProjectJobError as e:
            raise HTTPException(status_code=409, detail=str(e)) from e
        return JSONResponse(
            status_code=202,
            content=ProjectJobCreateResponse(
                job_id=job.id,
                job_type=JOB_TYPE_PAD_PLACEMENT_APPLY,
                status="queued",
            ).model_dump(mode="json"),
        )

    try:
        return await apply_variant(
            db,
            project_id,
            request_id=data.request_id,
            variant_index=data.variant_index,
        )
    except PadPlacementApplyError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
