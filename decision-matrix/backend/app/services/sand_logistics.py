"""Sand logistics: road-network distances and quarry allocation (project-level)."""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.entry_date import entry_date_to_iso, is_in_service, read_entry_date
from app.geo.sand_properties import (
    SAND_QUARRY_SUBTYPE,
    is_sand_consumer_subtype,
    read_quarry_volumes,
    read_sand_demand_m3,
)
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
)
from app.services.graph_builder import build_network_from_lines, get_or_create_network
from app.services.line_endpoint_rules import ENDPOINT_SNAP_TOLERANCE_KM
from app.services.spatial import closest_point_on_segment, haversine_km, line_coords_from_object

_EPS_KM = 0.001


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class _PointSite:
    object_id: UUID
    name: str
    subtype: str
    lon: float
    lat: float
    demand_m3: float = 0.0
    initial_m3: float = 0.0
    current_m3: float = 0.0
    entry_date: date = field(default_factory=lambda: date(2020, 1, 1))
    in_service: bool = True
    node_id: UUID | None = None


@dataclass
class _RoadGraph:
    adj: dict[UUID, list[tuple[UUID, float]]] = field(default_factory=dict)
    coords: dict[UUID, tuple[float, float]] = field(default_factory=dict)


def _add_undirected_edge(g: _RoadGraph, a: UUID, b: UUID, weight: float) -> None:
    g.adj.setdefault(a, []).append((b, weight))
    g.adj.setdefault(b, []).append((a, weight))


def _dijkstra(g: _RoadGraph, start: UUID) -> dict[UUID, float]:
    dist: dict[UUID, float] = {start: 0.0}
    heap: list[tuple[float, UUID]] = [(0.0, start)]
    while heap:
        d, u = heapq.heappop(heap)
        if d > dist.get(u, math.inf):
            continue
        for v, w in g.adj.get(u, []):
            nd = d + w
            if nd < dist.get(v, math.inf):
                dist[v] = nd
                heapq.heappush(heap, (nd, v))
    return dist


def _nearest_autoroad_node(
    g: _RoadGraph,
    lon: float,
    lat: float,
    *,
    max_km: float = ENDPOINT_SNAP_TOLERANCE_KM,
) -> tuple[UUID | None, float]:
    """Snap only to vertices of the autoroad graph within max_km (same as line endpoints)."""
    best_id: UUID | None = None
    best_d = math.inf
    for nid in g.adj:
        coord = g.coords.get(nid)
        if not coord:
            continue
        nlon, nlat = coord
        d = _haversine_km(lon, lat, nlon, nlat)
        if d < best_d:
            best_d = d
            best_id = nid
    if best_id is None or best_d > max_km:
        return None, best_d if best_d < math.inf else math.inf
    return best_id, best_d


def _distance_to_autoroad_polylines(
    lon: float,
    lat: float,
    polylines: list[list[tuple[float, float]]],
) -> float:
    best = math.inf
    for coords in polylines:
        if len(coords) < 2:
            continue
        for i in range(len(coords) - 1):
            a = coords[i]
            b = coords[i + 1]
            clon, clat = closest_point_on_segment(lon, lat, a[0], a[1], b[0], b[1])
            d = haversine_km(lon, lat, clon, clat)
            if d < best:
                best = d
    return best


def _snap_site_to_autoroad_network(
    g: _RoadGraph,
    lon: float,
    lat: float,
    polylines: list[list[tuple[float, float]]],
    *,
    max_km: float = ENDPOINT_SNAP_TOLERANCE_KM,
) -> tuple[UUID | None, float]:
    """Object is on the network only if within max_km of an in-service autoroad polyline."""
    line_dist = _distance_to_autoroad_polylines(lon, lat, polylines)
    if line_dist > max_km:
        return None, line_dist
    nid, _ = _nearest_autoroad_node(g, lon, lat, max_km=max_km)
    return nid, line_dist


def _nearest_node(g: _RoadGraph, lon: float, lat: float) -> tuple[UUID | None, float]:
    """Nearest graph coordinate (any node) — for display distance only."""
    best_id: UUID | None = None
    best_d = math.inf
    for nid, (nlon, nlat) in g.coords.items():
        d = _haversine_km(lon, lat, nlon, nlat)
        if d < best_d:
            best_d = d
            best_id = nid
    if best_id is None:
        return None, math.inf
    return best_id, best_d


def _connected_components(adj: dict[UUID, list[tuple[UUID, float]]]) -> list[set[UUID]]:
    seen: set[UUID] = set()
    components: list[set[UUID]] = []
    for start in adj:
        if start in seen:
            continue
        stack = [start]
        comp: set[UUID] = set()
        while stack:
            u = stack.pop()
            if u in comp:
                continue
            comp.add(u)
            for v, _ in adj.get(u, []):
                if v not in comp:
                    stack.append(v)
        seen |= comp
        if comp:
            components.append(comp)
    return components


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

    for c in sorted(active_consumers, key=lambda x: dist_by_consumer.get(x.object_id, math.inf)):
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


async def analyze_sand_logistics(
    db: AsyncSession,
    project_id: UUID,
    *,
    rebuild_network: bool = True,
    as_of: date | None = None,
) -> dict[str, Any]:
    global_warnings: list[str] = []
    calc_date = as_of or date.today()

    if rebuild_network:
        await build_network_from_lines(db, project_id)

    net = await db.scalar(
        select(InfrastructureNetwork).where(InfrastructureNetwork.project_id == project_id).limit(1)
    )
    if not net:
        net = await get_or_create_network(db, project_id)

    nodes = (
        await db.execute(select(InfrastructureNode).where(InfrastructureNode.network_id == net.id))
    ).scalars().all()
    db_edges = (
        await db.execute(select(InfrastructureEdge).where(InfrastructureEdge.network_id == net.id))
    ).scalars().all()

    obj_ids = {e.infrastructure_object_id for e in db_edges if e.infrastructure_object_id}
    subtype_by_obj: dict[UUID, str] = {}
    entry_by_obj: dict[UUID, date] = {}
    if obj_ids:
        rows = (
            await db.execute(
                select(
                    InfrastructureObject.id,
                    InfrastructureObject.subtype,
                    InfrastructureObject.properties,
                ).where(InfrastructureObject.id.in_(obj_ids))
            )
        ).all()
        for oid, st, props in rows:
            subtype_by_obj[oid] = st
            entry_by_obj[oid] = read_entry_date(props)

    g = _RoadGraph()
    for n in nodes:
        g.coords[n.id] = (n.longitude, n.latitude)
    for edge in db_edges:
        if edge.infrastructure_object_id is None:
            continue
        if subtype_by_obj.get(edge.infrastructure_object_id) != "autoroad":
            continue
        road_entry = entry_by_obj.get(edge.infrastructure_object_id)
        if road_entry is not None and not is_in_service(road_entry, calc_date):
            continue
        w = max(float(edge.length_km or 0), 0.0)
        if w <= 0:
            continue
        _add_undirected_edge(g, edge.from_node_id, edge.to_node_id, w)

    if not g.adj:
        global_warnings.append("no_autoroad_network")

    autoroad_lines_q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureLayer.is_visible.is_(True),
            InfrastructureObject.end_longitude.isnot(None),
            InfrastructureObject.subtype == "autoroad",
        )
    )
    autoroad_polylines: list[list[tuple[float, float]]] = []
    for road in (await db.execute(autoroad_lines_q)).scalars().all():
        road_entry = read_entry_date(road.properties)
        if not is_in_service(road_entry, calc_date):
            continue
        coords = line_coords_from_object(road)
        if len(coords) >= 2:
            autoroad_polylines.append(coords)

    infra_q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureLayer.is_visible.is_(True),
            InfrastructureObject.end_longitude.is_(None),
        )
    )
    infra_points = (await db.execute(infra_q)).scalars().all()

    all_quarries: list[_PointSite] = []
    all_consumers: list[_PointSite] = []

    for obj in infra_points:
        entry = read_entry_date(obj.properties)
        active = is_in_service(entry, calc_date)
        if obj.subtype == SAND_QUARRY_SUBTYPE:
            initial, current = read_quarry_volumes(obj.properties)
            all_quarries.append(
                _PointSite(
                    object_id=obj.id,
                    name=obj.name,
                    subtype=obj.subtype,
                    lon=obj.longitude,
                    lat=obj.latitude,
                    initial_m3=initial,
                    current_m3=current,
                    entry_date=entry,
                    in_service=active,
                )
            )
            if not active:
                global_warnings.append(f"not_in_service:{obj.id}")
        elif is_sand_consumer_subtype(obj.subtype):
            demand = read_sand_demand_m3(obj.properties)
            if demand <= 0:
                continue
            all_consumers.append(
                _PointSite(
                    object_id=obj.id,
                    name=obj.name,
                    subtype=obj.subtype,
                    lon=obj.longitude,
                    lat=obj.latitude,
                    demand_m3=demand,
                    entry_date=entry,
                    in_service=active,
                )
            )
            if not active:
                global_warnings.append(f"not_in_service:{obj.id}")

    if not all_quarries:
        global_warnings.append("no_sand_quarries")
    if not all_consumers:
        global_warnings.append("no_sand_consumers")

    for site in all_quarries + all_consumers:
        nid, snap_km = _snap_site_to_autoroad_network(
            g, site.lon, site.lat, autoroad_polylines
        )
        site.node_id = nid
        if nid is None:
            if autoroad_polylines and snap_km < math.inf:
                global_warnings.append(f"too_far_from_autoroad:{site.object_id}")
            else:
                global_warnings.append(f"no_graph_node:{site.object_id}")

    components = _connected_components(g.adj)
    quarry_subnet_node_sets: list[set[UUID]] = []
    for comp in components:
        if any(q.node_id in comp for q in all_quarries):
            quarry_subnet_node_sets.append(comp)

    assigned_sites: set[UUID] = set()
    subnets: list[dict[str, Any]] = []

    for idx, comp in enumerate(quarry_subnet_node_sets, start=1):
        subnet_quarries = [q for q in all_quarries if q.node_id in comp]
        subnet_consumers = [c for c in all_consumers if c.node_id in comp]
        for s in subnet_quarries + subnet_consumers:
            assigned_sites.add(s.object_id)

        subnets.append(
            _analyze_subnet(
                g,
                subnet_quarries,
                subnet_consumers,
                db_edges,
                subtype_by_obj,
                component=comp,
                subnet_index=idx,
            )
        )

    for q in all_quarries:
        if q.object_id in assigned_sites:
            continue
        if q.node_id is None:
            continue
        global_warnings.append(f"not_in_quarry_subnet:{q.object_id}")

    for c in all_consumers:
        if c.object_id in assigned_sites:
            continue
        if c.node_id is None:
            continue
        global_warnings.append(f"not_in_quarry_subnet:{c.object_id}")

    for comp in components:
        if any(q.node_id in comp for q in all_quarries):
            continue
        for c in all_consumers:
            if c.node_id in comp:
                global_warnings.append(f"no_quarry_in_subnet:{c.object_id}")
        for q in all_quarries:
            if q.node_id in comp:
                global_warnings.append(f"no_quarry_in_subnet:{q.object_id}")

    if not subnets and all_quarries:
        global_warnings.append("no_connected_quarry_subnets")

    return {
        "project_id": str(project_id),
        "as_of": entry_date_to_iso(calc_date),
        "network_id": str(net.id),
        "subnet_count": len(subnets),
        "subnets": subnets,
        "warnings": list(dict.fromkeys(global_warnings)),
        "object_names": {
            str(s.object_id): s.name for s in all_quarries + all_consumers if s.name
        },
    }
