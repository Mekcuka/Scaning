"""Sand logistics analysis API."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import SandLogisticsAnalyzeRequest, SandLogisticsAnalyzeResponse
from app.services.project_access import resolve_project
from app.services.sand_logistics import analyze_sand_logistics
from app.services.sand_logistics_store import (
    get_sand_logistics_result,
    row_to_response,
    upsert_sand_logistics_result,
)

sand_logistics_router = APIRouter()


@sand_logistics_router.get(
    "/projects/{project_id}/sand-logistics/result",
    response_model=SandLogisticsAnalyzeResponse,
)
async def get_sand_logistics_result_endpoint(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    stored = await get_sand_logistics_result(db, project_id)
    if stored is None:
        raise HTTPException(status_code=404, detail="Sand logistics result not found")
    return SandLogisticsAnalyzeResponse.model_validate(stored)


@sand_logistics_router.post(
    "/projects/{project_id}/sand-logistics/analyze",
    response_model=SandLogisticsAnalyzeResponse,
)
async def post_sand_logistics_analyze(
    project_id: UUID,
    body: SandLogisticsAnalyzeRequest | None = Body(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.write, write_scope=WriteScope.infra)
    req = body or SandLogisticsAnalyzeRequest()
    result = await analyze_sand_logistics(
        db,
        project_id,
        rebuild_network=req.rebuild_network,
        as_of=req.as_of,
        horizon_from=req.horizon_from,
        horizon_to=req.horizon_to,
    )
    row = await upsert_sand_logistics_result(db, project_id, result, user_id=user.id)
    await db.commit()
    return SandLogisticsAnalyzeResponse.model_validate(row_to_response(row))
