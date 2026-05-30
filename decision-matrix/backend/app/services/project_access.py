"""Role-aware project access control."""

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Project, User
from app.models.enums import AccessLevel, UserRole, WriteScope
from app.core.permission_messages import deny_project_access, deny_role_required


def user_role(user: User) -> UserRole:
    try:
        return UserRole(user.role)
    except ValueError:
        return UserRole.viewer


def is_admin(user: User) -> bool:
    return user_role(user) == UserRole.admin


def is_owner(user: User, project: Project) -> bool:
    return project.user_id == user.id


def can_read_project(user: User, project: Project) -> bool:
    role = user_role(user)
    if is_admin(user) or is_owner(user, project):
        return True
    if role == UserRole.data_manager:
        return True
    if project.visibility == "published":
        return role in (UserRole.analyst, UserRole.viewer)
    return False


def can_write_project(user: User, project: Project, scope: WriteScope = WriteScope.project) -> bool:
    role = user_role(user)
    if is_admin(user) or is_owner(user, project):
        return True
    if scope == WriteScope.infra and role == UserRole.data_manager:
        return True
    if scope == WriteScope.project and role == UserRole.analyst and is_owner(user, project):
        return True
    return False


def can_own_project(user: User, project: Project) -> bool:
    return is_admin(user) or is_owner(user, project)


async def resolve_project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    min_access: AccessLevel = AccessLevel.read,
    write_scope: WriteScope = WriteScope.project,
) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    if min_access == AccessLevel.read:
        if not can_read_project(user, project):
            deny_project_access(user, project, min_access=min_access, write_scope=write_scope)
        return project

    if min_access == AccessLevel.write:
        if not can_write_project(user, project, write_scope):
            deny_project_access(user, project, min_access=min_access, write_scope=write_scope)
        return project

    if min_access == AccessLevel.owner:
        if not can_own_project(user, project):
            deny_project_access(user, project, min_access=min_access, write_scope=write_scope)
        return project

    deny_project_access(user, project, min_access=min_access, write_scope=write_scope)


async def list_accessible_projects(user: User, db: AsyncSession) -> list[Project]:
    role = user_role(user)
    if is_admin(user) or role == UserRole.data_manager:
        result = await db.execute(select(Project).order_by(Project.created_at.desc()))
        return list(result.scalars().all())

    if role == UserRole.viewer:
        result = await db.execute(
            select(Project)
            .where(Project.visibility == "published")
            .order_by(Project.created_at.desc())
        )
        return list(result.scalars().all())

    # analyst: own + published others
    result = await db.execute(
        select(Project)
        .where(
            or_(
                Project.user_id == user.id,
                Project.visibility == "published",
            )
        )
        .order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


def can_create_project(user: User) -> bool:
    return user_role(user) in (UserRole.admin, UserRole.analyst)
