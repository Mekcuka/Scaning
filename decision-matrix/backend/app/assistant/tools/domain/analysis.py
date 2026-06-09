"""POI analysis assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_ANALYSIS, cats
from app.models import PointOfInterest, PoiInfrastructureAnalysis
from app.models.enums import AccessLevel, WriteScope
from app.schemas import CandidateResponse
from app.services.infrastructure_analysis import (
    build_enriched_analysis_from_db,
    run_poi_analysis,
    run_project_pois_analysis,
)
from app.services.spatial import list_candidates_by_subtype, list_external_linear_candidates
from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
from app.services.project_access import resolve_project
from app.services.project_jobs import JOB_TYPE_POI_ANALYZE_ALL, ActiveProjectJobError


class PoiAnalysisInput(BaseModel):
    project_id: UUID
    poi_id: UUID


class StartAnalyzeAllPoisInput(BaseModel):
    project_id: UUID


class GetPoiCandidatesInput(BaseModel):
    project_id: UUID
    poi_id: UUID
    subtype: str
    limit: int = Field(default=20, ge=1, le=100)
    nearest_policy: str = Field(default="point_on_line", description="point_on_line | network_node")
    param_type: str | None = Field(default=None, description="external | external_linear")


async def _get_poi(ctx: ToolContext, project_id: UUID, poi_id: UUID) -> PointOfInterest:
    poi = await ctx.db.scalar(
        select(PointOfInterest).where(
            PointOfInterest.id == poi_id,
            PointOfInterest.project_id == project_id,
        )
    )
    if not poi:
        raise ToolError("not_found", "POI not found")
    return poi


async def _get_poi_analysis(ctx: ToolContext, args: PoiAnalysisInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    poi = await _get_poi(ctx, args.project_id, args.poi_id)
    row_count = await ctx.db.scalar(
        select(PoiInfrastructureAnalysis.id)
        .where(PoiInfrastructureAnalysis.poi_id == poi.id)
        .limit(1)
    )
    if not row_count:
        raise ToolError("not_found", "No analysis found. Run analyze first.")
    result = await build_enriched_analysis_from_db(ctx.db, args.project_id, poi)
    return result


async def _get_poi_candidates(ctx: ToolContext, args: GetPoiCandidatesInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.project
    )
    poi = await _get_poi(ctx, args.project_id, args.poi_id)
    st = args.subtype.lower()
    if args.param_type == "external_linear":
        candidates = await list_external_linear_candidates(
            ctx.db, args.project_id, poi, st, args.limit
        )
    else:
        candidates = await list_candidates_by_subtype(
            ctx.db,
            args.project_id,
            poi,
            st,
            args.limit,
            nearest_policy=args.nearest_policy,
        )
    return [
        CandidateResponse(
            object_id=c.object_id,
            nearest_node_id=c.nearest_node_id,
            name=c.name,
            distance_km=round(c.distance_km, 2),
            anchor_lon=c.anchor_lon,
            anchor_lat=c.anchor_lat,
            anchor_type=c.anchor_type,
        ).model_dump(mode="json")
        for c in candidates
    ]


async def _analyze_poi(ctx: ToolContext, args: PoiAnalysisInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.project
    )
    poi = await _get_poi(ctx, args.project_id, args.poi_id)
    result = await run_poi_analysis(ctx.db, args.project_id, poi)
    await ctx.db.commit()
    return result


async def _start_analyze_all_pois(ctx: ToolContext, args: StartAnalyzeAllPoisInput) -> dict:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.project
    )
    if jobs_async_enabled():
        try:
            job = await create_and_schedule_job(
                ctx.db,
                project_id=args.project_id,
                user_id=ctx.user.id,
                job_type=JOB_TYPE_POI_ANALYZE_ALL,
                payload={},
            )
            await commit_and_schedule(ctx.db, job)
        except ActiveProjectJobError as e:
            raise ToolError(
                "conflict",
                f"Project already has an active job (active_job_id={e.active_job_id})",
            ) from e
        return {
            "job_id": str(job.id),
            "job_type": job.job_type,
            "status": job.status,
            "async": True,
        }
    payload = await run_project_pois_analysis(ctx.db, args.project_id)
    await ctx.db.commit()
    return {"async": False, "result": payload}


def register() -> None:
    register_tool(
        ToolDefinition(
            name="get_poi_candidates",
            description="List nearest infrastructure candidates for a POI by subtype.",
            input_model=GetPoiCandidatesInput,
            handler=_get_poi_candidates,
            categories=cats(CAT_ANALYSIS),
        )
    )
    register_tool(
        ToolDefinition(
            name="get_poi_analysis",
            description="Get enriched infrastructure analysis for a single POI.",
            input_model=PoiAnalysisInput,
            handler=_get_poi_analysis,
            categories=cats(CAT_ANALYSIS),
        )
    )
    register_tool(
        ToolDefinition(
            name="analyze_poi",
            description="Run infrastructure analysis for a single POI (sync, writes to DB).",
            input_model=PoiAnalysisInput,
            handler=_analyze_poi,
            mutating=True,
            categories=cats(CAT_ANALYSIS),
        )
    )
    register_tool(
        ToolDefinition(
            name="start_analyze_all_pois",
            description="Run infrastructure analysis for all POIs (async job or sync fallback).",
            input_model=StartAnalyzeAllPoisInput,
            handler=_start_analyze_all_pois,
            mutating=True,
            categories=cats(CAT_ANALYSIS),
        )
    )
