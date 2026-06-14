"""Sand logistics: road-network distances and quarry allocation (project-level)."""

from __future__ import annotations

import math
from datetime import date
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.entry_date import entry_date_to_iso, is_in_service, read_entry_date
from app.geo.sand_properties import (
    SAND_QUARRY_SUBTYPE,
    compute_horizon_bounds,
    is_sand_consumer_subtype,
    read_quarry_volumes,
    read_sand_volume_by_year,
    sand_demand_plan_total_m3,
)
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
)
from app.services.graph_builder import build_network_from_lines, get_or_create_network
from app.services.road_graph import (
    RoadGraph as _RoadGraph,
    add_undirected_edge as _add_undirected_edge,
    build_autoroad_graph,
    build_autoroad_polylines,
    connected_components as _connected_components,
    dijkstra as _dijkstra,
    nearest_autoroad_node as _nearest_autoroad_node,
    nearest_node as _nearest_node,
    snap_site_to_autoroad_network as _snap_site_to_autoroad_network,
)
from app.services.sand_logistics_subnet import (
    _PointSite,
    _analyze_subnet,
)

__all__ = [
    "_PointSite",
    "_RoadGraph",
    "_add_undirected_edge",
    "_analyze_subnet",
    "_connected_components",
    "_dijkstra",
    "_nearest_autoroad_node",
    "_nearest_node",
    "_snap_site_to_autoroad_network",
    "analyze_sand_logistics",
]


async def analyze_sand_logistics(
    db: AsyncSession,
    project_id: UUID,
    *,
    rebuild_network: bool = True,
    as_of: date | None = None,
    horizon_from: date | None = None,
    horizon_to: date | None = None,
) -> dict[str, Any]:
    global_warnings: list[str] = []

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
    autoroad_objects = (await db.execute(autoroad_lines_q)).scalars().all()

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

    entry_dates: list[date] = []
    plan_years: list[int] = []
    all_quarries: list[_PointSite] = []
    all_consumers: list[tuple[_PointSite, dict[str, Any]]] = []

    for road in autoroad_objects:
        entry_dates.append(read_entry_date(road.properties))

    for obj in infra_points:
        props = obj.properties or {}
        entry = read_entry_date(props)
        entry_dates.append(entry)
        if obj.subtype == SAND_QUARRY_SUBTYPE:
            initial, current = read_quarry_volumes(props)
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
                )
            )
        elif is_sand_consumer_subtype(obj.subtype):
            plan_total = sand_demand_plan_total_m3(props)
            if plan_total <= 0:
                continue
            for year_key in read_sand_volume_by_year(props):
                try:
                    plan_years.append(int(year_key))
                except ValueError:
                    pass
            all_consumers.append(
                (
                    _PointSite(
                        object_id=obj.id,
                        name=obj.name,
                        subtype=obj.subtype,
                        lon=obj.longitude,
                        lat=obj.latitude,
                        demand_plan_total_m3=plan_total,
                        entry_date=entry,
                    ),
                    props,
                )
            )

    if not all_quarries:
        global_warnings.append("no_sand_quarries")
    if not all_consumers:
        global_warnings.append("no_sand_consumers")

    auto_h_from, auto_h_to = compute_horizon_bounds(entry_dates, plan_years)
    if not entry_dates:
        auto_h_from = auto_h_to = as_of or date.today()
    h_from = horizon_from or auto_h_from
    h_to = horizon_to or auto_h_to
    view_as_of = as_of or h_to
    if view_as_of < h_from:
        h_from = view_as_of
    if view_as_of > h_to:
        h_to = view_as_of

    def build_graph_at(calc_date: date) -> _RoadGraph:
        return build_autoroad_graph(
            nodes,
            db_edges,
            subtype_by_obj,
            calc_date=calc_date,
            entry_by_obj=entry_by_obj,
        )

    def build_polylines_at(calc_date: date) -> list[list[tuple[float, float]]]:
        return build_autoroad_polylines(autoroad_objects, calc_date=calc_date)

    g_at_view = build_graph_at(view_as_of)
    if not g_at_view.adj:
        global_warnings.append("no_autoroad_network")

    polylines_at_view = build_polylines_at(view_as_of)
    for site in all_quarries:
        nid, snap_km = _snap_site_to_autoroad_network(
            g_at_view, site.lon, site.lat, polylines_at_view
        )
        site.node_id = nid
        site.in_service = is_in_service(site.entry_date, view_as_of)
        if nid is None:
            if polylines_at_view and snap_km < math.inf:
                global_warnings.append(f"too_far_from_autoroad:{site.object_id}")
            else:
                global_warnings.append(f"no_graph_node:{site.object_id}")
        elif not site.in_service:
            global_warnings.append(f"not_in_service:{site.object_id}")

    for site, _ in all_consumers:
        nid, snap_km = _snap_site_to_autoroad_network(
            g_at_view, site.lon, site.lat, polylines_at_view
        )
        site.node_id = nid
        site.in_service = is_in_service(site.entry_date, view_as_of)
        if nid is None:
            if polylines_at_view and snap_km < math.inf:
                global_warnings.append(f"too_far_from_autoroad:{site.object_id}")
            else:
                global_warnings.append(f"no_graph_node:{site.object_id}")
        elif not site.in_service:
            global_warnings.append(f"not_in_service:{site.object_id}")

    from app.services.sand_logistics_horizon import simulate_sand_horizon

    timeline, subnets, sim_warnings = simulate_sand_horizon(
        horizon_from=h_from,
        horizon_to=h_to,
        view_as_of=view_as_of,
        all_quarries=all_quarries,
        all_consumers=all_consumers,
        build_graph_at=build_graph_at,
        build_polylines_at=build_polylines_at,
        db_edges=db_edges,
        subtype_by_obj=subtype_by_obj,
    )
    global_warnings.extend(sim_warnings)

    for subnet in subnets:
        global_warnings.extend(subnet.get("warnings", []))

    components = _connected_components(g_at_view.adj)
    quarry_subnet_node_sets: list[set[UUID]] = []
    for comp in components:
        if any(q.node_id in comp for q in all_quarries):
            quarry_subnet_node_sets.append(comp)

    assigned_sites: set[UUID] = set()
    for comp in quarry_subnet_node_sets:
        for q in all_quarries:
            if q.node_id in comp:
                assigned_sites.add(q.object_id)
        for c, _ in all_consumers:
            if c.node_id in comp:
                assigned_sites.add(c.object_id)

    for q in all_quarries:
        if q.object_id in assigned_sites:
            continue
        if q.node_id is None:
            continue
        global_warnings.append(f"not_in_quarry_subnet:{q.object_id}")

    for c, _ in all_consumers:
        if c.object_id in assigned_sites:
            continue
        if c.node_id is None:
            continue
        global_warnings.append(f"not_in_quarry_subnet:{c.object_id}")

    for comp in components:
        if any(q.node_id in comp for q in all_quarries):
            continue
        for c, _ in all_consumers:
            if c.node_id in comp:
                global_warnings.append(f"no_quarry_in_subnet:{c.object_id}")
        for q in all_quarries:
            if q.node_id in comp:
                global_warnings.append(f"no_quarry_in_subnet:{q.object_id}")

    if not subnets and all_quarries:
        global_warnings.append("no_connected_quarry_subnets")

    return {
        "project_id": str(project_id),
        "horizon_from": entry_date_to_iso(h_from),
        "horizon_to": entry_date_to_iso(h_to),
        "as_of": entry_date_to_iso(view_as_of),
        "network_id": str(net.id),
        "subnet_count": len(subnets),
        "subnets": subnets,
        "timeline": timeline,
        "warnings": list(dict.fromkeys(global_warnings)),
        "object_names": {
            str(s.object_id): s.name for s in all_quarries + [c for c, _ in all_consumers] if s.name
        },
    }
