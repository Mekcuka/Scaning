"""Build PFD-style fluid flow schematic from POI, engineering rules, and infrastructure network."""

from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.fluid_routing import (
    ENG_GAS_LABELS,
    FLUID_BRANCH_LABELS,
    FLUID_EDGE_SUBTYPES,
    FLUID_TERMINAL_SUBTYPES,
    OIL_PREP_LABELS,
    PIPELINE_SUBTYPE_BY_FLUID,
    FluidKind,
    active_fluids,
    gas_terminal_subtype,
    WATER_FORMATION_LABEL,
    gas_uses_local_utilization,
    oil_needs_preparation,
    oil_uses_pipeline_transport,
    water_uses_centralized_injection,
    water_uses_local_utilization,
)
from app.models import (
    InfrastructureEdge,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    PointOfInterest,
)
from app.services.calculations import EngineeringState
from app.services.flow_capacity import enrich_nodes_capacity
from app.services.flow_propagation import propagate_flows
from app.services.infrastructure_analysis import engineering_state_from_poi


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@dataclass
class _Graph:
    adj: dict[UUID, list[tuple[UUID, str]]] = field(default_factory=dict)
    node_coords: dict[UUID, tuple[float, float]] = field(default_factory=dict)
    node_subtype: dict[UUID, str | None] = field(default_factory=dict)
    node_name: dict[UUID, str | None] = field(default_factory=dict)
    node_properties: dict[UUID, dict] = field(default_factory=dict)
    terminal_nodes: dict[FluidKind, set[UUID]] = field(default_factory=dict)


def pathfind_bfs(
    graph: _Graph,
    start: UUID,
    fluid: FluidKind,
) -> tuple[list[UUID], float] | None:
    """Shortest path (by hop count) from start to any terminal for fluid."""
    terminals = graph.terminal_nodes.get(fluid, set())
    if not start:
        return None
    if start in terminals:
        return [start], 0.0

    allowed_edges = FLUID_EDGE_SUBTYPES[fluid]
    visited = {start}
    queue: deque[tuple[UUID, list[UUID], float]] = deque([(start, [start], 0.0)])

    while queue:
        node_id, path, length_km = queue.popleft()
        for neighbor, edge_subtype in graph.adj.get(node_id, []):
            if edge_subtype not in allowed_edges:
                continue
            if neighbor in visited:
                continue
            visited.add(neighbor)
            hop_km = 0.0
            if node_id in graph.node_coords and neighbor in graph.node_coords:
                a = graph.node_coords[node_id]
                b = graph.node_coords[neighbor]
                hop_km = _haversine_km(a[0], a[1], b[0], b[1])
            new_path = path + [neighbor]
            new_len = length_km + hop_km
            if neighbor in terminals:
                return new_path, new_len
            queue.append((neighbor, new_path, new_len))
    return None


def nearest_node_on_fluid_edges(
    graph: _Graph,
    poi_lon: float,
    poi_lat: float,
    fluid: FluidKind,
) -> UUID | None:
    allowed = FLUID_EDGE_SUBTYPES[fluid]
    candidates: set[UUID] = set()
    for node_id, neighbors in graph.adj.items():
        for _, edge_subtype in neighbors:
            if edge_subtype in allowed:
                candidates.add(node_id)
                break
    for node_id, neighbors in graph.adj.items():
        for neighbor, edge_subtype in neighbors:
            if edge_subtype in allowed:
                candidates.add(neighbor)

    best: UUID | None = None
    best_d = float("inf")
    for node_id in candidates:
        if node_id not in graph.node_coords:
            continue
        lon, lat = graph.node_coords[node_id]
        d = _haversine_km(poi_lon, poi_lat, lon, lat)
        if d < best_d:
            best_d = d
            best = node_id
    return best


def build_graph_from_rows(
    nodes: list[InfrastructureNode],
    edges: list[InfrastructureEdge],
    objects_by_id: dict[UUID, InfrastructureObject],
) -> _Graph:
    graph = _Graph()
    for fluid in ("oil", "water", "gas"):
        graph.terminal_nodes[fluid] = set()

    for node in nodes:
        graph.node_coords[node.id] = (node.longitude, node.latitude)
        subtype: str | None = None
        name: str | None = None
        if node.infrastructure_object_id and node.infrastructure_object_id in objects_by_id:
            obj = objects_by_id[node.infrastructure_object_id]
            subtype = obj.subtype
            name = obj.name
            graph.node_properties[node.id] = dict(obj.properties or {})
        graph.node_subtype[node.id] = subtype
        graph.node_name[node.id] = name
        for fluid, terminal_subtypes in FLUID_TERMINAL_SUBTYPES.items():
            if subtype and subtype in terminal_subtypes:
                graph.terminal_nodes[fluid].add(node.id)

    for edge in edges:
        obj = objects_by_id.get(edge.infrastructure_object_id) if edge.infrastructure_object_id else None
        edge_subtype = obj.subtype if obj else ""
        if edge.from_node_id not in graph.adj:
            graph.adj[edge.from_node_id] = []
        if edge.to_node_id not in graph.adj:
            graph.adj[edge.to_node_id] = []
        graph.adj[edge.from_node_id].append((edge.to_node_id, edge_subtype))
        graph.adj[edge.to_node_id].append((edge.from_node_id, edge_subtype))

    return graph


def _schematic_from_state(
    poi: PointOfInterest,
    state: EngineeringState,
    graph: _Graph | None,
    *,
    network_built: bool,
) -> dict[str, Any]:
    fluids_on = active_fluids(state)
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    warnings: list[str] = []

    if not network_built:
        warnings.append("network_not_built")

    poi_id = f"poi-{poi.id}"
    sep_id = f"sep-{poi.id}"
    nodes.append(
        {
            "id": poi_id,
            "kind": "poi",
            "label": poi.name or "Точка интереса",
            "fluid": None,
            "subtype": None,
            "status": None,
        }
    )
    nodes.append(
        {
            "id": sep_id,
            "kind": "separator",
            "label": "Сепарация",
            "fluid": None,
            "subtype": None,
            "status": None,
        }
    )
    edges.append({"id": f"e-poi-sep", "source": poi_id, "target": sep_id, "fluid": "oil"})

    def link(prev: str, nxt: str, fluid: FluidKind, edge_suffix: str) -> str:
        eid = f"e-{edge_suffix}-{fluid}"
        edges.append({"id": eid, "source": prev, "target": nxt, "fluid": fluid})
        return nxt

    for fluid, enabled in fluids_on.items():
        if not enabled:
            continue
        branch_id = f"branch-{fluid}-{poi.id}"
        nodes.append(
            {
                "id": branch_id,
                "kind": "fluid_branch",
                "label": FLUID_BRANCH_LABELS[fluid],
                "fluid": fluid,
                "subtype": None,
                "status": None,
                "throughput_capacity_annual": None,
                "capacity_unit": None,
            }
        )
        prev = link(sep_id, branch_id, fluid, f"sep-{fluid}")

        if fluid == "oil":
            if oil_needs_preparation(state):
                prep_id = f"proc-oil-prep-{poi.id}"
                nodes.append(
                    {
                        "id": prep_id,
                        "kind": "process",
                        "label": f"Подготовка: {OIL_PREP_LABELS.get(state.eng_oil_preparation, state.eng_oil_preparation)}",
                        "fluid": "oil",
                        "subtype": state.eng_oil_preparation,
                        "status": None,
                    }
                )
                prev = link(prev, prep_id, "oil", "prep")

            if not oil_uses_pipeline_transport(state):
                util_id = f"term-auto-{poi.id}"
                nodes.append(
                    {
                        "id": util_id,
                        "kind": "utilization",
                        "label": "Автовывоз",
                        "fluid": "oil",
                        "subtype": "auto",
                        "status": None,
                    }
                )
                link(prev, util_id, "oil", "auto")
                continue

            if not network_built or graph is None:
                if "network_not_built" not in warnings:
                    warnings.append("network_not_built")
                continue

            start = nearest_node_on_fluid_edges(graph, poi.longitude, poi.latitude, "oil")
            if not start:
                warnings.append("no_path_for_oil")
                continue
            path_result = pathfind_bfs(graph, start, "oil")
            if not path_result:
                warnings.append("no_path_for_oil")
                continue
            path, length_km = path_result
            _append_network_path(nodes, edges, prev, "oil", poi.id, graph, path, length_km)
            continue

        if fluid == "water":
            if water_uses_local_utilization(state):
                util_id = f"util-water-{poi.id}"
                nodes.append(
                    {
                        "id": util_id,
                        "kind": "utilization",
                        "label": WATER_FORMATION_LABEL,
                        "fluid": "water",
                        "subtype": "local",
                        "status": None,
                    }
                )
                link(prev, util_id, "water", "util")
                continue

            if not network_built or graph is None:
                if water_uses_centralized_injection(state):
                    _append_virtual_water_injection_chain(nodes, edges, prev, poi.id)
                continue
            start = nearest_node_on_fluid_edges(graph, poi.longitude, poi.latitude, "water")
            if not start:
                warnings.append("no_path_for_water")
                _append_virtual_water_injection_chain(nodes, edges, prev, poi.id)
                continue
            path_result = pathfind_bfs(graph, start, "water")
            if not path_result:
                warnings.append("no_path_for_water")
                _append_virtual_water_injection_chain(nodes, edges, prev, poi.id)
                continue
            path, length_km = path_result
            term_id = _append_network_path(
                nodes, edges, prev, "water", poi.id, graph, path, length_km
            )
            _append_water_formation_util(nodes, edges, term_id, poi.id)
            continue

        if fluid == "gas":
            if gas_uses_local_utilization(state):
                util_id = f"util-gas-{poi.id}"
                nodes.append(
                    {
                        "id": util_id,
                        "kind": "utilization",
                        "label": ENG_GAS_LABELS.get(state.eng_gas, state.eng_gas),
                        "fluid": "gas",
                        "subtype": state.eng_gas,
                        "status": None,
                    }
                )
                link(prev, util_id, "gas", "util")
                continue

            if not network_built or graph is None:
                continue

            start = nearest_node_on_fluid_edges(graph, poi.longitude, poi.latitude, "gas")
            if not start:
                warnings.append("no_path_for_gas")
                continue
            path_result = pathfind_bfs(graph, start, "gas")
            if not path_result:
                target_sub = gas_terminal_subtype(state)
                if target_sub:
                    warnings.append("no_path_for_gas")
                continue
            path, length_km = path_result
            _append_network_path(nodes, edges, prev, "gas", poi.id, graph, path, length_km)

    enriched = enrich_nodes_capacity(nodes, poi, state)
    propagated = propagate_flows(enriched, edges, poi)
    return {
        "poi_id": poi.id,
        "nodes": propagated,
        "edges": edges,
        "warnings": warnings,
    }


def _append_network_path(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    prev_node_id: str,
    fluid: FluidKind,
    poi_uuid: UUID,
    graph: _Graph,
    path: list[UUID],
    length_km: float,
) -> str:
    pipeline_label = {
        "oil": "Нефтепровод",
        "water": "Водопровод",
        "gas": "Газопровод",
    }[fluid]
    seg_id = f"net-{fluid}-{poi_uuid}"
    nodes.append(
        {
            "id": seg_id,
            "kind": "network_segment",
            "label": f"{pipeline_label} ({round(length_km, 1)} км)",
            "fluid": fluid,
            "subtype": PIPELINE_SUBTYPE_BY_FLUID[fluid],
            "status": None,
        }
    )
    link_id = f"e-net-{fluid}-{poi_uuid}"
    edges.append({"id": link_id, "source": prev_node_id, "target": seg_id, "fluid": fluid})

    terminal_node_id = path[-1]
    term_sub = graph.node_subtype.get(terminal_node_id)
    default_term_name = "БКНС" if fluid == "water" else "Объект приёма"
    term_name = graph.node_name.get(terminal_node_id) or default_term_name
    term_id = f"term-{fluid}-{poi_uuid}"
    term_props = graph.node_properties.get(terminal_node_id) or {}
    term_cap = term_props.get("throughput_capacity_annual")
    term_unit = term_props.get("capacity_unit")
    nodes.append(
        {
            "id": term_id,
            "kind": "terminal",
            "label": term_name,
            "fluid": fluid,
            "subtype": term_sub,
            "status": None,
            "throughput_capacity_annual": float(term_cap) if term_cap is not None else None,
            "capacity_unit": term_unit,
        }
    )
    edges.append(
        {
            "id": f"e-term-{fluid}-{poi_uuid}",
            "source": seg_id,
            "target": term_id,
            "fluid": fluid,
        }
    )
    return term_id


def _append_virtual_water_injection_chain(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    prev_node_id: str,
    poi_uuid: UUID,
) -> str:
    """Схематический БКНС → пласт, если сеть не построена или путь не найден."""
    bkns_id = f"term-water-{poi_uuid}"
    nodes.append(
        {
            "id": bkns_id,
            "kind": "terminal",
            "label": "БКНС",
            "fluid": "water",
            "subtype": "ground_pumping_station",
            "status": None,
        }
    )
    edges.append(
        {
            "id": f"e-bkns-{poi_uuid}",
            "source": prev_node_id,
            "target": bkns_id,
            "fluid": "water",
        }
    )
    return _append_water_formation_util(nodes, edges, bkns_id, poi_uuid)


def _append_water_formation_util(
    nodes: list[dict[str, Any]],
    edges: list[dict[str, Any]],
    after_node_id: str,
    poi_uuid: UUID,
) -> str:
    util_id = f"util-water-form-{poi_uuid}"
    nodes.append(
        {
            "id": util_id,
            "kind": "utilization",
            "label": WATER_FORMATION_LABEL,
            "fluid": "water",
            "subtype": "centralized",
            "status": None,
        }
    )
    edges.append(
        {
            "id": f"e-util-water-form-{poi_uuid}",
            "source": after_node_id,
            "target": util_id,
            "fluid": "water",
        }
    )
    return util_id


async def build_flow_schematic(
    db: AsyncSession,
    project_id: UUID,
    poi: PointOfInterest,
) -> dict[str, Any]:
    state = engineering_state_from_poi(poi)
    net = await db.scalar(
        select(InfrastructureNetwork).where(InfrastructureNetwork.project_id == project_id).limit(1)
    )
    if not net:
        return _schematic_from_state(poi, state, None, network_built=False)

    nodes = (
        await db.execute(select(InfrastructureNode).where(InfrastructureNode.network_id == net.id))
    ).scalars().all()
    edges = (
        await db.execute(select(InfrastructureEdge).where(InfrastructureEdge.network_id == net.id))
    ).scalars().all()

    if not edges:
        return _schematic_from_state(poi, state, None, network_built=False)

    obj_ids: set[UUID] = set()
    for n in nodes:
        if n.infrastructure_object_id:
            obj_ids.add(n.infrastructure_object_id)
    for e in edges:
        if e.infrastructure_object_id:
            obj_ids.add(e.infrastructure_object_id)

    objects_by_id: dict[UUID, InfrastructureObject] = {}
    if obj_ids:
        objs = (
            await db.execute(select(InfrastructureObject).where(InfrastructureObject.id.in_(obj_ids)))
        ).scalars().all()
        objects_by_id = {o.id: o for o in objs}

    graph = build_graph_from_rows(nodes, edges, objects_by_id)
    return _schematic_from_state(poi, state, graph, network_built=True)
