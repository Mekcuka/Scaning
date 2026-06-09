"""Admin job journal assistant tools (admin role only)."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_ADMIN, cats
from app.models.enums import UserRole
from app.schemas import AdminJobsHealthResponse, ProjectJobAdminItem, ProjectJobAdminListResponse
from app.services.admin_jobs import fetch_admin_jobs_health, list_jobs_admin
from app.services.project_jobs import ALLOWED_JOB_TYPES


class AdminListJobsInput(BaseModel):
    status: list[str] | None = None
    job_type: str | None = None
    project_id: UUID | None = None
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


def _to_admin_item(row) -> ProjectJobAdminItem:
    job = row.job
    return ProjectJobAdminItem(
        id=job.id,
        project_id=job.project_id,
        user_id=job.user_id,
        job_type=job.job_type,
        status=job.status,
        payload=job.payload or {},
        result=job.result,
        error_message=job.error_message,
        progress=job.progress,
        started_at=job.started_at,
        finished_at=job.finished_at,
        created_at=job.created_at,
        user_email=row.user_email,
        user_username=row.user_username,
        project_name=row.project_name,
    )


async def _admin_list_jobs(ctx: ToolContext, args: AdminListJobsInput) -> dict:
    if args.job_type is not None and args.job_type not in ALLOWED_JOB_TYPES:
        from app.assistant.errors import ToolError

        raise ToolError("validation", f"Unknown job_type: {args.job_type}")
    rows, total = await list_jobs_admin(
        ctx.db,
        statuses=args.status,
        job_type=args.job_type,
        project_id=args.project_id,
        limit=args.limit,
        offset=args.offset,
    )
    return ProjectJobAdminListResponse(
        items=[_to_admin_item(r) for r in rows],
        total=total,
        limit=args.limit,
        offset=args.offset,
    ).model_dump(mode="json")


async def _admin_jobs_health(ctx: ToolContext, _args: AdminJobsHealthInput) -> dict:
    health = await fetch_admin_jobs_health(ctx.db)
    return AdminJobsHealthResponse(
        redis_ok=health.redis_ok,
        redis_error=health.redis_error,
        queue_name=health.queue_name,
        jobs_use_queue=health.jobs_use_queue,
        jobs_by_status=health.jobs_by_status,
        active_jobs=health.active_jobs,
    ).model_dump(mode="json")


class AdminJobsHealthInput(BaseModel):
    pass


_NON_ADMIN = frozenset({UserRole.analyst, UserRole.data_manager, UserRole.viewer})


def register() -> None:
    register_tool(
        ToolDefinition(
            name="admin_list_jobs",
            description="List background jobs across all projects (admin journal).",
            input_model=AdminListJobsInput,
            handler=_admin_list_jobs,
            hide_from_roles=_NON_ADMIN,
            categories=cats(CAT_ADMIN),
        )
    )
    register_tool(
        ToolDefinition(
            name="admin_jobs_health",
            description="Queue and job status health summary (admin).",
            input_model=AdminJobsHealthInput,
            handler=_admin_jobs_health,
            hide_from_roles=_NON_ADMIN,
            categories=cats(CAT_ADMIN),
        )
    )
