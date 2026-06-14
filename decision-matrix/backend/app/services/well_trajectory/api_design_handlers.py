"""Design/compute/geojson HTTP handlers for well trajectory BFF."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject, User
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import resolve_project
from app.services.well_trajectory.api_common import (
    persist_pad_trajectories,
    read_pad_for_read,
    read_pad_for_write,
    run_planner,
)
from app.services.well_trajectory.geojson import build_pad_geojson, build_project_geojson
from app.services.well_trajectory.schemas import (
    WellTrajectoryComputeResponse,
    WellTrajectoryDesignAllRequest,
    WellTrajectoryDesignAllResponse,
    WellTrajectoryDesignFromBottomholesRequest,
    WellTrajectoryDesignFromBottomholesResponse,
    WellTrajectoryDesignRequest,
    WellTrajectoryDesignResponse,
    WellTrajectoryGenerateResponse,
    WellTrajectoryGeoJsonResponse,
    WellTrajectoryLastResponse,
    WellTrajectoryTargetsPatch,
    WellTrajectoryTargetsResponse,
    WellTrajectorySyncBottomholesResponse,
)
from app.services.well_trajectory.service import (
    build_last_response,
    compute_all_trajectories,
    design_all_from_targets,
    design_from_bottomholes,
    design_well_trajectory,
    generate_trajectories_from_layout,
    save_targets,
    sync_bottomholes_for_pad,
)
from app.services.well_trajectory.trajectory_store import read_trajectories_json, store_computed_at
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES


async def handle_get_last(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryLastResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return build_last_response(obj)


async def handle_generate_from_layout(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryGenerateResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = run_planner(generate_trajectories_from_layout, obj)
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=response.trajectories,
    )
    await db.refresh(obj)
    return response


async def handle_design(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignRequest,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryDesignResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = run_planner(design_well_trajectory, obj, body)
    trajectories = read_trajectories_json(obj.properties)
    trajectories[body.well_index] = response.trajectory
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=trajectories,
    )
    return response


async def handle_compute(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryComputeResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = run_planner(compute_all_trajectories, obj)
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=response.trajectories,
        props_postprocess=store_computed_at,
    )
    return response


async def handle_pad_geojson(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryGeoJsonResponse:
    obj = await read_pad_for_read(project_id, object_id, user, db)
    return build_pad_geojson(obj)


async def handle_project_geojson(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryGeoJsonResponse:
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.in_(PAD_CLUSTER_SUBTYPES),
        )
    )
    pads = list(result.scalars().all())
    return build_project_geojson(pads)


async def handle_patch_targets(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryTargetsPatch,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryTargetsResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = save_targets(obj, body)
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=response.trajectories,
    )
    return response


async def handle_design_all(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignAllRequest,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryDesignAllResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = run_planner(design_all_from_targets, obj, body)
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=response.trajectories,
    )
    return response


async def handle_sync_bottomholes(
    project_id: UUID,
    object_id: UUID,
    user: User,
    db: AsyncSession,
) -> WellTrajectorySyncBottomholesResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = await sync_bottomholes_for_pad(db, obj, project_id=project_id)
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=response.trajectories,
    )
    return response


async def handle_design_from_bottomholes(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignFromBottomholesRequest,
    user: User,
    db: AsyncSession,
) -> WellTrajectoryDesignFromBottomholesResponse:
    project, obj = await read_pad_for_write(project_id, object_id, user, db)
    response = await design_from_bottomholes(db, obj, body, project_id=project_id)
    await persist_pad_trajectories(
        db,
        project=project,
        project_id=project_id,
        user=user,
        obj=obj,
        trajectories=response.trajectories,
    )
    return response
