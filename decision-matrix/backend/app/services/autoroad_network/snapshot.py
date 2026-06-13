"""Build NetworkPlanRequest snapshot from project database."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import (
    AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES,
    LINE_SUBTYPES,
    MAX_AUTOROAD_NETWORK_OBJECTS,
    POINT_SUBTYPES,
    SUBTYPE_LABELS,
)
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanOptionsInput,
    PlanTerminalInput,
)
from app.services.graph_builder import build_network_from_lines
from app.services.spatial import line_coords_from_object


async def build_plan_request(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
    *,
    use_existing_autoroads: bool = True,
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
    existing: list[ExistingAutoroadInput] = []
    if use_existing_autoroads:
        autoroad_rows = (await db.execute(autoroad_q)).scalars().all()
        for road in autoroad_rows:
            props = road.properties or {}
            if props.get("source") == "autoroad_network":
                continue
            coords = line_coords_from_object(road)
            if len(coords) >= 2:
                existing.append(
                    ExistingAutoroadInput(
                        id=road.id,
                        coordinates=[[c[0], c[1]] for c in coords],
                        name=road.name or "",
                        subtype=road.subtype or "autoroad",
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
        if obj.subtype in AUTOROAD_NETWORK_EXCLUDED_TERMINAL_SUBTYPES:
            continue
        lon = float(obj.longitude)
        lat = float(obj.latitude)
        terminals.append(
            PlanTerminalInput(
                id=obj.id,
                subtype=obj.subtype,
                name=obj.name or "",
                category=obj.category or "",
                subtype_label=SUBTYPE_LABELS.get(obj.subtype, obj.subtype),
                lon=lon,
                lat=lat,
                coordinates=[lon, lat],
                properties=dict(obj.properties or {}),
            )
        )

    terminal_count = len(terminals)
    options = PlanOptionsInput(
        max_terminals=min(MAX_AUTOROAD_NETWORK_OBJECTS, max(2, terminal_count)),
    )

    return NetworkPlanRequest(
        project_id=project_id,
        terminals=terminals,
        existing_autoroads=existing,
        options=options,
    )
