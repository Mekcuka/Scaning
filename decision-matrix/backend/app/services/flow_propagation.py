"""Propagate annual flow from POI along schematic chains; flag over-capacity nodes."""

from __future__ import annotations

from typing import Any

from app.models import PointOfInterest
from app.services.flow_capacity import NO_CAPACITY_KINDS, _branch_capacity, resolve_separation_share

FLOW_EPS = 1e-6


def _poi_source_flow(poi: PointOfInterest, _poi_node: dict[str, Any]) -> tuple[float | None, str]:
    production = float(poi.planned_production_volume or 0)
    if poi.fluid_type == "gas":
        return (production if production > 0 else None, "thousand_m3_per_year")
    return (production if production > 0 else None, "thousand_t_per_year")


def _branch_flow_from_poi(
    poi: PointOfInterest,
    fluid: str | None,
    separation_share: float | None = None,
) -> tuple[float | None, str]:
    if fluid not in ("oil", "water", "gas"):
        return (None, "thousand_t_per_year")
    return _branch_capacity(
        poi,
        float(poi.planned_production_volume or 0),
        float(poi.water_injection_volume or 0),
        fluid,  # type: ignore[arg-type]
        separation_share=separation_share,
    )


def _outgoing_flow(
    poi: PointOfInterest,
    node: dict[str, Any],
    parent_flow: float,
    parent_unit: str,
    edge_fluid: str | None,
) -> tuple[float, str]:
    kind = node.get("kind", "")
    if kind == "separator":
        return parent_flow, parent_unit
    if kind == "fluid_branch" and node.get("fluid"):
        bf, bu = _branch_flow_from_poi(poi, node.get("fluid"))
        if bf is not None:
            return bf, bu
        return parent_flow, parent_unit
    return parent_flow, parent_unit


def _flow_after_separator(
    poi: PointOfInterest,
    edge_fluid: str | None,
    fallback_flow: float,
    fallback_unit: str,
    separation_share: float,
) -> tuple[float, str]:
    if edge_fluid in ("oil", "water", "gas"):
        bf, bu = _branch_flow_from_poi(poi, edge_fluid, separation_share=separation_share)
        if bf is not None:
            return bf, bu
    return fallback_flow, fallback_unit


def propagate_flows(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    poi: PointOfInterest,
) -> list[dict[str, Any]]:
    """Set flow_annual and over_capacity on each node."""
    node_by_id = {n["id"]: n for n in nodes}
    out_adj: dict[str, list[tuple[str, str | None]]] = {n["id"]: [] for n in nodes}
    for e in edges:
        src, tgt = e.get("source"), e.get("target")
        if src in out_adj and tgt:
            out_adj[src].append((tgt, e.get("fluid")))

    poi_nodes = [n for n in nodes if n.get("kind") == "poi"]
    if not poi_nodes:
        return [_annotate(n, None, None, False) for n in nodes]

    flow_at: dict[str, tuple[float, str]] = {}
    queue: list[str] = []

    for pn in poi_nodes:
        src_flow, src_unit = _poi_source_flow(poi, pn)
        if src_flow is None:
            continue
        flow_at[pn["id"]] = (src_flow, src_unit)
        queue.append(pn["id"])

    head = 0
    while head < len(queue):
        cur_id = queue[head]
        head += 1
        cur_flow, cur_unit = flow_at[cur_id]
        cur_node = node_by_id.get(cur_id, {})
        cur_kind = cur_node.get("kind", "")

        for tgt_id, edge_fluid in out_adj.get(cur_id, []):
            if tgt_id not in node_by_id:
                continue
            if cur_kind == "separator":
                share = resolve_separation_share(cur_node.get("separation_percent"))
                next_flow, next_unit = _flow_after_separator(
                    poi, edge_fluid, cur_flow, cur_unit, separation_share=share
                )
            else:
                tgt_node = node_by_id[tgt_id]
                next_flow, next_unit = _outgoing_flow(
                    poi, tgt_node, cur_flow, cur_unit, edge_fluid
                )

            if tgt_id not in flow_at:
                flow_at[tgt_id] = (next_flow, next_unit)
                queue.append(tgt_id)
            else:
                prev_f, prev_u = flow_at[tgt_id]
                if next_unit == prev_u and next_flow > prev_f:
                    flow_at[tgt_id] = (next_flow, next_unit)

    result: list[dict[str, Any]] = []
    for n in nodes:
        nid = n["id"]
        if nid in flow_at:
            f, u = flow_at[nid]
            cap = n.get("throughput_capacity_annual")
            over = (
                n.get("kind") not in NO_CAPACITY_KINDS
                and cap is not None
                and f > float(cap) + FLOW_EPS
                and (n.get("capacity_unit") or u) == u
            )
            result.append(_annotate(n, f, u, over))
        else:
            result.append(_annotate(n, None, None, False))
    return result


def _annotate(
    node: dict[str, Any],
    flow: float | None,
    unit: str | None,
    over: bool,
) -> dict[str, Any]:
    out = dict(node)
    out["flow_annual"] = flow
    out["flow_unit"] = unit
    out["over_capacity"] = over
    return out
