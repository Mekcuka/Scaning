"""Mutating map assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v1.map_deps import get_infra_object
from app.assistant.context import ToolContext
from app.assistant.errors import ToolError
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_MAP, cats
from app.models.enums import AccessLevel, WriteScope
from app.services.infra_delete import delete_infra_objects_batch, delete_pois_batch
from app.services.project_access import resolve_project


class BatchDeleteMapObjectsInput(BaseModel):
    project_id: UUID
    object_ids: list[UUID] = Field(default_factory=list)
    poi_ids: list[UUID] = Field(default_factory=list)


async def _batch_delete_map_objects(ctx: ToolContext, args: BatchDeleteMapObjectsInput) -> dict:
    if not args.object_ids and not args.poi_ids:
        raise ToolError("validation", "At least one of object_ids or poi_ids is required")
    if args.object_ids:
        await resolve_project(
            args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.infra
        )
    if args.poi_ids:
        await resolve_project(
            args.project_id, ctx.user, ctx.db, min_access=AccessLevel.write, write_scope=WriteScope.project
        )
    object_ids = set(args.object_ids)
    poi_ids = set(args.poi_ids)
    if object_ids:
        for oid in object_ids:
            await get_infra_object(oid, args.project_id, ctx.db)
    deleted_objects, network_rebuilt = await delete_infra_objects_batch(ctx.db, args.project_id, object_ids)
    deleted_pois = await delete_pois_batch(ctx.db, args.project_id, poi_ids)
    await ctx.db.commit()
    return {
        "deleted_objects": deleted_objects,
        "deleted_pois": deleted_pois,
        "network_rebuilt": network_rebuilt,
    }


def register() -> None:
    register_tool(
        ToolDefinition(
            name="batch_delete_map_objects",
            description="Delete infrastructure objects and/or POIs by explicit IDs (no paste).",
            input_model=BatchDeleteMapObjectsInput,
            handler=_batch_delete_map_objects,
            mutating=True,
            categories=cats(CAT_MAP),
        )
    )
