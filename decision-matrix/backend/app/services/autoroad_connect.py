"""Connect selected point infrastructure objects via autoroad (MST on road network)."""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES, POINT_SUBTYPES
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
)
from app.schemas import InfraObjectCreate
from app.services.graph_builder import build_network_from_lines
from app.services.line_endpoint_rules import ENDPOINT_SNAP_TOLERANCE_KM
from app.services.line_split import (
    build_line_split_plan,
    find_segment_intersections,
    is_near_line_endpoint,
    line_geometry_fields_from_coords,
)
from app.services.road_graph import (
    RoadGraph,
    build_autoroad_graph,
    build_autoroad_polylines,
    closest_point_on_polyline_for_snap,
    connected_components,
    dijkstra_with_prev,
    haversine_km,
    min_bridge_between_components,
    mst_terminal_edges,
    node_component,
    shortest_path_edges,
)
from app.services.spatial import line_coords_from_object

MAX_CONNECT_OBJECTS = 50
NODE_DEDUP_KM = 0.05


@dataclass
class TerminalSnap:
    object_id: UUID
    name: str
    lon: float
    lat: float
    graph_node_id: UUID | None = None
    snap_lon: float | None = None
    snap_lat: float | None = None
    warning: str | None = None


@dataclass
class PlannedLine:
    start_lon: float
    start_lat: float
    end_lon: float
    end_lat: float
    snap_start_object_id: UUID | None = None
    snap_finish_object_id: UUID | None = None
    kind: str = "connector"  # connector | bridge


@dataclass
class PlannedSplit:
    line_id: UUID
    segment_index: int
    split_lon: float
    split_lat: float


@dataclass
class PlannedNode:
    lon: float
    lat: float
    reason: str = "intersection"


@dataclass
class AutoroadConnectPlan:
    terminals: list[TerminalSnap] = field(default_factory=list)
    new_lines: list[PlannedLine] = field(default_factory=list)
    splits: list[PlannedSplit] = field(default_factory=list)
    new_nodes: list[PlannedNode] = field(default_factory=list)
    used_existing_edge_ids: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    total_new_km: float = 0.0

    def to_response_dict(self) -> dict[str, Any]:
        preview_features: list[dict[str, Any]] = []
        for ln in self.new_lines:
            preview_features.append(
                {
                    "type": "Feature",
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [ln.start_lon, ln.start_lat],
                            [ln.end_lon, ln.end_lat],
                        ],
                    },
                    "properties": {"kind": ln.kind},
                }
            )
        for nd in self.new_nodes:
            preview_features.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Point", "coordinates": [nd.lon, nd.lat]},
                    "properties": {"reason": nd.reason},
                }
            )
        return {
            "terminals": [
                {
                    "object_id": str(t.object_id),
                    "name": t.name,
                    "graph_node_id": str(t.graph_node_id) if t.graph_node_id else None,
                    "warning": t.warning,
                }
                for t in self.terminals
            ],
            "new_line_count": len(self.new_lines),
            "new_node_count": len(self.new_nodes),
            "split_count": len(self.splits),
            "used_existing_edge_ids": self.used_existing_edge_ids,
            "total_new_km": round(self.total_new_km, 3),
            "warnings": self.warnings,
            "preview": {"type": "FeatureCollection", "features": preview_features},
        }


def _coord_key(lon: float, lat: float) -> tuple[int, int]:
    return (round(lon * 1e5), round(lat * 1e5))


def _snap_terminal_to_network(
    lon: float,
    lat: float,
    g: RoadGraph,
    polylines: list[list[tuple[float, float]]],
) -> tuple[UUID | None, float | None, float | None, str | None]:
    on_poly = math.inf
    poly_snap: tuple[float, float] | None = None
    for pl in polylines:
        slon, slat, _ = closest_point_on_polyline_for_snap(lon, lat, pl)
        d = haversine_km(lon, lat, slon, slat)
        if d < on_poly:
            on_poly = d
            poly_snap = (slon, slat)

    if on_poly > ENDPOINT_SNAP_TOLERANCE_KM:
        return None, None, None, "too_far_from_autoroad"

    slon, slat = poly_snap if poly_snap else (lon, lat)
    best_nid: UUID | None = None
    best_d = math.inf
    for nid in g.adj:
        nc = g.coords.get(nid)
        if not nc:
            continue
        d = haversine_km(slon, slat, nc[0], nc[1])
        if d < best_d:
            best_d = d
            best_nid = nid
    if best_nid is None or best_d > ENDPOINT_SNAP_TOLERANCE_KM:
        return None, slon, slat, "no_graph_node"
    return best_nid, slon, slat, None


def _needs_connector(
    obj_lon: float,
    obj_lat: float,
    snap_lon: float,
    snap_lat: float,
) -> bool:
    return haversine_km(obj_lon, obj_lat, snap_lon, snap_lat) > 0.02


async def build_autoroad_connect_plan(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
) -> AutoroadConnectPlan:
    plan = AutoroadConnectPlan()
    if len(object_ids) < 2:
        plan.warnings.append("need_at_least_two_objects")
        return plan
    if len(object_ids) > MAX_CONNECT_OBJECTS:
        plan.warnings.append(f"too_many_objects_max_{MAX_CONNECT_OBJECTS}")
        return plan

    await build_network_from_lines(db, project_id)

    net = await db.scalar(
        select(InfrastructureNetwork).where(InfrastructureNetwork.project_id == project_id).limit(1)
    )
    if not net:
        plan.warnings.append("no_autoroad_network")
        return plan

    nodes = (
        await db.execute(select(InfrastructureNode).where(InfrastructureNode.network_id == net.id))
    ).scalars().all()
    db_edges = (
        await db.execute(select(InfrastructureEdge).where(InfrastructureEdge.network_id == net.id))
    ).scalars().all()

    obj_ids_edge = {e.infrastructure_object_id for e in db_edges if e.infrastructure_object_id}
    subtype_by_obj: dict[UUID, str] = {}
    if obj_ids_edge:
        rows = (
            await db.execute(
                select(InfrastructureObject.id, InfrastructureObject.subtype).where(
                    InfrastructureObject.id.in_(obj_ids_edge)
                )
            )
        ).all()
        subtype_by_obj = {oid: st for oid, st in rows}

    g = build_autoroad_graph(nodes, db_edges, subtype_by_obj)
    if not g.adj:
        plan.warnings.append("no_autoroad_edges")

    autoroad_q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype == "autoroad",
            InfrastructureObject.end_longitude.isnot(None),
        )
    )
    autoroad_objects = (await db.execute(autoroad_q)).scalars().all()
    polylines = build_autoroad_polylines(autoroad_objects)

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
    missing = [str(i) for i in object_ids if i not in by_id]
    if missing:
        plan.warnings.append(f"invalid_or_line_objects:{','.join(missing[:5])}")

    terminals: list[TerminalSnap] = []
    for oid in object_ids:
        obj = by_id.get(oid)
        if not obj:
            continue
        if obj.subtype in LINE_SUBTYPES or obj.subtype not in POINT_SUBTYPES:
            plan.warnings.append(f"not_point:{obj.id}")
            continue
        nid, slon, slat, warn = _snap_terminal_to_network(
            obj.longitude, obj.latitude, g, polylines
        )
        terminals.append(
            TerminalSnap(
                object_id=obj.id,
                name=obj.name,
                lon=obj.longitude,
                lat=obj.latitude,
                graph_node_id=nid,
                snap_lon=slon,
                snap_lat=slat,
                warning=warn,
            )
        )

    snapped = [t for t in terminals if t.graph_node_id and t.snap_lon is not None]
    if len(snapped) < 2:
        plan.terminals = terminals
        plan.warnings.append("insufficient_snapped_terminals")
        return plan

    terminal_node_ids = [t.graph_node_id for t in snapped if t.graph_node_id]
    dist_matrix: dict[UUID, dict[UUID, float]] = {}
    prev_cache: dict[UUID, dict[UUID, UUID | None]] = {}
    for a in terminal_node_ids:
        dist_matrix[a] = {}
        d, prev = dijkstra_with_prev(g, a)
        prev_cache[a] = prev
        for b in terminal_node_ids:
            dist_matrix[a][b] = d.get(b, math.inf)

    mst_edges = mst_terminal_edges(terminal_node_ids, dist_matrix)
    used_edge_ids: set[str] = set()
    for a, b in mst_edges:
        prev = prev_cache.get(a, {})
        for edge in shortest_path_edges(g, prev, a, b):
            used_edge_ids.add(str(edge.id))
    plan.used_existing_edge_ids = sorted(used_edge_ids)

    comps = connected_components(g.adj)
    comp_by_node: dict[UUID, set[UUID]] = {}
    for comp in comps:
        for nid in comp:
            comp_by_node[nid] = comp

    terminal_comps: set[frozenset[UUID]] = {
        frozenset(comp_by_node[t.graph_node_id])
        for t in snapped
        if t.graph_node_id and t.graph_node_id in comp_by_node
    }

    if len(terminal_comps) > 1:
        comp_list = list(terminal_comps)
        parent = {i: i for i in range(len(comp_list))}

        def find(i: int) -> int:
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i

        def union(i: int, j: int) -> None:
            ri, rj = find(i), find(j)
            if ri != rj:
                parent[rj] = ri

        bridges: list[tuple[int, int, float]] = []
        for i in range(len(comp_list)):
            for j in range(i + 1, len(comp_list)):
                br = min_bridge_between_components(comp_list[i], comp_list[j], g)
                if br:
                    bridges.append((i, j, br[2]))
        bridges.sort(key=lambda x: x[2])
        for i, j, _ in bridges:
            if find(i) != find(j):
                union(i, j)
                ca, cb = comp_list[i], comp_list[j]
                br = min_bridge_between_components(ca, cb, g)
                if br:
                    na, nb, _ = br
                    ca_coord = g.coords[na]
                    cb_coord = g.coords[nb]
                    plan.new_lines.append(
                        PlannedLine(
                            start_lon=ca_coord[0],
                            start_lat=ca_coord[1],
                            end_lon=cb_coord[0],
                            end_lat=cb_coord[1],
                            kind="bridge",
                        )
                    )
                    plan.total_new_km += haversine_km(
                        ca_coord[0], ca_coord[1], cb_coord[0], cb_coord[1]
                    )

    for t in snapped:
        if t.snap_lon is None or t.snap_lat is None:
            continue
        if _needs_connector(t.lon, t.lat, t.snap_lon, t.snap_lat):
            plan.new_lines.append(
                PlannedLine(
                    start_lon=t.lon,
                    start_lat=t.lat,
                    end_lon=t.snap_lon,
                    end_lat=t.snap_lat,
                    snap_start_object_id=t.object_id,
                    kind="connector",
                )
            )
            plan.total_new_km += haversine_km(t.lon, t.lat, t.snap_lon, t.snap_lat)

    node_keys: set[tuple[int, int]] = set()
    for pl in plan.new_lines:
        seg = ((pl.start_lon, pl.start_lat), (pl.end_lon, pl.end_lat))
        for road in autoroad_objects:
            rcoords = line_coords_from_object(road)
            for i in range(len(rcoords) - 1):
                rseg = (rcoords[i], rcoords[i + 1])
                hit = find_segment_intersections(seg, rseg)
                if not hit:
                    continue
                ix, iy = hit
                if is_near_line_endpoint(ix, iy, rcoords):
                    continue
                plan.splits.append(
                    PlannedSplit(
                        line_id=road.id,
                        segment_index=i,
                        split_lon=ix,
                        split_lat=iy,
                    )
                )
                key = _coord_key(ix, iy)
                if key not in node_keys:
                    node_keys.add(key)
                    plan.new_nodes.append(
                        PlannedNode(lon=ix, lat=iy, reason="intersection")
                    )

    plan.terminals = terminals
    return plan


async def apply_autoroad_connect_plan(
    db: AsyncSession,
    project_id: UUID,
    plan: AutoroadConnectPlan,
) -> dict[str, Any]:
    from app.api.v1.map import _create_infra_object_record

    created_nodes: list[InfraObject] = []
    created_lines: list[InfraObject] = []
    node_by_key: dict[tuple[int, int], InfrastructureObject] = {}

    layer = await db.scalar(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
        .order_by(InfrastructureLayer.sort_order)
        .limit(1)
    )
    if not layer:
        layer = InfrastructureLayer(
            project_id=project_id,
            name="Инфраструктура",
            layer_type="infrastructure",
            source_type="manual",
        )
        db.add(layer)
        await db.flush()

    n_node = len(
        (
            await db.execute(
                select(InfrastructureObject).join(InfrastructureLayer).where(
                    InfrastructureLayer.project_id == project_id,
                    InfrastructureObject.subtype == "node",
                )
            )
        ).all()
    )
    n_road = len(
        (
            await db.execute(
                select(InfrastructureObject).join(InfrastructureLayer).where(
                    InfrastructureLayer.project_id == project_id,
                    InfrastructureObject.subtype == "autoroad",
                )
            )
        ).all()
    )

    for pn in plan.new_nodes:
        key = _coord_key(pn.lon, pn.lat)
        if key in node_by_key:
            continue
        n_node += 1
        data = InfraObjectCreate(
            name=f"Узел_{n_node}",
            subtype="node",
            lon=pn.lon,
            lat=pn.lat,
            layer_id=layer.id,
        )
        obj = await _create_infra_object_record(db, project_id=project_id, data=data)
        node_by_key[key] = obj
        created_nodes.append(obj)

    split_done: set[UUID] = set()
    for sp in plan.splits:
        if sp.line_id in split_done:
            continue
        line = await db.get(InfrastructureObject, sp.line_id)
        if not line:
            continue
        key = _coord_key(sp.split_lon, sp.split_lat)
        node_obj = node_by_key.get(key)
        if node_obj is None:
            n_node += 1
            node_obj = await _create_infra_object_record(
                db,
                project_id=project_id,
                data=InfraObjectCreate(
                    name=f"Узел_{n_node}",
                    subtype="node",
                    lon=sp.split_lon,
                    lat=sp.split_lat,
                    layer_id=layer.id,
                ),
            )
            node_by_key[key] = node_obj
            created_nodes.append(node_obj)

        split_plan = build_line_split_plan(
            line,
            sp.segment_index,
            sp.split_lon,
            sp.split_lat,
            f"{line.name} (2)",
        )
        if not split_plan:
            continue
        from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage

        props = dict(line.properties or {})
        props["coordinates"] = split_plan.first_coords
        line.name = line.name
        line.longitude = split_plan.first_coords[0][0]
        line.latitude = split_plan.first_coords[0][1]
        line.end_longitude = split_plan.first_coords[-1][0]
        line.end_latitude = split_plan.first_coords[-1][1]
        line.properties = props
        line.geometry = build_infra_geometry(
            line.subtype,
            line.longitude,
            line.latitude,
            end_lon=line.end_longitude,
            end_lat=line.end_latitude,
            coordinates=split_plan.first_coords,
        )
        second_data = InfraObjectCreate(
            name=split_plan.second_name,
            subtype=line.subtype,
            lon=split_plan.second_coords[0][0],
            lat=split_plan.second_coords[0][1],
            end_lon=split_plan.second_coords[-1][0],
            end_lat=split_plan.second_coords[-1][1],
            coordinates=split_plan.second_coords,
            layer_id=line.layer_id,
            properties={k: v for k, v in props.items() if k != "coordinates"},
        )
        second = await _create_infra_object_record(db, project_id=project_id, data=second_data)
        created_lines.append(second)
        split_done.add(sp.line_id)

    for pl in plan.new_lines:
        n_road += 1
        finish_id = pl.snap_finish_object_id
        sk = _coord_key(pl.end_lon, pl.end_lat)
        if sk in node_by_key:
            finish_id = node_by_key[sk].id

        data = InfraObjectCreate(
            name=f"Автодорога_{n_road}",
            subtype="autoroad",
            lon=pl.start_lon,
            lat=pl.start_lat,
            end_lon=pl.end_lon,
            end_lat=pl.end_lat,
            layer_id=layer.id,
            line_snap_start_object_id=pl.snap_start_object_id,
            line_snap_finish_object_id=finish_id,
        )
        obj = await _create_infra_object_record(db, project_id=project_id, data=data)
        created_lines.append(obj)

    await build_network_from_lines(db, project_id)

    return {
        "created_node_ids": [str(o.id) for o in created_nodes],
        "created_line_ids": [str(o.id) for o in created_lines],
        "created_nodes": len(created_nodes),
        "created_lines": len(created_lines),
    }


async def run_autoroad_connect(
    db: AsyncSession,
    project_id: UUID,
    object_ids: list[UUID],
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    plan = await build_autoroad_connect_plan(db, project_id, object_ids)
    out = plan.to_response_dict()
    if dry_run:
        out["dry_run"] = True
        return out
    if plan.warnings and "insufficient_snapped_terminals" in plan.warnings:
        raise ValueError("Недостаточно объектов в пределах 300 м от автодорог")
    applied = await apply_autoroad_connect_plan(db, project_id, plan)
    out.update(applied)
    out["dry_run"] = False
    return out
