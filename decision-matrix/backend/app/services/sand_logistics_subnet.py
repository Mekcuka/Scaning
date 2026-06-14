"""Per-subnet sand logistics analysis (distances, allocation)."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from app.geo.entry_date import entry_date_to_iso
from app.models import InfrastructureEdge
from app.services.road_graph import (
    RoadGraph as _RoadGraph,
    dijkstra as _dijkstra,
    nearest_node as _nearest_node,
)

_EPS_KM = 0.001


@dataclass
class _PointSite:
    object_id: UUID
    name: str
    subtype: str
    lon: float
    lat: float
    demand_m3: float = 0.0
    demand_plan_total_m3: float = 0.0
    demand_by_year_m3: dict[str, float] = field(default_factory=dict)
    initial_m3: float = 0.0
    current_m3: float = 0.0
    entry_date: date = field(default_factory=lambda: date(2020, 1, 1))
    in_service: bool = True
    node_id: UUID | None = None


def _subnet_name(quarries: list[_PointSite], index: int) -> str:
    names = [q.name for q in quarries[:3] if q.name]
    if not names:
        return f"Подсеть {index}"
    label = ", ".join(names)
    if len(quarries) > 3:
        label += "…"
    return f"Подсеть {index}: {label}"


def _network_topology_for_component(
    component: set[UUID],
    g: _RoadGraph,
    db_edges: list[InfrastructureEdge],
    subtype_by_obj: dict[UUID, str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    network_nodes_out = [
        {
            "id": str(nid),
            "lon": round(g.coords[nid][0], 6),
            "lat": round(g.coords[nid][1], 6),
        }
        for nid in component
        if nid in g.coords
    ]
    network_edges_out: list[dict[str, Any]] = []
    seen_pairs: set[tuple[str, str]] = set()
    for edge in db_edges:
        if edge.infrastructure_object_id is None:
            continue
        if subtype_by_obj.get(edge.infrastructure_object_id) != "autoroad":
            continue
        if edge.from_node_id not in component or edge.to_node_id not in component:
            continue
        a, b = str(edge.from_node_id), str(edge.to_node_id)
        key = tuple(sorted((a, b)))
        if key in seen_pairs:
            continue
        seen_pairs.add(key)
        network_edges_out.append(
            {
                "id": str(edge.id),
                "from_node_id": a,
                "to_node_id": b,
                "length_km": round(float(edge.length_km or 0), 2),
            }
        )
    return network_nodes_out, network_edges_out


def _analyze_subnet(
    g: _RoadGraph,
    quarries: list[_PointSite],
    consumers: list[_PointSite],
    db_edges: list[InfrastructureEdge],
    subtype_by_obj: dict[UUID, str],
    *,
    component: set[UUID],
    subnet_index: int,
) -> dict[str, Any]:
    warnings: list[str] = []
    quarries = [q for q in quarries if q.node_id in component]
    consumers = [c for c in consumers if c.node_id in component]
    quarry_by_id = {q.object_id: q for q in quarries}
    active_quarries = [q for q in quarries if q.in_service]
    active_consumers = [c for c in consumers if c.in_service]

    dist_from_quarry: dict[UUID, dict[UUID, float]] = {}
    for q in active_quarries:
        if not q.node_id or q.node_id not in g.adj:
            continue
        dist_from_quarry[q.object_id] = _dijkstra(g, q.node_id)

    consumer_rows: list[dict[str, Any]] = []
    for c in consumers:
        best_q: UUID | None = None
        best_dist = math.inf
        dists_to_quarries: dict[str, float | None] = {}

        if c.node_id and c.node_id in component:
            for q in active_quarries:
                d = dist_from_quarry.get(q.object_id, {}).get(c.node_id, math.inf)
                dists_to_quarries[str(q.object_id)] = round(d, 2) if d < math.inf else None
                if d < best_dist:
                    best_dist = d
                    best_q = q.object_id

        _, snap_km = _nearest_node(g, c.lon, c.lat)
        network_km = best_dist if best_dist < math.inf else None
        if network_km is None and c.demand_m3 > 0 and c.in_service:
            warnings.append(f"no_path:{c.object_id}")

        consumer_rows.append(
            {
                "object_id": str(c.object_id),
                "name": c.name,
                "subtype": c.subtype,
                "lon": round(c.lon, 6),
                "lat": round(c.lat, 6),
                "snap_node_id": str(c.node_id) if c.node_id else None,
                "demand_m3": round(c.demand_m3, 2),
                "demand_plan_total_m3": round(c.demand_plan_total_m3, 2),
                "demand_by_year_m3": {k: round(v, 2) for k, v in sorted(c.demand_by_year_m3.items())},
                "entry_date": entry_date_to_iso(c.entry_date),
                "in_service": c.in_service,
                "nearest_quarry_id": str(best_q) if best_q else None,
                "nearest_quarry_name": quarry_by_id[best_q].name if best_q else None,
                "distance_km": round(network_km, 2) if network_km is not None else None,
                "snap_to_node_km": round(snap_km, 2) if snap_km < math.inf else None,
                "distances_to_quarries_km": dists_to_quarries,
            }
        )

    quarry_remaining = {q.object_id: q.current_m3 for q in active_quarries}
    greedy_by_consumer: dict[UUID, tuple[UUID | None, float]] = {}
    dist_by_consumer: dict[UUID, float] = {}
    for row in consumer_rows:
        if not row["in_service"]:
            continue
        if row["distance_km"] is not None:
            dist_by_consumer[UUID(row["object_id"])] = float(row["distance_km"])

    for c in sorted(
        active_consumers,
        key=lambda x: (
            dist_by_consumer.get(x.object_id, math.inf),
            x.entry_date,
            str(x.object_id),
        ),
    ):
        row = next(r for r in consumer_rows if r["object_id"] == str(c.object_id))
        qid_str = row.get("nearest_quarry_id")
        if not qid_str:
            greedy_by_consumer[c.object_id] = (None, 0.0)
            continue
        qid = UUID(qid_str)
        need = c.demand_m3
        avail = quarry_remaining.get(qid, 0.0)
        take = min(need, avail)
        quarry_remaining[qid] = avail - take
        greedy_by_consumer[c.object_id] = (qid, take)
        if take < need - 1e-6:
            warnings.append(f"unmet_demand:{c.object_id}")

    proportional_to_quarry: dict[UUID, float] = {q.object_id: 0.0 for q in active_quarries}
    for c in active_consumers:
        if not c.node_id:
            continue
        weights: list[tuple[UUID, float]] = []
        for q in active_quarries:
            d = dist_from_quarry.get(q.object_id, {}).get(c.node_id, math.inf)
            if d >= math.inf:
                continue
            weights.append((q.object_id, 1.0 / max(d, _EPS_KM)))
        total_w = sum(w for _, w in weights)
        if total_w <= 0:
            continue
        for qid, w in weights:
            proportional_to_quarry[qid] += c.demand_m3 * (w / total_w)

    quarry_summary: list[dict[str, Any]] = []
    for q in quarries:
        greedy_alloc = (
            q.current_m3 - quarry_remaining.get(q.object_id, q.current_m3)
            if q.in_service
            else 0.0
        )
        prop_alloc = proportional_to_quarry.get(q.object_id, 0.0)
        quarry_summary.append(
            {
                "object_id": str(q.object_id),
                "name": q.name,
                "lon": round(q.lon, 6),
                "lat": round(q.lat, 6),
                "snap_node_id": str(q.node_id) if q.node_id else None,
                "entry_date": entry_date_to_iso(q.entry_date),
                "in_service": q.in_service,
                "initial_m3": round(q.initial_m3, 2),
                "current_m3": round(q.current_m3, 2),
                "greedy_allocated_m3": round(greedy_alloc, 2),
                "greedy_remaining_m3": round(
                    quarry_remaining.get(q.object_id, q.current_m3 if q.in_service else 0.0),
                    2,
                ),
                "proportional_allocated_m3": round(prop_alloc, 2),
                "proportional_exceeds_capacity": prop_alloc > q.current_m3 + 1e-6,
            }
        )

    for row in consumer_rows:
        oid = UUID(row["object_id"])
        c_site = next(x for x in consumers if x.object_id == oid)
        if not c_site.in_service:
            row["greedy_quarry_id"] = None
            row["greedy_quarry_name"] = None
            row["greedy_allocated_m3"] = 0.0
            row["proportional_allocations"] = []
            continue

        gqid, galloc = greedy_by_consumer.get(oid, (None, 0.0))
        row["greedy_quarry_id"] = str(gqid) if gqid else None
        row["greedy_quarry_name"] = quarry_by_id[gqid].name if gqid else None
        row["greedy_allocated_m3"] = round(galloc, 2)

        prop_parts: list[dict[str, Any]] = []
        if c_site.node_id:
            weights = []
            for q in active_quarries:
                d = dist_from_quarry.get(q.object_id, {}).get(c_site.node_id, math.inf)
                if d >= math.inf:
                    continue
                weights.append((q.object_id, 1.0 / max(d, _EPS_KM)))
            total_w = sum(w for _, w in weights)
            if total_w > 0:
                for qid, w in weights:
                    d_km = dist_from_quarry.get(qid, {}).get(c_site.node_id, math.inf)
                    prop_parts.append(
                        {
                            "quarry_id": str(qid),
                            "quarry_name": quarry_by_id[qid].name,
                            "allocated_m3": round(c_site.demand_m3 * (w / total_w), 2),
                            "distance_km": round(d_km, 2) if d_km < math.inf else None,
                        }
                    )
        row["proportional_allocations"] = prop_parts

    network_nodes_out, network_edges_out = _network_topology_for_component(
        component, g, db_edges, subtype_by_obj
    )

    return {
        "subnet_index": subnet_index,
        "name": _subnet_name(quarries, subnet_index),
        "autoroad_edge_count": len(network_edges_out),
        "quarry_count": len(quarries),
        "consumer_count": len(consumers),
        "network_nodes": network_nodes_out,
        "network_edges": network_edges_out,
        "quarries": quarry_summary,
        "consumers": consumer_rows,
        "warnings": list(dict.fromkeys(warnings)),
    }
