"""Build NetworkPlanRequest snapshot from project database."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES, NODE_CLUSTER_SUBTYPES, POINT_SUBTYPES
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanTerminalInput,
)
from app.services.graph_builder import build_network_from_lines
from app.services.spatial import line_coords_from_object


async def build_plan_request(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
) -> NetworkPlanRequest:
    await build_network_from_lines(db, project_id)

    autoroad_q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype == "autoroad",
            InfrastructureObject.end_longitude.isnot(None),
        )
    )
    autoroad_rows = (await db.execute(autoroad_q)).scalars().all()
    existing: list[ExistingAutoroadInput] = []
    for road in autoroad_rows:
        coords = line_coords_from_object(road)
        if len(coords) >= 2:
            existing.append(
                ExistingAutoroadInput(
                    id=road.id,
                    coordinates=[[c[0], c[1]] for c in coords],
                )
            )

    points_q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.id.in_(object_ids),
            InfrastructureObject.end_longitude.is_(None),
        )
    )
    points = (await db.execute(points_q)).scalars().all()
    by_id = {p.id: p for p in points}

    terminals: list[PlanTerminalInput] = []
    for oid in object_ids:
        obj = by_id.get(oid)
        if not obj:
            continue
        if obj.subtype in LINE_SUBTYPES or obj.subtype not in POINT_SUBTYPES:
            continue
        if obj.subtype in NODE_CLUSTER_SUBTYPES:
            continue
        terminals.append(
            PlanTerminalInput(
                id=obj.id,
                subtype=obj.subtype,
                name=obj.name or "",
                lon=float(obj.longitude),
                lat=float(obj.latitude),
            )
        )

    return NetworkPlanRequest(
        project_id=project_id,
        terminals=terminals,
        existing_autoroads=existing,
    )
