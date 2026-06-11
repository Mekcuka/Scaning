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
from app.services.auth_tokens import revoke_all_user_refresh_tokens

admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(verify_csrf)])


def _as_uuid(value: UUID) -> UUID:
    return value if isinstance(value, UUID) else UUID(str(value))


async def _project_counts_by_user(db: AsyncSession) -> dict[UUID, int]:
    rows = await db.execute(
        select(Project.user_id, func.count(Project.id)).group_by(Project.user_id)
    )
    return {_as_uuid(user_id): int(count) for user_id, count in rows.all()}


def _user_admin_response(user: User, project_counts: dict[UUID, int]) -> UserAdminResponse:
    return UserAdminResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at,
        last_login_at=user.last_login_at,
        project_count=project_counts.get(_as_uuid(user.id), 0),
    )


@admin_router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    project_counts = await _project_counts_by_user(db)
    return [_user_admin_response(u, project_counts) for u in users]


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
    if target.id == admin.id and data.role is not None and data.role != UserRole.admin.value:
        raise HTTPException(status_code=400, detail="Cannot remove your own admin role")
    role_changed = False
    active_changed = False
    if data.role is not None:
        try:
            role_enum = UserRole(data.role)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid role")
        if target.role != role_enum.value:
            role_changed = True
        target.role = role_enum.value
    if data.is_active is not None:
        if target.is_active != data.is_active:
            active_changed = True
        target.is_active = data.is_active
    if role_changed or active_changed:
        await revoke_all_user_refresh_tokens(db, target.id)
    await db.commit()
    await db.refresh(target)
    project_counts = await _project_counts_by_user(db)
    return _user_admin_response(target, project_counts)


@admin_router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    users = await db.scalar(select(func.count()).select_from(User)) or 0
    projects = await db.scalar(select(func.count()).select_from(Project)) or 0
    pois = await db.scalar(select(func.count()).select_from(PointOfInterest)) or 0
    return AdminStatsResponse(users=users, projects=projects, pois=pois)
