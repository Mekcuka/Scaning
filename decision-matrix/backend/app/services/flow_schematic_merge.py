"""Merge auto-calculated flow schematic with saved custom layouts."""

from __future__ import annotations

from typing import Any

from app.models import PointOfInterest
from app.services.flow_propagation import propagate_flows

_AUTO_ID_PREFIXES = ("poi-", "sep-", "branch-", "net-", "term-", "util-", "proc-")
_SYSTEM_KINDS = frozenset(
    {"poi", "separator", "fluid_branch", "process", "network_segment", "terminal", "utilization"}
)


def _is_system_generated_node(node: dict[str, Any]) -> bool:
    kind = node.get("kind", "")
    if kind not in _SYSTEM_KINDS or kind == "custom":
        return False
    node_id = node.get("id", "")
    return any(node_id.startswith(prefix) for prefix in _AUTO_ID_PREFIXES)


def _topology_signature(nodes: list[dict[str, Any]]) -> tuple[tuple[Any, ...], ...]:
    items: list[tuple[Any, ...]] = []
    for node in nodes:
        if not _is_system_generated_node(node):
            continue
        items.append(
            (
                node.get("id"),
                node.get("kind"),
                node.get("label"),
                node.get("fluid"),
                node.get("subtype"),
            )
        )
    return tuple(sorted(items))


def merge_auto_schematic_with_layout(
    auto: dict[str, Any],
    layout_nodes: list[dict[str, Any]],
    layout_edges: list[dict[str, Any]],
    poi: PointOfInterest,
) -> dict[str, Any]:
    """
    Prefer auto topology when engineering rules changed (e.g. new BKNS chain).
    Keep custom positions, capacities, and user-drawn blocks from layout.
    """
    auto_sig = _topology_signature(auto["nodes"])
    layout_sig = _topology_signature(layout_nodes)

    if auto_sig == layout_sig:
        propagated = propagate_flows(layout_nodes, layout_edges, poi)
        return {
            "poi_id": auto["poi_id"],
            "nodes": propagated,
            "edges": layout_edges,
            "warnings": auto.get("warnings", []),
            "source": "custom",
        }

    layout_by_id = {n["id"]: n for n in layout_nodes}
    auto_ids = {n["id"] for n in auto["nodes"]}
    merged_nodes: list[dict[str, Any]] = []

    for node in auto["nodes"]:
        merged = dict(node)
        saved = layout_by_id.get(node["id"])
        if saved:
            if saved.get("position_x") is not None and saved.get("position_y") is not None:
                merged["position_x"] = saved["position_x"]
                merged["position_y"] = saved["position_y"]
            if saved.get("throughput_capacity_annual") is not None:
                merged["throughput_capacity_annual"] = saved["throughput_capacity_annual"]
                merged["capacity_unit"] = saved.get("capacity_unit")
        merged_nodes.append(merged)

    for node in layout_nodes:
        if node["id"] in auto_ids:
            continue
        if node.get("kind") == "custom" or not _is_system_generated_node(node):
            merged_nodes.append(dict(node))

    auto_edge_ids = {e["id"] for e in auto["edges"]}
    merged_edges = list(auto["edges"])
    for edge in layout_edges:
        if edge["id"] not in auto_edge_ids:
            merged_edges.append(dict(edge))

    propagated = propagate_flows(merged_nodes, merged_edges, poi)
    return {
        "poi_id": auto["poi_id"],
        "nodes": propagated,
        "edges": merged_edges,
        "warnings": auto.get("warnings", []),
        "source": "auto",
    }
