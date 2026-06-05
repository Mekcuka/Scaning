"""BFF for autoroad network planning (JSON pipeline + DB apply)."""

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
from app.services.autoroad_network.pipeline import (
    apply_network_plan_response,
    build_request_snapshot,
    compute_plan,
    preview_legacy_dict,
)
from app.services.autoroad_network.planner_adapter import get_solver_status, get_solver_status_http
from app.services.autoroad_network.schemas import (
    AutoroadNetworkApplyBody,
    AutoroadNetworkApplyResult,
    AutoroadNetworkBuildRequestBody,
    AutoroadNetworkPlanBody,
    NetworkPlanRequest,
    NetworkPlanResponse,
    SolverStatusResponse,
)
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_jobs import JOB_TYPE_AUTOROAD_CONNECT, ActiveProjectJobError

autoroad_network_router = APIRouter(tags=["autoroad-network"])


@autoroad_network_router.get(
    "/autoroad-network/solver-status",
    response_model=SolverStatusResponse,
)
async def autoroad_network_solver_status(
    user: User = Depends(get_current_user),
):
    """Report SteinerPy / GeoSteiner availability for the planner UI."""
    from app.core.config import settings

    if settings.AUTOROAD_NETWORK_INPROCESS:
        return get_solver_status()
    return await get_solver_status_http()


@autoroad_network_router.post(
    "/projects/{project_id}/autoroad-network/request",
    response_model=NetworkPlanRequest,
)
async def autoroad_network_build_request(
    project_id: UUID,
    data: AutoroadNetworkBuildRequestBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Build input JSON (terminals + existing roads) from the project database."""
    await _require_infra_write(project_id, user, db)
    try:
        return await build_request_snapshot(
            db,
            project_id,
            data.object_ids,
            full_network_rebuild=data.full_network_rebuild,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@autoroad_network_router.post(
    "/projects/{project_id}/autoroad-network/compute",
    response_model=NetworkPlanResponse,
)
async def autoroad_network_compute(
    project_id: UUID,
    data: NetworkPlanRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run planner on input JSON; returns solution JSON only (no DB writes)."""
    await _require_infra_write(project_id, user, db)
    if data.project_id != project_id:
        data = data.model_copy(update={"project_id": project_id})
    return await compute_plan(data)


@autoroad_network_router.post("/projects/{project_id}/autoroad-network/apply")
async def autoroad_network_apply_plan(
    project_id: UUID,
    data: AutoroadNetworkApplyBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a precomputed plan JSON to the project (no recomputation)."""
    await _require_infra_write(project_id, user, db)

    try:
        if jobs_async_enabled():
            try:
                job = await create_and_schedule_job(
                    db,
                    project_id=project_id,
                    user_id=user.id,
                    job_type=JOB_TYPE_AUTOROAD_CONNECT,
                    payload={
                        "object_ids": [str(i) for i in data.object_ids],
                        "full_network_rebuild": data.full_network_rebuild,
                        "plan": data.plan.model_dump(mode="json"),
                    },
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

        result = await apply_network_plan_response(
            db,
            project_id,
            data.plan,
            data.object_ids,
            full_network_rebuild=data.full_network_rebuild,
        )
        await db.commit()
        return AutoroadNetworkApplyResult(
            plan=data.plan,
            created_node_ids=result["created_node_ids"],
            created_line_ids=result["created_line_ids"],
            created_nodes=result["created_nodes"],
            created_lines=result["created_lines"],
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@autoroad_network_router.post(
    "/projects/{project_id}/autoroad-network/plan",
    response_model=AutoroadConnectResponse,
    deprecated=True,
    summary="[deprecated] Use request + compute",
)
async def autoroad_network_plan(
    project_id: UUID,
    data: AutoroadNetworkPlanBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Legacy preview: request → compute → AutoroadConnectResponse."""
    await _require_infra_write(project_id, user, db)
    try:
        out = await preview_legacy_dict(
            db,
            project_id,
            data.object_ids,
            full_network_rebuild=data.full_network_rebuild,
        )
        return AutoroadConnectResponse(**out)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@autoroad_network_router.post(
    "/projects/{project_id}/autoroad-network/apply-legacy",
    response_model=AutoroadConnectResponse,
    deprecated=True,
    summary="[deprecated] Use apply with plan JSON",
)
async def autoroad_network_apply_legacy(
    project_id: UUID,
    data: AutoroadNetworkPlanBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Legacy apply by object_ids only (recomputes plan). Kept for compatibility."""
    from app.services.autoroad_connect import run_autoroad_connect

    await _require_infra_write(project_id, user, db)
    try:
        if jobs_async_enabled() and not data.dry_run:
            try:
                job = await create_and_schedule_job(
                    db,
                    project_id=project_id,
                    user_id=user.id,
                    job_type=JOB_TYPE_AUTOROAD_CONNECT,
                    payload={
                        "object_ids": [str(i) for i in data.object_ids],
                        "full_network_rebuild": data.full_network_rebuild,
                    },
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
            full_network_rebuild=data.full_network_rebuild,
        )
        if not data.dry_run:
            await db.commit()
        return AutoroadConnectResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
