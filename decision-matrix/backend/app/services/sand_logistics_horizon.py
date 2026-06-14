"""Year-by-year sand logistics horizon simulation."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from uuid import UUID

from app.geo.entry_date import entry_date_to_iso, is_in_service
from app.geo.sand_properties import (
    demand_increment_for_year,
    sand_demand_plan_total_m3,
)
from app.models import InfrastructureEdge
from app.services.sand_logistics_subnet import _PointSite, _analyze_subnet
from app.services.road_graph import (
    RoadGraph as _RoadGraph,
    connected_components as _connected_components,
    dijkstra as _dijkstra,
    snap_site_to_autoroad_network as _snap_site_to_autoroad_network,
)

_EPS_KM = 0.001


@dataclass
class _ConsumerSimState:
    site: _PointSite
    properties: dict[str, Any]
    demand_by_year: dict[str, float] = field(default_factory=dict)
    allocation_by_year: dict[str, float] = field(default_factory=dict)
    cumulative_demand: float = 0.0
    cumulative_allocated: float = 0.0
    greedy_quarry_id: UUID | None = None


@dataclass
class _QuarrySimState:
    site: _PointSite
    remaining: float = 0.0
    introduced: bool = False
    cumulative_allocated: float = 0.0


def _year_end(year: int) -> date:
    return date(year, 12, 31)


def _timeline_totals(subnets: list[dict[str, Any]]) -> tuple[float, float, float]:
    total_demand = 0.0
    total_allocated = 0.0
    for subnet in subnets:
        for c in subnet.get("consumers", []):
            if c.get("in_service"):
                total_demand += float(c.get("demand_m3") or 0)
                total_allocated += float(c.get("greedy_allocated_m3") or 0)
    return total_demand, total_allocated, max(0.0, total_demand - total_allocated)


def _display_subnet_components(
    components: list[set[UUID]],
    all_quarries: list[_PointSite],
    all_consumers: list[tuple[_PointSite, dict[str, Any]]],
    *,
    year_end: date,
) -> list[set[UUID]]:
    """Components to show on schematic: any with quarry or in-service consumer."""
    display: list[set[UUID]] = []
    for comp in components:
        has_quarry = any(q.node_id in comp for q in all_quarries if q.node_id)
        has_consumer = any(
            c.node_id in comp
            for c, _ in all_consumers
            if c.node_id and is_in_service(c.entry_date, year_end)
        )
        if has_quarry or has_consumer:
            display.append(comp)
    return display


def _accrue_year_demand(
    *,
    year: int,
    year_end: date,
    consumer_sims: dict[UUID, _ConsumerSimState],
) -> None:
    """Phase A: accrue demand for all in-service consumers (independent of subnet)."""
    year_key = str(year)
    for cs in consumer_sims.values():
        if not is_in_service(cs.site.entry_date, year_end):
            continue
        increment = demand_increment_for_year(cs.properties, cs.site.entry_date, year)
        if increment <= 1e-6:
            continue
        cs.demand_by_year[year_key] = round(
            cs.demand_by_year.get(year_key, 0.0) + increment, 2
        )
        cs.cumulative_demand = round(cs.cumulative_demand + increment, 2)


def _run_year_allocation(
    *,
    year: int,
    g: _RoadGraph,
    component: set[UUID],
    quarry_sims: list[_QuarrySimState],
    consumer_sims: list[_ConsumerSimState],
) -> None:
    """Phase B: greedy allocation of outstanding (cumulative unmet) demand."""
    year_end = _year_end(year)
    subnet_qs = [qs for qs in quarry_sims if qs.site.node_id in component]
    subnet_cs = [cs for cs in consumer_sims if cs.site.node_id in component]

    active_quarries = [
        qs
        for qs in subnet_qs
        if is_in_service(qs.site.entry_date, year_end) and qs.site.node_id
    ]
    for qs in active_quarries:
        if not qs.introduced:
            qs.remaining += qs.site.current_m3
            qs.introduced = True

    dist_from_quarry: dict[UUID, dict[UUID, float]] = {}
    for qs in active_quarries:
        if qs.site.node_id and qs.remaining > 1e-6:
            dist_from_quarry[qs.site.object_id] = _dijkstra(g, qs.site.node_id)

    pending: list[tuple[_ConsumerSimState, float, float]] = []
    for cs in subnet_cs:
        if not is_in_service(cs.site.entry_date, year_end) or not cs.site.node_id:
            continue
        outstanding = cs.cumulative_demand - cs.cumulative_allocated
        if outstanding <= 1e-6:
            continue
        dist = math.inf
        for qs in active_quarries:
            d = dist_from_quarry.get(qs.site.object_id, {}).get(cs.site.node_id, math.inf)
            if d < dist:
                dist = d
        pending.append((cs, outstanding, dist))

    pending.sort(
        key=lambda x: (
            x[2],
            x[0].site.entry_date,
            str(x[0].site.object_id),
        )
    )

    year_key = str(year)
    for cs, need, _ in pending:
        best_q: UUID | None = None
        best_dist = math.inf
        for qs in active_quarries:
            if qs.remaining <= 1e-6:
                continue
            d = dist_from_quarry.get(qs.site.object_id, {}).get(cs.site.node_id, math.inf)
            if d < best_dist:
                best_dist = d
                best_q = qs.site.object_id
        if best_q is None:
            continue
        qs = next(x for x in active_quarries if x.site.object_id == best_q)
        take = min(need, qs.remaining)
        qs.remaining -= take
        qs.cumulative_allocated += take
        cs.allocation_by_year[year_key] = round(
            cs.allocation_by_year.get(year_key, 0.0) + take, 2
        )
        cs.cumulative_allocated = round(cs.cumulative_allocated + take, 2)
        if take > 1e-6:
            cs.greedy_quarry_id = best_q


def _build_subnet_snapshot(
    *,
    year: int,
    year_end: date,
    g: _RoadGraph,
    quarries: list[_PointSite],
    consumers: list[_PointSite],
    quarry_sims: dict[UUID, _QuarrySimState],
    consumer_sims: dict[UUID, _ConsumerSimState],
    db_edges: list[InfrastructureEdge],
    subtype_by_obj: dict[UUID, str],
    component: set[UUID],
    subnet_index: int,
) -> dict[str, Any]:
    """Build subnet API snapshot at year-end from simulation state."""
    subnet_quarries = [q for q in quarries if q.node_id in component]
    subnet_consumers = [c for c in consumers if c.node_id in component]

    snapshot_quarries: list[_PointSite] = []
    for q in subnet_quarries:
        qs = quarry_sims[q.object_id]
        in_svc = is_in_service(q.entry_date, year_end)
        snapshot_quarries.append(
            _PointSite(
                object_id=q.object_id,
                name=q.name,
                subtype=q.subtype,
                lon=q.lon,
                lat=q.lat,
                initial_m3=q.initial_m3,
                current_m3=q.current_m3,
                entry_date=q.entry_date,
                in_service=in_svc,
                node_id=q.node_id,
            )
        )

    snapshot_consumers: list[_PointSite] = []
    for c in subnet_consumers:
        cs = consumer_sims[c.object_id]
        in_svc = is_in_service(c.entry_date, year_end)
        eff, plan_total, breakdown = (
            cs.cumulative_demand,
            sand_demand_plan_total_m3(cs.properties),
            dict(cs.demand_by_year),
        )
        snapshot_consumers.append(
            _PointSite(
                object_id=c.object_id,
                name=c.name,
                subtype=c.subtype,
                lon=c.lon,
                lat=c.lat,
                demand_m3=eff if in_svc else 0.0,
                demand_plan_total_m3=plan_total,
                demand_by_year_m3=breakdown,
                entry_date=c.entry_date,
                in_service=in_svc,
                node_id=c.node_id,
            )
        )

    base = _analyze_subnet(
        g,
        snapshot_quarries,
        snapshot_consumers,
        db_edges,
        subtype_by_obj,
        component=component,
        subnet_index=subnet_index,
    )

    quarry_by_id = {q.object_id: q for q in snapshot_quarries}
    for row in base.get("quarries", []):
        oid = UUID(row["object_id"])
        qs = quarry_sims.get(oid)
        if not qs:
            continue
        in_svc = is_in_service(quarry_by_id[oid].entry_date, year_end)
        row["greedy_allocated_m3"] = round(qs.cumulative_allocated, 2)
        row["greedy_remaining_m3"] = round(qs.remaining if in_svc else 0.0, 2)

    for row in base.get("consumers", []):
        oid = UUID(row["object_id"])
        cs = consumer_sims.get(oid)
        if not cs:
            continue
        row["demand_m3"] = round(cs.cumulative_demand if row.get("in_service") else 0.0, 2)
        row["demand_by_year_m3"] = {
            k: round(v, 2) for k, v in sorted(cs.demand_by_year.items())
        }
        row["allocation_by_year_m3"] = {
            k: round(v, 2) for k, v in sorted(cs.allocation_by_year.items())
        }
        row["greedy_allocated_m3"] = round(cs.cumulative_allocated, 2)
        if cs.greedy_quarry_id:
            row["greedy_quarry_id"] = str(cs.greedy_quarry_id)
            q = quarry_by_id.get(cs.greedy_quarry_id)
            row["greedy_quarry_name"] = q.name if q else None
        else:
            row["greedy_quarry_id"] = None
            row["greedy_quarry_name"] = None

    # Drop one-shot greedy unmet flags: snapshot uses full quarry current_m3, not sim remaining.
    base["warnings"] = [
        w
        for w in base.get("warnings", [])
        if not (isinstance(w, str) and w.startswith("unmet_demand:"))
    ]
    extra_warnings: list[str] = []
    for row in base.get("consumers", []):
        if not row.get("in_service"):
            continue
        oid = UUID(row["object_id"])
        cs = consumer_sims.get(oid)
        if not cs:
            continue
        if cs.cumulative_demand > cs.cumulative_allocated + 1e-6:
            extra_warnings.append(f"unmet_demand:{oid}")
    if extra_warnings:
        base["warnings"] = list(dict.fromkeys([*base.get("warnings", []), *extra_warnings]))

    return base


def _build_waiting_off_network_snapshot(
    *,
    year_end: date,
    waiting: list[tuple[_PointSite, _ConsumerSimState]],
    subnet_index: int,
) -> dict[str, Any]:
    """Consumers with accrued demand but not on any displayed network component."""
    consumer_rows: list[dict[str, Any]] = []
    warnings: list[str] = []
    for c, cs in waiting:
        if not is_in_service(c.entry_date, year_end):
            continue
        consumer_rows.append(
            {
                "object_id": str(c.object_id),
                "name": c.name,
                "subtype": c.subtype,
                "lon": round(c.lon, 6),
                "lat": round(c.lat, 6),
                "snap_node_id": str(c.node_id) if c.node_id else None,
                "demand_m3": round(cs.cumulative_demand, 2),
                "demand_plan_total_m3": round(sand_demand_plan_total_m3(cs.properties), 2),
                "demand_by_year_m3": {
                    k: round(v, 2) for k, v in sorted(cs.demand_by_year.items())
                },
                "entry_date": entry_date_to_iso(c.entry_date),
                "in_service": True,
                "nearest_quarry_id": None,
                "nearest_quarry_name": None,
                "distance_km": None,
                "snap_to_node_km": None,
                "distances_to_quarries_km": {},
                "greedy_quarry_id": None,
                "greedy_quarry_name": None,
                "greedy_allocated_m3": round(cs.cumulative_allocated, 2),
                "allocation_by_year_m3": {
                    k: round(v, 2) for k, v in sorted(cs.allocation_by_year.items())
                },
                "proportional_allocations": [],
            }
        )
        if cs.cumulative_demand > cs.cumulative_allocated + 1e-6:
            warnings.append(f"unmet_demand:{c.object_id}")
        if c.node_id is None:
            warnings.append(f"no_graph_node:{c.object_id}")
        else:
            warnings.append(f"not_in_quarry_subnet:{c.object_id}")

    names = [c.name for c, _ in waiting[:3] if c.name]
    label = ", ".join(names) if names else "ожидание"
    return {
        "subnet_index": subnet_index,
        "name": f"Подсеть {subnet_index}: {label}",
        "autoroad_edge_count": 0,
        "quarry_count": 0,
        "consumer_count": len(consumer_rows),
        "network_nodes": [],
        "network_edges": [],
        "quarries": [],
        "consumers": consumer_rows,
        "warnings": list(dict.fromkeys(warnings)),
    }


def simulate_sand_horizon(
    *,
    horizon_from: date,
    horizon_to: date,
    view_as_of: date,
    all_quarries: list[_PointSite],
    all_consumers: list[tuple[_PointSite, dict[str, Any]]],
    build_graph_at: Any,
    build_polylines_at: Any,
    db_edges: list[InfrastructureEdge],
    subtype_by_obj: dict[UUID, str],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    """
    Run yearly simulation; return (timeline, subnets_at_view_as_of, warnings).
    """
    if horizon_to < horizon_from:
        horizon_to = horizon_from

    quarry_sims = {
        q.object_id: _QuarrySimState(site=q) for q in all_quarries
    }
    consumer_sims = {
        c.object_id: _ConsumerSimState(site=c, properties=props)
        for c, props in all_consumers
    }

    warnings: list[str] = []
    timeline: list[dict[str, Any]] = []
    subnet_index_by_comp: dict[frozenset[UUID], int] = {}
    next_subnet_index = 1

    start_year = horizon_from.year
    end_year = horizon_to.year

    graph_cache: dict[int, tuple[_RoadGraph, list[list[tuple[float, float]]]]] = {}

    for year in range(start_year, end_year + 1):
        year_end = min(_year_end(year), horizon_to)
        if year not in graph_cache:
            graph_cache[year] = (build_graph_at(year_end), build_polylines_at(year_end))
        g, polylines = graph_cache[year]
        for nid in g.coords:
            g.adj.setdefault(nid, [])

        for q in all_quarries:
            q.in_service = is_in_service(q.entry_date, year_end)
            nid, _ = _snap_site_to_autoroad_network(g, q.lon, q.lat, polylines)
            q.node_id = nid
        for c, _ in all_consumers:
            c.in_service = is_in_service(c.entry_date, year_end)
            nid, _ = _snap_site_to_autoroad_network(g, c.lon, c.lat, polylines)
            c.node_id = nid

        components = _connected_components(g.adj)
        seen_nodes: set[UUID] = set()
        for comp in components:
            seen_nodes |= comp
        for site in all_quarries:
            if site.node_id and site.node_id not in seen_nodes:
                components.append({site.node_id})
                seen_nodes.add(site.node_id)
        for site, _ in all_consumers:
            if site.node_id and site.node_id not in seen_nodes:
                components.append({site.node_id})
                seen_nodes.add(site.node_id)

        quarry_subnet_node_sets = [
            comp for comp in components if any(q.node_id in comp for q in all_quarries)
        ]
        display_subnet_node_sets = _display_subnet_components(
            components, all_quarries, all_consumers, year_end=year_end
        )

        _accrue_year_demand(
            year=year,
            year_end=year_end,
            consumer_sims=consumer_sims,
        )

        for comp in quarry_subnet_node_sets:
            comp_key = frozenset(comp)
            if comp_key not in subnet_index_by_comp:
                subnet_index_by_comp[comp_key] = next_subnet_index
                next_subnet_index += 1
            idx = subnet_index_by_comp[comp_key]
            subnet_qs = [q for q in all_quarries if q.node_id in comp]
            _run_year_allocation(
                year=year,
                g=g,
                component=comp,
                quarry_sims=[quarry_sims[q.object_id] for q in subnet_qs],
                consumer_sims=list(consumer_sims.values()),
            )

        year_subnets: list[dict[str, Any]] = []
        for comp in display_subnet_node_sets:
            comp_key = frozenset(comp)
            if comp_key not in subnet_index_by_comp:
                subnet_index_by_comp[comp_key] = next_subnet_index
                next_subnet_index += 1
            idx = subnet_index_by_comp[comp_key]
            year_subnets.append(
                _build_subnet_snapshot(
                    year=year,
                    year_end=year_end,
                    g=g,
                    quarries=all_quarries,
                    consumers=[c for c, _ in all_consumers],
                    quarry_sims=quarry_sims,
                    consumer_sims=consumer_sims,
                    db_edges=db_edges,
                    subtype_by_obj=subtype_by_obj,
                    component=comp,
                    subnet_index=idx,
                )
            )

        shown_consumer_ids: set[UUID] = set()
        for sn in year_subnets:
            for row in sn.get("consumers", []):
                shown_consumer_ids.add(UUID(row["object_id"]))

        waiting_pairs: list[tuple[_PointSite, _ConsumerSimState]] = []
        for c, _props in all_consumers:
            cs = consumer_sims[c.object_id]
            if c.object_id in shown_consumer_ids:
                continue
            if not is_in_service(c.entry_date, year_end):
                continue
            if cs.cumulative_demand <= 1e-6:
                continue
            waiting_pairs.append((c, cs))

        if waiting_pairs:
            wait_idx = next_subnet_index
            next_subnet_index += 1
            year_subnets.append(
                _build_waiting_off_network_snapshot(
                    year_end=year_end,
                    waiting=waiting_pairs,
                    subnet_index=wait_idx,
                )
            )

        total_demand, total_allocated, unmet = _timeline_totals(year_subnets)
        timeline.append(
            {
                "year": year,
                "as_of": entry_date_to_iso(year_end),
                "subnet_count": len(year_subnets),
                "total_demand_m3": round(total_demand, 2),
                "total_allocated_m3": round(total_allocated, 2),
                "unmet_m3": round(unmet, 2),
                "subnets": year_subnets,
            }
        )

    view_year = view_as_of.year
    view_step = next(
        (t for t in timeline if t["year"] == view_year),
        timeline[-1] if timeline else None,
    )
    subnets_at_view = view_step["subnets"] if view_step else []

    return timeline, subnets_at_view, list(dict.fromkeys(warnings))
