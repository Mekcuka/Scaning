"""Infrastructure graph assistant tools."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select

from app.assistant.context import ToolContext
from app.assistant.registry import register_tool
from app.assistant.tools.base import ToolDefinition
from app.assistant.tools.categories import CAT_MAP, cats
from app.models import InfrastructureEdge, InfrastructureNetwork, InfrastructureNode
from app.models.enums import AccessLevel, WriteScope
from app.services.project_access import resolve_project


class ProjectIdInput(BaseModel):
    project_id: UUID


class NetworkIdInput(BaseModel):
    project_id: UUID
    network_id: UUID


async def _list_networks(ctx: ToolContext, args: ProjectIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    rows = (
        await ctx.db.execute(
            select(InfrastructureNetwork).where(InfrastructureNetwork.project_id == args.project_id)
        )
    ).scalars().all()
    return [
        {"id": n.id, "project_id": n.project_id, "name": n.name}
        for n in rows
    ]


async def _list_network_nodes(ctx: ToolContext, args: NetworkIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    nodes = (
        await ctx.db.execute(
            select(InfrastructureNode).where(InfrastructureNode.network_id == args.network_id)
        )
    ).scalars().all()
    edges = (
        await ctx.db.execute(
            select(InfrastructureEdge).where(InfrastructureEdge.network_id == args.network_id)
        )
    ).scalars().all()
    used_node_ids: set[UUID] = set()
    for edge in edges:
        used_node_ids.add(edge.from_node_id)
        used_node_ids.add(edge.to_node_id)
    return [
        {
            "id": n.id,
            "network_id": n.network_id,
            "infrastructure_object_id": n.infrastructure_object_id,
            "lon": n.longitude,
            "lat": n.latitude,
        }
        for n in nodes
        if n.id in used_node_ids
    ]


async def _list_network_edges(ctx: ToolContext, args: NetworkIdInput) -> list[dict]:
    await resolve_project(
        args.project_id, ctx.user, ctx.db, min_access=AccessLevel.read, write_scope=WriteScope.infra
    )
    node_ids = {
        row[0]
        for row in (
            await ctx.db.execute(
                select(InfrastructureNode.id).where(InfrastructureNode.network_id == args.network_id)
            )
        ).all()
    }
    rows = (
        await ctx.db.execute(
            select(InfrastructureEdge).where(InfrastructureEdge.network_id == args.network_id)
        )
    ).scalars().all()
    return [
        {
            "id": e.id,
            "network_id": e.network_id,
            "from_node_id": e.from_node_id,
            "to_node_id": e.to_node_id,
            "length_km": e.length_km,
        }
        for e in rows
        if e.from_node_id in node_ids and e.to_node_id in node_ids
    ]


def register() -> None:
    register_tool(
        ToolDefinition(
            name="list_networks",
            description="List infrastructure graph networks in a project.",
            input_model=ProjectIdInput,
            handler=_list_networks,
            categories=cats(CAT_MAP),
        )
    )
    register_tool(
        ToolDefinition(
            name="list_network_nodes",
            description="List nodes of an infrastructure network (only nodes used by edges).",
            input_model=NetworkIdInput,
            handler=_list_network_nodes,
            categories=cats(CAT_MAP),
        )
    )
    register_tool(
        ToolDefinition(
            name="list_network_edges",
            description="List edges of an infrastructure network.",
            input_model=NetworkIdInput,
            handler=_list_network_edges,
            categories=cats(CAT_MAP),
        )
    )
