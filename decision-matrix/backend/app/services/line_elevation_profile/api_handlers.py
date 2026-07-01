"""HTTP handlers for line elevation profile."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_infra_object, require_infra_write
from app.schemas import ProjectJobCreateResponse
from app.services.job_enqueue import (
    commit_and_schedule,
    create_and_schedule_job,
    jobs_async_enabled,
    run_project_job_inline,
)
from app.services.project_jobs import JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE, ActiveProjectJobError
from app.geo.constants import LINE_SUBTYPES
from app.models import InfrastructureObject, User
from app.models.enums import AccessLevel, WriteScope
from app.services.line_elevation_profile.profile_compute import compute_line_elevation_profiles, profile_from_properties
from app.services.line_elevation_profile.properties import PROFILE_LINE_EXCLUDE_SUBTYPE
from app.services.line_elevation_profile.schemas import (
    LineElevationProfileComputeOut,
    LineElevationProfileOut,
    LineProfilePointOut,
)
from app.services.project_access import resolve_project


async def handle_compute(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> LineElevationProfileComputeOut | JSONResponse:
    await require_infra_write(project_id, user, db)
    if jobs_async_enabled():
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE,
                payload={},
            )
            await commit_and_schedule(db, job)
        except ActiveProjectJobError as e:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Project already has an active job",
                    "active_job_id": str(e.active_job_id),
                },
            ) from e
        resp = ProjectJobCreateResponse(job_id=job.id, job_type=job.job_type, status=job.status)
        return JSONResponse(status_code=202, content=resp.model_dump(mode="json"))

    return await run_project_job_inline(
        db,
        project_id=project_id,
        user_id=user.id,
        job_type=JOB_TYPE_LINE_ELEVATION_PROFILE_COMPUTE,
        payload={},
        runner=lambda: compute_line_elevation_profiles(db, project_id),
    )


async def handle_get_profile(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> LineElevationProfileOut:
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    obj = await get_infra_object(object_id, project_id, db)
    if obj.subtype not in LINE_SUBTYPES or obj.subtype == PROFILE_LINE_EXCLUDE_SUBTYPE:
        raise HTTPException(status_code=404, detail="line_elevation_profile_not_found")
    profile = profile_from_properties(obj.properties)
    if not profile or not profile.get("points"):
        raise HTTPException(status_code=404, detail="line_elevation_profile_not_found")
    computed_raw = profile.get("computed_at") or (obj.properties or {}).get("line_elevation_profile_computed_at")
    if not isinstance(computed_raw, str):
        raise HTTPException(status_code=404, detail="line_elevation_profile_not_found")
    try:
        computed_at = datetime.fromisoformat(computed_raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="line_elevation_profile_not_found") from exc
    points_raw = profile.get("points") or []
    points: list[LineProfilePointOut] = []
    for pt in points_raw:
        if not isinstance(pt, dict):
            continue
        try:
            points.append(
                LineProfilePointOut(
                    chainage_m=float(pt["chainage_m"]),
                    lon=float(pt["lon"]),
                    lat=float(pt["lat"]),
                    elevation_m=float(pt["elevation_m"]),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    if not points:
        raise HTTPException(status_code=404, detail="line_elevation_profile_not_found")
    return LineElevationProfileOut(
        step_m=float(profile.get("step_m") or 100),
        computed_at=computed_at,
        dem_source=str(profile.get("dem_source") or ""),
        total_length_m=float(profile.get("total_length_m") or 0),
        points=points,
    )
