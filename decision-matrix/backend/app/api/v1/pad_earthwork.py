"""Pad earthwork BFF for point infrastructure objects (except node)."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas import InfraObjectResponse
from app.services.pad_earthwork.api_handlers import (
    handle_compute,
    handle_dem_fetch,
    handle_dem_preview,
    handle_dem_upload_not_supported,
    handle_get_last,
    handle_patch_params,
    handle_patch_sketch,
    handle_sketch_generate,
    handle_sketch_preview,
)
from app.services.pad_earthwork.schemas import (
    PadDemFetchResponseOut,
    PadDemPreviewRequest,
    PadDemPreviewResponseOut,
    PadEarthworkComputeRequest,
    PadEarthworkComputeResponse,
    PadEarthworkLastResponse,
    PadEarthworkParamsPatch,
    PadEarthworkSketchSaveRequest,
    SketchPreviewRequestIn,
    SketchPreviewResponseOut,
    WellLayoutGenerateRequestIn,
    WellLayoutGenerateResponseOut,
)

pad_earthwork_router = APIRouter(tags=["pad-earthwork"])


@pad_earthwork_router.post(
    "/projects/{project_id}/pad-earthwork/sketch/preview",
    response_model=SketchPreviewResponseOut,
)
async def post_pad_earthwork_sketch_preview(
    project_id: UUID,
    body: SketchPreviewRequestIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_sketch_preview(project_id, body, user, db)


@pad_earthwork_router.post("/projects/{project_id}/pad-earthwork/dem")
async def post_pad_earthwork_dem_upload(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Manual GeoTIFF upload — not implemented; use object dem/fetch."""
    return await handle_dem_upload_not_supported(project_id, user, db)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/dem/fetch",
    response_model=PadDemFetchResponseOut,
)
async def post_pad_earthwork_dem_fetch(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkComputeRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_dem_fetch(project_id, object_id, body, user, db)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/dem/preview",
    response_model=PadDemPreviewResponseOut,
)
async def post_pad_earthwork_dem_preview(
    project_id: UUID,
    object_id: UUID,
    body: PadDemPreviewRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_dem_preview(project_id, object_id, body, user, db)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/compute",
    response_model=PadEarthworkComputeResponse,
)
async def post_pad_earthwork_compute(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkComputeRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_compute(project_id, object_id, body, user, db)


@pad_earthwork_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/last",
    response_model=PadEarthworkLastResponse,
)
async def get_pad_earthwork_last(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_last(project_id, object_id, user, db)


@pad_earthwork_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/params",
    response_model=InfraObjectResponse,
)
async def patch_pad_earthwork_params(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkParamsPatch,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_patch_params(project_id, object_id, body, user, db)


@pad_earthwork_router.post(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/sketch/generate",
    response_model=WellLayoutGenerateResponseOut,
)
async def post_pad_earthwork_sketch_generate(
    project_id: UUID,
    object_id: UUID,
    body: WellLayoutGenerateRequestIn | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_sketch_generate(project_id, object_id, body, user, db)


@pad_earthwork_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}/pad-earthwork/sketch",
    response_model=InfraObjectResponse,
)
async def patch_pad_earthwork_sketch(
    project_id: UUID,
    object_id: UUID,
    body: PadEarthworkSketchSaveRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_patch_sketch(project_id, object_id, body, user, db)
