"""HTTP orchestration for autoroad network BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import require_infra_write
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


async def handle_solver_status() -> SolverStatusResponse:
    from app.core.config import settings

    if settings.AUTOROAD_NETWORK_INPROCESS:
        return get_solver_status()
    return await get_solver_status_http()


async def handle_build_request(
    project_id: UUID,
    data: AutoroadNetworkBuildRequestBody,
    user: User,
    db: AsyncSession,
) -> NetworkPlanRequest:
    await require_infra_write(project_id, user, db)
    try:
        return await build_request_snapshot(
            db,
            project_id,
            data.object_ids,
            full_network_rebuild=data.full_network_rebuild,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


async def handle_compute(
    project_id: UUID,
    data: NetworkPlanRequest,
    user: User,
    db: AsyncSession,
) -> NetworkPlanResponse:
    await require_infra_write(project_id, user, db)
    if data.project_id != project_id:
        data = data.model_copy(update={"project_id": project_id})
    return await compute_plan(data)


async def handle_apply_plan(
    project_id: UUID,
    data: AutoroadNetworkApplyBody,
    user: User,
    db: AsyncSession,
) -> AutoroadNetworkApplyResult | JSONResponse:
    await require_infra_write(project_id, user, db)
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


async def handle_plan_legacy(
    project_id: UUID,
    data: AutoroadNetworkPlanBody,
    user: User,
    db: AsyncSession,
) -> AutoroadConnectResponse:
    await require_infra_write(project_id, user, db)
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


async def handle_apply_legacy(
    project_id: UUID,
    data: AutoroadNetworkPlanBody,
    user: User,
    db: AsyncSession,
) -> AutoroadConnectResponse | JSONResponse:
    from app.services.autoroad_connect import run_autoroad_connect

    await require_infra_write(project_id, user, db)
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
