"""Project and POI assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import func, select

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_PROJECTS, CAT_RATES, cats
from app.models import PointOfInterest, Project, ProjectDistanceDefaults, User
from app.models.enums import AccessLevel, UserRole, WriteScope
from app.schemas import DistanceDefaultsResponse, POICreate
from app.services.poi_create import create_poi_for_project
from app.services.project_access import list_accessible_projects, resolve_project, user_role
from app.services.project_setup import create_project_with_defaults
from app.services.serializers import load_project_owners, poi_to_response, project_to_response


class ListProjectsInput(BaseModel):
    pass


class ProjectIdInput(BaseModel):
    project_id: UUID


class CreateProjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class CreatePoiInput(BaseModel):
    project_id: UUID
    name: str
    lon: float
    lat: float
    description: str | None = None


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


async def _get_distance_defaults(ctx: ToolContext, args: ProjectIdInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    row = await ctx.db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == args.project_id)
    )
    if not row:
        raise ToolError("not_found", "Distance defaults not found")
    return DistanceDefaultsResponse.model_validate(row).model_dump(mode="json")


async def _create_project(ctx: ToolContext, args: CreateProjectInput) -> dict:
    role = user_role(ctx.user)
    if role not in (UserRole.admin, UserRole.analyst):
        raise ToolError("forbidden", "Only admin or analyst can create projects")
    project = await create_project_with_defaults(
        ctx.db,
        user=ctx.user,
        name=args.name,
        description=args.description,
    )
    return project_to_response(project, poi_count=0, owner=ctx.user).model_dump(mode="json")


async def _create_poi(ctx: ToolContext, args: CreatePoiInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.project
    )
    poi = await create_poi_for_project(
        ctx.db,
        args.project_id,
        POICreate(
            name=args.name,
            lon=args.lon,
            lat=args.lat,
            description=args.description,
        ),
    )
    return poi_to_response(poi).model_dump(mode="json")


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
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_project",
            description="Get project metadata and POI count by project_id.",
            input_model=ProjectIdInput,
            handler=_get_project,
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="list_pois",
            description="List all points of interest (POI) in a project.",
            input_model=ProjectIdInput,
            handler=_list_pois,
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_distance_defaults",
            description="Get project distance and line-length threshold defaults.",
            input_model=ProjectIdInput,
            handler=_get_distance_defaults,
            categories=cats(CAT_RATES),
        )
    )
    register_tool(
        ToolDefinition(
            name="create_project",
            description="Create a new project with default rates and economic params (admin/analyst).",
            input_model=CreateProjectInput,
            handler=_create_project,
            mutating=True,
            hide_from_roles=frozenset({UserRole.viewer, UserRole.data_manager}),
            categories=cats(CAT_PROJECTS),
        )
    )
    register_tool(
        ToolDefinition(
            name="create_poi",
            description="Create a point of interest (POI) in a project.",
            input_model=CreatePoiInput,
            handler=_create_poi,
            mutating=True,
            categories=cats(CAT_PROJECTS),
        )
    )
