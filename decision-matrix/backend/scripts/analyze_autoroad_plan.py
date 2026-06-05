#!/usr/bin/env python3
"""Print autoroad network plan geometry stats (lengths, bend warnings) for object IDs."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.database import async_session
from app.services.autoroad_network.planner_adapter import compute_via_network_planner
from app.services.autoroad_network.schemas import (
    ExistingAutoroadInput,
    NetworkPlanRequest,
    PlanTerminalInput,
)


async def _load_terminals(db, project_id: UUID, object_ids: list[UUID]):
    from sqlalchemy import select

    from app.models import InfrastructureObject

    result = await db.execute(
        select(InfrastructureObject).where(
            InfrastructureObject.project_id == project_id,
            InfrastructureObject.id.in_(object_ids),
        )
    )
    rows = list(result.scalars().all())
    by_id = {r.id: r for r in rows}
    terminals: list[PlanTerminalInput] = []
    for oid in object_ids:
        obj = by_id.get(oid)
        if not obj:
            continue
        terminals.append(
            PlanTerminalInput(
                id=obj.id,
                subtype=obj.subtype or "",
                name=obj.name or "",
                lon=float(obj.longitude),
                lat=float(obj.latitude),
            )
        )
    return terminals


async def _load_autoroads(db, project_id: UUID) -> list[ExistingAutoroadInput]:
    from sqlalchemy import select

    from app.models import InfrastructureObject
    from app.services.spatial import line_coords_from_object

    result = await db.execute(
        select(InfrastructureObject).where(
            InfrastructureObject.project_id == project_id,
            InfrastructureObject.subtype == "autoroad",
        )
    )
    roads: list[ExistingAutoroadInput] = []
    for obj in result.scalars().all():
        coords = line_coords_from_object(obj)
        if len(coords) >= 2:
            roads.append(
                ExistingAutoroadInput(
                    id=obj.id,
                    coordinates=[[c[0], c[1]] for c in coords],
                )
            )
    return roads


async def run(project_id: UUID, object_ids: list[UUID]) -> dict:
    async with async_session() as db:
        terminals = await _load_terminals(db, project_id, object_ids)
        roads = await _load_autoroads(db, project_id)
    req = NetworkPlanRequest(
        project_id=project_id,
        terminals=terminals,
        existing_autoroads=roads,
    )
    out = await compute_via_network_planner(req)
    return {
        "total_new_km": out.total_new_km,
        "new_line_count": out.new_line_count,
        "new_node_count": out.new_node_count,
        "warnings": out.warnings,
        "lines": [
            {"kind": ln.kind, "coordinates": ln.coordinates}
            for ln in out.new_lines
        ],
        "nodes": [
            {"lon": n.lon, "lat": n.lat, "reason": n.reason} for n in out.new_nodes
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("project_id", type=UUID)
    parser.add_argument("object_ids", nargs="+", type=UUID)
    args = parser.parse_args()
    report = asyncio.run(run(args.project_id, args.object_ids))
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
