from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_csrf
from app.api.rbac import require_admin
from app.core.database import get_db
from app.models import PointOfInterest, Project, User
from app.models.enums import UserRole
from app.schemas import AdminStatsResponse, AdminUserUpdate, UserAdminResponse

admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(verify_csrf)])


@admin_router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@admin_router.patch("/users/{user_id}", response_model=UserAdminResponse)
async def update_user(
    user_id: UUID,
    data: AdminUserUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.id == admin.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")
    if data.role is not None:
        try:
            UserRole(data.role)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid role")
        target.role = data.role
    if data.is_active is not None:
        target.is_active = data.is_active
    await db.commit()
    await db.refresh(target)
    return target


@admin_router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users = await db.scalar(select(func.count()).select_from(User)) or 0
    projects = await db.scalar(select(func.count()).select_from(Project)) or 0
    pois = await db.scalar(select(func.count()).select_from(PointOfInterest)) or 0
    return AdminStatsResponse(users=users, projects=projects, pois=pois)
