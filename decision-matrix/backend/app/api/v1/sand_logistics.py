"""Sand logistics analysis API."""

from uuid import UUID

from fastapi import APIRouter, Body, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas import SandLogisticsAnalyzeRequest, SandLogisticsAnalyzeResponse
from app.services.sand_logistics_handlers import (
    handle_get_sand_logistics_result,
    handle_post_sand_logistics_analyze,
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
    return await handle_get_sand_logistics_result(project_id, user, db)


@sand_logistics_router.post("/projects/{project_id}/sand-logistics/analyze")
async def post_sand_logistics_analyze(
    project_id: UUID,
    body: SandLogisticsAnalyzeRequest | None = Body(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    req = body or SandLogisticsAnalyzeRequest()
    return await handle_post_sand_logistics_analyze(project_id, req, user, db)
