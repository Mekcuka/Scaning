"""Load/save custom POI flow schematic layouts."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PoiFlowSchematicLayout, PointOfInterest
from app.services.flow_schematic_merge import merge_auto_schematic_with_layout
from app.services.flow_propagation import propagate_flows
from app.services.fluid_flow_schematic import build_flow_schematic


def _nodes_edges_to_response(
    poi_id: UUID,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    *,
    warnings: list[str],
    source: str,
) -> dict[str, Any]:
    return {
        "poi_id": poi_id,
        "nodes": nodes,
        "edges": edges,
        "warnings": warnings,
        "source": source,
    }


async def get_flow_schematic(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
) -> dict[str, Any]:
    auto = await build_flow_schematic(db, project_id, poi)
    layout = await db.scalar(
        select(PoiFlowSchematicLayout).where(PoiFlowSchematicLayout.poi_id == poi.id)
    )
    if layout and layout.nodes:
        return merge_auto_schematic_with_layout(
            auto,
            layout.nodes,
            layout.edges or [],
            poi,
        )
    auto["source"] = "auto"
    return auto


async def save_flow_schematic(
    db: AsyncSession,
    poi: PointOfInterest,
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
) -> dict[str, Any]:
    payload_nodes = [
        {k: v for k, v in (n.model_dump() if hasattr(n, "model_dump") else dict(n)).items()
         if k not in ("flow_annual", "flow_unit", "over_capacity")}
        for n in nodes
    ]
    payload_edges = [e.model_dump() if hasattr(e, "model_dump") else dict(e) for e in edges]

    layout = await db.scalar(
        select(PoiFlowSchematicLayout).where(PoiFlowSchematicLayout.poi_id == poi.id)
    )
    if layout:
        layout.nodes = payload_nodes
        layout.edges = payload_edges
    else:
        layout = PoiFlowSchematicLayout(poi_id=poi.id, nodes=payload_nodes, edges=payload_edges)
        db.add(layout)
    await db.flush()
    auto = await build_flow_schematic(db, poi.project_id, poi)
    saved = propagate_flows(payload_nodes, payload_edges, poi)
    return _nodes_edges_to_response(
        poi.id,
        saved,
        payload_edges,
        warnings=auto.get("warnings", []),
        source="custom",
    )


async def delete_flow_schematic_layout(db: AsyncSession, poi_id: UUID) -> None:
    layout = await db.scalar(
        select(PoiFlowSchematicLayout).where(PoiFlowSchematicLayout.poi_id == poi_id)
    )
    if layout:
        await db.delete(layout)
