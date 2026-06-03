"""BFF for autoroad network planning (wraps planner service + DB apply)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map import _require_infra_write
from app.core.database import get_db
from app.models import User
from app.schemas import AutoroadConnectResponse, ProjectJobCreateResponse
from app.services.autoroad_connect import apply_autoroad_connect_plan, build_autoroad_connect_plan
from app.services.autoroad_network.schemas import AutoroadNetworkPlanBody
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_jobs import JOB_TYPE_AUTOROAD_CONNECT, ActiveProjectJobError

autoroad_network_router = APIRouter(tags=["autoroad-network"])


async def _run_plan(db: AsyncSession, project_id: UUID, object_ids: list[UUID]):
    plan = await build_autoroad_connect_plan(db, project_id, object_ids)
    return plan


@autoroad_network_router.post(
    "/projects/{project_id}/autoroad-network/plan",
    response_model=AutoroadConnectResponse,
)
async def autoroad_network_plan(
    project_id: UUID,
    data: AutoroadNetworkPlanBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_infra_write(project_id, user, db)
    plan = await _run_plan(db, project_id, data.object_ids)
    out = plan.to_response_dict()
    out["dry_run"] = True
    return AutoroadConnectResponse(**out)


@autoroad_network_router.post("/projects/{project_id}/autoroad-network/apply")
async def autoroad_network_apply(
    project_id: UUID,
    data: AutoroadNetworkPlanBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_infra_write(project_id, user, db)
    from app.services.autoroad_connect import run_autoroad_connect

    try:
        if jobs_async_enabled() and not data.dry_run:
            try:
                job = await create_and_schedule_job(
                    db,
                    project_id=project_id,
                    user_id=user.id,
                    job_type=JOB_TYPE_AUTOROAD_CONNECT,
                    payload={"object_ids": [str(i) for i in data.object_ids]},
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
            body = ProjectJobCreateResponse(
                job_id=job.id,
                job_type=job.job_type,
                status=job.status,
            )
            return JSONResponse(status_code=202, content=body.model_dump(mode="json"))

        result = await run_autoroad_connect(
            db,
            project_id,
            data.object_ids,
            dry_run=data.dry_run,
        )
        if not data.dry_run:
            await db.commit()
        return AutoroadConnectResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
