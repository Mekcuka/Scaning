"""POI environment analysis API endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.project_deps import get_poi, get_user_project
from app.core.compute_rate_limit import ComputeRateLimitDep
from app.core.database import get_db
from app.models import User
from app.models.enums import AccessLevel
from app.schemas import ProjectJobCreateResponse
from app.services.infrastructure_analysis import run_poi_analysis, run_project_pois_analysis
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_jobs import JOB_TYPE_POI_ANALYZE_ALL, ActiveProjectJobError

analysis_router = APIRouter(tags=["analysis"])


@analysis_router.post("/projects/{project_id}/pois/analyze-all")
async def analyze_all_pois(
    project_id: UUID,
    _rate: ComputeRateLimitDep,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    if jobs_async_enabled():
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_POI_ANALYZE_ALL,
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

    payload = await run_project_pois_analysis(db, project_id)
    await db.commit()
    return payload


@analysis_router.post("/projects/{project_id}/pois/{poi_id}/analyze")
async def analyze_poi(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    poi = await get_poi(poi_id, project_id, db)
    result = await run_poi_analysis(db, project_id, poi)
    await db.commit()
    return result
