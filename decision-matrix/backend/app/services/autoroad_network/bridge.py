"""Convert NetworkPlanResponse to legacy AutoroadConnectPlan for apply."""

from __future__ import annotations

from uuid import UUID

from app.services.autoroad_connect import (
    AutoroadConnectPlan,
    PlannedLine,
    PlannedNode,
    PlannedSplit,
    TerminalSnap,
)
from app.services.autoroad_network.schemas import NetworkPlanResponse


def plan_response_to_connect_plan(
    resp: NetworkPlanResponse,
    *,
    coords_by_id: dict[UUID, tuple[float, float]] | None = None,
) -> AutoroadConnectPlan:
    plan = AutoroadConnectPlan()
    plan.warnings = list(resp.warnings)
    plan.used_existing_edge_ids = list(resp.used_existing_edge_ids)
    plan.total_new_km = resp.total_new_km

    for t in resp.terminals:
        gid: UUID | None = None
        if t.graph_node_id:
            try:
                gid = UUID(t.graph_node_id)
            except ValueError:
                gid = None
        lon, lat = (coords_by_id or {}).get(t.id, (0.0, 0.0))
        plan.terminals.append(
            TerminalSnap(
                object_id=t.id,
                name=t.name,
                lon=lon,
                lat=lat,
                graph_node_id=gid,
                snap_lon=t.snap_lon,
                snap_lat=t.snap_lat,
                warning=t.warning,
            )
        )

    for ln in resp.new_lines:
        if len(ln.coordinates) < 2:
            continue
        plan.new_lines.append(
            PlannedLine(
                start_lon=ln.coordinates[0][0],
                start_lat=ln.coordinates[0][1],
                end_lon=ln.coordinates[-1][0],
                end_lat=ln.coordinates[-1][1],
                snap_start_object_id=ln.snap_start_object_id,
                snap_finish_object_id=ln.snap_finish_object_id,
                kind=ln.kind,
            )
        )

    for sp in resp.splits:
        plan.splits.append(
            PlannedSplit(
                line_id=sp.line_id,
                segment_index=sp.segment_index,
                split_lon=sp.split_lon,
                split_lat=sp.split_lat,
            )
        )

    for nd in resp.new_nodes:
        plan.new_nodes.append(PlannedNode(lon=nd.lon, lat=nd.lat, reason=nd.reason))

    return plan


def connect_plan_to_legacy_dict(
    resp: NetworkPlanResponse,
    *,
    dry_run: bool,
    applied: dict | None = None,
    coords_by_id: dict[UUID, tuple[float, float]] | None = None,
) -> dict:
    plan = plan_response_to_connect_plan(resp, coords_by_id=coords_by_id)
    out = plan.to_response_dict()
    out["dry_run"] = dry_run
    if applied:
        out.update(applied)
    return out
