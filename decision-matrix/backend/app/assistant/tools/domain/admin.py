"""Admin panel read-only assistant tools."""

from __future__ import annotations

from pydantic import BaseModel
from sqlalchemy import func, select

from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_ADMIN, cats
from app.models import PointOfInterest, Project, User
from app.models.enums import UserRole
from app.schemas import AdminStatsResponse, UserAdminResponse


class EmptyInput(BaseModel):
    pass


_NON_ADMIN = frozenset({UserRole.analyst, UserRole.data_manager, UserRole.viewer})


async def _project_counts_by_user(ctx: ToolContext) -> dict:
    rows = await ctx.db.execute(
        select(Project.user_id, func.count(Project.id)).group_by(Project.user_id)
    )
    return {user_id: int(count) for user_id, count in rows.all()}


async def _admin_list_users(ctx: ToolContext, _args: EmptyInput) -> list[dict]:
    result = await ctx.db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())
    project_counts = await _project_counts_by_user(ctx)
    return [
        UserAdminResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at,
            last_login_at=u.last_login_at,
            project_count=project_counts.get(u.id, 0),
        ).model_dump(mode="json")
        for u in users
    ]


async def _admin_stats(ctx: ToolContext, _args: EmptyInput) -> dict:
    users = await ctx.db.scalar(select(func.count()).select_from(User)) or 0
    projects = await ctx.db.scalar(select(func.count()).select_from(Project)) or 0
    pois = await ctx.db.scalar(select(func.count()).select_from(PointOfInterest)) or 0
    return AdminStatsResponse(users=users, projects=projects, pois=pois).model_dump(mode="json")


def register() -> None:
    register_tool(
        ToolDefinition(
            name="admin_list_users",
            description="List all users with roles and project counts (admin).",
            input_model=EmptyInput,
            handler=_admin_list_users,
            hide_from_roles=_NON_ADMIN,
            categories=cats(CAT_ADMIN),
        )
    )
    register_tool(
        ToolDefinition(
            name="admin_stats",
            description="Global counts of users, projects, and POIs (admin).",
            input_model=EmptyInput,
            handler=_admin_stats,
            hide_from_roles=_NON_ADMIN,
            categories=cats(CAT_ADMIN),
        )
    )
