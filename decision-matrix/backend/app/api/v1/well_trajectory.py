"""Well trajectory BFF for pad infrastructure objects (oil_pad / gas_pad)."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.services.well_trajectory.api_handlers import (
    handle_compute,
    handle_design,
    handle_design_all,
    handle_design_from_bottomholes,
    handle_generate_from_layout,
    handle_get_last,
    handle_import_csv,
    handle_import_preview,
    handle_import_wbp,
    handle_import_witsml,
    handle_pad_clearance,
    handle_pad_geojson,
    handle_patch_targets,
    handle_project_clearance,
    handle_project_geojson,
    handle_sync_bottomholes,
)
from app.services.well_trajectory.schemas import (
    WellTrajectoryClearanceResponse,
    WellTrajectoryComputeResponse,
    WellTrajectoryDesignAllRequest,
    WellTrajectoryDesignAllResponse,
    WellTrajectoryDesignFromBottomholesRequest,
    WellTrajectoryDesignFromBottomholesResponse,
    WellTrajectoryDesignRequest,
    WellTrajectoryDesignResponse,
    WellTrajectoryGenerateResponse,
    WellTrajectoryGeoJsonResponse,
    WellTrajectoryImportCommitResponse,
    WellTrajectoryImportPreviewResponse,
    WellTrajectoryLastResponse,
    WellTrajectoryTargetsPatch,
    WellTrajectoryTargetsResponse,
    WellTrajectorySyncBottomholesResponse,
)

well_trajectory_router = APIRouter(tags=["well-trajectory"])


@well_trajectory_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/last",
    response_model=WellTrajectoryLastResponse,
)
async def get_well_trajectory_last(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_last(project_id, object_id, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/generate-from-layout",
    response_model=WellTrajectoryGenerateResponse,
)
async def post_well_trajectory_generate_from_layout(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_generate_from_layout(project_id, object_id, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/design",
    response_model=WellTrajectoryDesignResponse,
)
async def post_well_trajectory_design(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_design(project_id, object_id, body, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/compute",
    response_model=WellTrajectoryComputeResponse,
)
async def post_well_trajectory_compute(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_compute(project_id, object_id, user, db)


@well_trajectory_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/geojson",
    response_model=WellTrajectoryGeoJsonResponse,
)
async def get_well_trajectory_geojson(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_pad_geojson(project_id, object_id, user, db)


@well_trajectory_router.get(
    "/projects/{project_id}/well-trajectory/geojson",
    response_model=WellTrajectoryGeoJsonResponse,
)
async def get_project_well_trajectory_geojson(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_project_geojson(project_id, user, db)


@well_trajectory_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/targets",
    response_model=WellTrajectoryTargetsResponse,
)
async def patch_well_trajectory_targets(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryTargetsPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_patch_targets(project_id, object_id, body, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/design-all",
    response_model=WellTrajectoryDesignAllResponse,
)
async def post_well_trajectory_design_all(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignAllRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_design_all(project_id, object_id, body, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/sync-bottomholes",
    response_model=WellTrajectorySyncBottomholesResponse,
)
async def post_well_trajectory_sync_bottomholes(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_sync_bottomholes(project_id, object_id, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/design-from-bottomholes",
    response_model=WellTrajectoryDesignFromBottomholesResponse,
)
async def post_well_trajectory_design_from_bottomholes(
    project_id: UUID,
    object_id: UUID,
    body: WellTrajectoryDesignFromBottomholesRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_design_from_bottomholes(project_id, object_id, body, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/well-trajectory/clearance",
    response_model=WellTrajectoryClearanceResponse,
)
async def post_project_well_trajectory_clearance(
    project_id: UUID,
    async_mode: bool = Query(default=False, alias="async"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_project_clearance(project_id, async_mode, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/clearance",
    response_model=WellTrajectoryClearanceResponse,
)
async def post_pad_well_trajectory_clearance(
    project_id: UUID,
    object_id: UUID,
    async_mode: bool = Query(default=False, alias="async"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_pad_clearance(project_id, object_id, async_mode, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/preview",
    response_model=WellTrajectoryImportPreviewResponse,
)
async def post_well_trajectory_import_preview(
    project_id: UUID,
    object_id: UUID,
    format: str = Query(..., pattern="^(csv|wbp)$"),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_import_preview(project_id, object_id, format, file, user, db)


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/csv",
    response_model=WellTrajectoryImportCommitResponse,
)
async def post_well_trajectory_import_csv(
    project_id: UUID,
    object_id: UUID,
    file: UploadFile = File(...),
    async_mode: bool = Query(default=False, alias="async"),
    step_m: float | None = Query(default=None, gt=0, le=500),
    interpolate: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_import_csv(
        project_id, object_id, file, async_mode, step_m, interpolate, user, db
    )


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/wbp",
    response_model=WellTrajectoryImportCommitResponse,
)
async def post_well_trajectory_import_wbp(
    project_id: UUID,
    object_id: UUID,
    file: UploadFile = File(...),
    async_mode: bool = Query(default=False, alias="async"),
    step_m: float | None = Query(default=None, gt=0, le=500),
    interpolate: bool = Query(default=True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_import_wbp(
        project_id, object_id, file, async_mode, step_m, interpolate, user, db
    )


@well_trajectory_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/well-trajectory/import/witsml",
)
async def post_well_trajectory_import_witsml(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_import_witsml(project_id, object_id, user, db)
