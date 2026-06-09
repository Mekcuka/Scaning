"""Project background job assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.models import ProjectJob
from app.models.enums import AccessLevel, WriteScope
from app.schemas import ProjectJobResponse
from app.services.project_access import resolve_project
from app.services.project_jobs import (
    get_active_job_for_project,
    list_recent_jobs,
    reconcile_stale_active_job,
)


class ListProjectJobsInput(BaseModel):
    project_id: UUID
    limit: int = Field(default=30, ge=1, le=100)


class GetProjectJobInput(BaseModel):
    project_id: UUID
    job_id: UUID | None = None


def _job_dict(job: ProjectJob) -> dict:
    return ProjectJobResponse.model_validate(job).model_dump(mode="json")


async def _get_project_job(ctx: ToolContext, args: GetProjectJobInput) -> dict | None:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    if args.job_id is None:
        await reconcile_stale_active_job(ctx.db, args.project_id)
        await ctx.db.commit()
        job = await get_active_job_for_project(ctx.db, args.project_id)
        if not job:
            return None
        return _job_dict(job)
    job = await ctx.db.get(ProjectJob, args.job_id)
    if not job or job.project_id != args.project_id:
        raise ToolError("not_found", "Job not found")
    return _job_dict(job)


async def _list_project_jobs(ctx: ToolContext, args: ListProjectJobsInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    rows, total = await list_recent_jobs(ctx.db, args.project_id, limit=args.limit)
    return {
        "items": [_job_dict(j) for j in rows],
        "total": total,
        "limit": args.limit,
    }


def register() -> None:
    register_tool(
        ToolDefinition(
            name="get_project_job",
            description="Get a project job by id, or the active job when job_id is omitted.",
            input_model=GetProjectJobInput,
            handler=_get_project_job,
        )
    )
    register_tool(
        ToolDefinition(
            name="list_project_jobs",
            description="List recent background jobs for a project.",
            input_model=ListProjectJobsInput,
            handler=_list_project_jobs,
        )
    )
