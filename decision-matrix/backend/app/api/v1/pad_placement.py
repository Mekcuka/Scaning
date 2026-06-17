"""BFF for pad placement optimization."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.compute_rate_limit import ComputeRateLimitDep
from app.core.database import get_db
from app.models import User
from app.services.pad_placement.api_handlers import (
    handle_apply,
    handle_compute,
    handle_get_compute,
    handle_preview_geojson,
    handle_request,
)
from app.services.pad_placement.schemas import (
    PadPlacementApplyRequest,
    PadPlacementApplyResponse,
    PadPlacementComputeRequest,
    PadPlacementComputeResponse,
    PadPlacementGeoJsonResponse,
    PadPlacementRequestResponse,
)

pad_placement_router = APIRouter(tags=["pad-placement"])


@pad_placement_router.post(
    "/projects/{project_id}/pad-placement/request",
    response_model=PadPlacementRequestResponse,
)
async def pad_placement_request(
    project_id: UUID,
    data: PadPlacementComputeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_request(project_id, data, user, db)


@pad_placement_router.post(
    "/projects/{project_id}/pad-placement/compute",
    response_model=PadPlacementComputeResponse,
)
async def pad_placement_compute(
    project_id: UUID,
    data: PadPlacementComputeRequest,
    _rate: ComputeRateLimitDep,
    async_mode: bool = Query(False, alias="async"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_compute(project_id, data, user, db, async_mode=async_mode)


@pad_placement_router.get(
    "/projects/{project_id}/pad-placement/compute/{request_id}",
    response_model=PadPlacementComputeResponse,
)
async def pad_placement_get_compute(
    project_id: UUID,
    request_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_compute(project_id, request_id, user, db)


@pad_placement_router.get(
    "/projects/{project_id}/pad-placement/preview/{request_id}/{variant_index}/geojson",
    response_model=PadPlacementGeoJsonResponse,
)
async def pad_placement_preview_geojson(
    project_id: UUID,
    request_id: UUID,
    variant_index: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_preview_geojson(project_id, request_id, variant_index, user, db)


@pad_placement_router.post(
    "/projects/{project_id}/pad-placement/apply",
    response_model=PadPlacementApplyResponse,
)
async def pad_placement_apply(
    project_id: UUID,
    data: PadPlacementApplyRequest,
    async_mode: bool = Query(False, alias="async"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_apply(project_id, data, user, db, async_mode=async_mode)
