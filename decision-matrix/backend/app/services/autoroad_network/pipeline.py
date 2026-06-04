"""JSON pipeline: request snapshot → compute → apply (no recompute on apply)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import NODE_CLUSTER_SUBTYPES
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.autoroad_connect import (
    MAX_CONNECT_OBJECTS,
    apply_autoroad_connect_plan,
    clear_network_for_rebuild,
)
from app.services.autoroad_network.bridge import (
    connect_plan_to_legacy_dict,
    plan_response_to_connect_plan,
)
from app.services.autoroad_network.client import compute_network_plan
from app.services.autoroad_network.schemas import (
    NetworkPlanRequest,
    NetworkPlanResponse,
)
from app.services.autoroad_network.snapshot import build_plan_request


async def build_request_snapshot(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
    *,
    full_network_rebuild: bool = True,
) -> NetworkPlanRequest:
    """Assemble input JSON for the planner from project DB."""
    if len(object_ids) < 2:
        raise ValueError("need_at_least_two_objects")
    if len(object_ids) > MAX_CONNECT_OBJECTS:
        raise ValueError(f"too_many_objects_max_{MAX_CONNECT_OBJECTS}")

    rows = (
        await db.execute(
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureObject.id.in_(object_ids),
            )
        )
    ).scalars().all()
    for obj in rows:
        if obj.subtype in NODE_CLUSTER_SUBTYPES:
            raise ValueError(f"excluded_terminal_subtype:{obj.subtype}")

    req = await build_plan_request(
        db,
        project_id,
        object_ids,
        use_existing_autoroads=not full_network_rebuild,
    )
    if len(req.terminals) < 2:
        raise ValueError("need_at_least_two_objects")
    return req


async def compute_plan(req: NetworkPlanRequest) -> NetworkPlanResponse:
    """Run planner service; returns solution JSON only."""
    return await compute_network_plan(req)


async def _terminal_coords_from_db(
    db: AsyncSession,
    project_id: UUID,
    terminal_ids: set[UUID],
) -> dict[UUID, tuple[float, float]]:
    if not terminal_ids:
        return {}
    rows = (
        await db.execute(
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureObject.id.in_(terminal_ids),
            )
        )
    ).scalars().all()
    return {o.id: (float(o.longitude), float(o.latitude)) for o in rows}


async def apply_network_plan_response(
    db: AsyncSession,
    project_id: UUID,
    resp: NetworkPlanResponse,
    object_ids: list[UUID],
    *,
    full_network_rebuild: bool = True,
) -> dict[str, Any]:
    """Materialize a precomputed NetworkPlanResponse on the map (no second compute)."""
    preserve = set(object_ids)
    if full_network_rebuild:
        await clear_network_for_rebuild(db, project_id, preserve)

    terminal_ids = {t.id for t in resp.terminals} | preserve
    coords_by_id = await _terminal_coords_from_db(db, project_id, terminal_ids)

    connect_plan = plan_response_to_connect_plan(resp, coords_by_id=coords_by_id)

    if (
        not connect_plan.new_lines
        and not connect_plan.used_existing_edge_ids
        and "need_at_least_two_objects" not in connect_plan.warnings
        and not any(w.startswith("excluded_") for w in connect_plan.warnings)
    ):
        raise ValueError("Не удалось построить соединение между выбранными объектами")

    applied = await apply_autoroad_connect_plan(db, project_id, connect_plan)
    return {
        "plan": resp.model_dump(mode="json"),
        **applied,
    }


async def preview_legacy_dict(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
    *,
    full_network_rebuild: bool = True,
) -> dict[str, Any]:
    """request → compute → legacy AutoroadConnectResponse-shaped dict."""
    req = await build_request_snapshot(
        db, project_id, object_ids, full_network_rebuild=full_network_rebuild
    )
    resp = await compute_plan(req)
    coords = {t.id: (t.lon, t.lat) for t in req.terminals}
    return connect_plan_to_legacy_dict(resp, dry_run=True, coords_by_id=coords)
