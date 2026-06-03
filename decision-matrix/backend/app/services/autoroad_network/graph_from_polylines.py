"""Build RoadGraph from autoroad polylines (stateless snapshot)."""

from __future__ import annotations

import uuid
from uuid import UUID

from app.services.autoroad_network.schemas import ExistingAutoroadInput
from app.services.road_graph import RoadGraph, add_undirected_edge, haversine_km


def _vertex_node_id(road_id: UUID, index: int) -> UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"autoroad-network:{road_id}:{index}")


def build_graph_from_polylines(roads: list[ExistingAutoroadInput]) -> RoadGraph:
    g = RoadGraph()
    for road in roads:
        coords = [(float(c[0]), float(c[1])) for c in road.coordinates if len(c) >= 2]
        if len(coords) < 2:
            continue
        node_ids: list[UUID] = []
        for i, (lon, lat) in enumerate(coords):
            nid = _vertex_node_id(road.id, i)
            g.coords[nid] = (lon, lat)
            node_ids.append(nid)
        for i in range(len(node_ids) - 1):
            a, b = node_ids[i], node_ids[i + 1]
            ca, cb = g.coords[a], g.coords[b]
            w = haversine_km(ca[0], ca[1], cb[0], cb[1])
            if w > 0:
                add_undirected_edge(g, a, b, w)
    return g


def polylines_from_roads(roads: list[ExistingAutoroadInput]) -> list[list[tuple[float, float]]]:
    out: list[list[tuple[float, float]]] = []
    for road in roads:
        coords = [(float(c[0]), float(c[1])) for c in road.coordinates if len(c) >= 2]
        if len(coords) >= 2:
            out.append(coords)
    return out
