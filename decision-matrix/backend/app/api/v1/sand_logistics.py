"""Sand logistics analysis API."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import SandLogisticsAnalyzeResponse
from app.services.project_access import resolve_project
from app.services.sand_logistics import analyze_sand_logistics

sand_logistics_router = APIRouter()


@sand_logistics_router.post(
    "/projects/{project_id}/sand-logistics/analyze",
    response_model=SandLogisticsAnalyzeResponse,
)
async def post_sand_logistics_analyze(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await resolve_project(project_id, user, db, min_access=AccessLevel.read, write_scope=WriteScope.infra)
    result = await analyze_sand_logistics(db, project_id, rebuild_network=True)
    await db.commit()
    return SandLogisticsAnalyzeResponse.model_validate(result)
