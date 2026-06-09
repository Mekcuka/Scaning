"""Project and POI assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, select

from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.models import PointOfInterest, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import list_accessible_projects, resolve_project
from app.services.serializers import load_project_owners, poi_to_response, project_to_response


class ListProjectsInput(BaseModel):
    pass


class ProjectIdInput(BaseModel):
    project_id: UUID


async def _list_projects(ctx: ToolContext, _args: ListProjectsInput) -> list[dict]:
    projects = await list_accessible_projects(ctx.user, ctx.db)
    owners = await load_project_owners(ctx.db, projects)
    out: list[dict] = []
    for project in projects:
        cnt = await ctx.db.scalar(
            select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
        )
        resp = project_to_response(project, poi_count=cnt or 0, owner=owners.get(project.user_id))
        out.append(resp.model_dump(mode="json"))
    return out


async def _get_project(ctx: ToolContext, args: ProjectIdInput) -> dict:
    project = await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    cnt = await ctx.db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    owner = await ctx.db.get(User, project.user_id)
    return project_to_response(project, poi_count=cnt or 0, owner=owner).model_dump(mode="json")


async def _list_pois(ctx: ToolContext, args: ProjectIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    result = await ctx.db.execute(
        select(PointOfInterest).where(PointOfInterest.project_id == args.project_id)
    )
    return [poi_to_response(poi).model_dump(mode="json") for poi in result.scalars().all()]


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_projects",
            description="List projects accessible to the current user (RBAC-filtered).",
            input_model=ListProjectsInput,
            handler=_list_projects,
        )
    )
    register_tool(
        ToolDefinition(
            name="get_project",
            description="Get project metadata and POI count by project_id.",
            input_model=ProjectIdInput,
            handler=_get_project,
        )
    )
    register_tool(
        ToolDefinition(
            name="list_pois",
            description="List all points of interest (POI) in a project.",
            input_model=ProjectIdInput,
            handler=_list_pois,
        )
    )
