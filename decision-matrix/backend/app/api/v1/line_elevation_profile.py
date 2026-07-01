"""Line elevation profile BFF routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.services.line_elevation_profile.api_handlers import handle_compute, handle_get_profile
from app.services.line_elevation_profile.schemas import LineElevationProfileOut

line_elevation_profile_router = APIRouter(tags=["line-elevation-profile"])


@line_elevation_profile_router.post(
    "/projects/{project_id}/infrastructure/line-elevation-profile/compute",
)
async def post_line_elevation_profile_compute(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_compute(project_id, user, db)


@line_elevation_profile_router.get(
    "/projects/{project_id}/infrastructure/objects/{object_id}/line-elevation-profile",
    response_model=LineElevationProfileOut,
)
async def get_line_elevation_profile(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_profile(project_id, object_id, user, db)
