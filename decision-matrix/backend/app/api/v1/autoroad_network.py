"""BFF for autoroad network planning (JSON pipeline + DB apply)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.compute_rate_limit import ComputeRateLimitDep
from app.core.database import get_db
from app.models import User
from app.schemas import AutoroadConnectResponse
from app.services.autoroad_network.api_handlers import (
    handle_apply_legacy,
    handle_apply_plan,
    handle_build_request,
    handle_compute,
    handle_plan_legacy,
    handle_solver_status,
)
from app.services.autoroad_network.schemas import (
    AutoroadNetworkApplyBody,
    AutoroadNetworkApplyResult,
    AutoroadNetworkBuildRequestBody,
    AutoroadNetworkPlanBody,
    NetworkPlanRequest,
    NetworkPlanResponse,
    SolverStatusResponse,
)

autoroad_network_router = APIRouter(tags=["autoroad-network"])


@autoroad_network_router.get(
    "/autoroad-network/solver-status",
    response_model=SolverStatusResponse,
)
async def autoroad_network_solver_status(
    user: User = Depends(get_current_user),
):
    """Report SteinerPy / GeoSteiner availability for the planner UI."""
    return await handle_solver_status()


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
    return await handle_build_request(project_id, data, user, db)


@autoroad_network_router.post(
    "/projects/{project_id}/autoroad-network/compute",
    response_model=NetworkPlanResponse,
)
async def autoroad_network_compute(
    project_id: UUID,
    data: NetworkPlanRequest,
    _rate: ComputeRateLimitDep,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run planner on input JSON; returns solution JSON only (no DB writes)."""
    return await handle_compute(project_id, data, user, db)


@autoroad_network_router.post("/projects/{project_id}/autoroad-network/apply")
async def autoroad_network_apply_plan(
    project_id: UUID,
    data: AutoroadNetworkApplyBody,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a precomputed plan JSON to the project (no recomputation)."""
    return await handle_apply_plan(project_id, data, user, db)


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
    return await handle_plan_legacy(project_id, data, user, db)


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
    return await handle_apply_legacy(project_id, data, user, db)
