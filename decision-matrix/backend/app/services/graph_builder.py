"""Build infrastructure graph from line objects (FR-2.4.5)."""

import math
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.geometry_utils import point_wkt
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
)


def _haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


async def clear_network_topology(db: AsyncSession, network_id: UUID) -> None:
    """Remove all nodes and edges before a full rebuild."""
    await db.execute(delete(InfrastructureEdge).where(InfrastructureEdge.network_id == network_id))
    await db.execute(delete(InfrastructureNode).where(InfrastructureNode.network_id == network_id))


async def prune_disconnected_nodes(db: AsyncSession, network_id: UUID) -> None:
    """Drop nodes that are not endpoints of any edge (e.g. after line object delete)."""
    edges = (
        await db.execute(select(InfrastructureEdge).where(InfrastructureEdge.network_id == network_id))
    ).scalars().all()
    if not edges:
        await db.execute(delete(InfrastructureNode).where(InfrastructureNode.network_id == network_id))
        return
    used: set[UUID] = set()
    for edge in edges:
        used.add(edge.from_node_id)
        used.add(edge.to_node_id)
    nodes = (
        await db.execute(select(InfrastructureNode).where(InfrastructureNode.network_id == network_id))
    ).scalars().all()
    for node in nodes:
        if node.id not in used:
            await db.delete(node)


async def get_or_create_network(db: AsyncSession, project_id: UUID, name: str = "Сеть") -> InfrastructureNetwork:
    net = await db.scalar(
        select(InfrastructureNetwork).where(InfrastructureNetwork.project_id == project_id).limit(1)
    )
    if net:
        return net
    net = InfrastructureNetwork(project_id=project_id, name=name)
    db.add(net)
    await db.flush()
    return net


async def build_network_from_lines(
    db: AsyncSession,
    project_id: UUID,
    *,
    network_name: str = "Сеть",
) -> InfrastructureNetwork:
    """Split line infrastructure into nodes and edges (full rebuild)."""
    net = await get_or_create_network(db, project_id, network_name)
    await clear_network_topology(db, net.id)
    q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.end_longitude.isnot(None),
        )
    )
    lines = (await db.execute(q)).scalars().all()
    node_cache: dict[tuple[float, float], InfrastructureNode] = {}

    async def node_at(lon: float, lat: float, obj_id: UUID | None = None) -> InfrastructureNode:
        key = (round(lon, 6), round(lat, 6))
        if key in node_cache:
            return node_cache[key]
        n = InfrastructureNode(
            network_id=net.id,
            infrastructure_object_id=obj_id,
            longitude=lon,
            latitude=lat,
            geometry=point_wkt(lon, lat),
        )
        db.add(n)
        await db.flush()
        node_cache[key] = n
        return n

    for obj in lines:
        coords: list[tuple[float, float]] = [(obj.longitude, obj.latitude)]
        if obj.properties and obj.properties.get("coordinates"):
            for c in obj.properties["coordinates"]:
                coords.append((float(c[0]), float(c[1])))
        elif obj.end_longitude is not None:
            coords.append((obj.end_longitude, obj.end_latitude))
        else:
            continue

        prev: InfrastructureNode | None = None
        for i, (lon, lat) in enumerate(coords):
            n = await node_at(lon, lat, obj.id if i == 0 else None)
            if prev:
                length = _haversine_km(prev.longitude, prev.latitude, lon, lat)
                db.add(
                    InfrastructureEdge(
                        network_id=net.id,
                        from_node_id=prev.id,
                        to_node_id=n.id,
                        infrastructure_object_id=obj.id,
                        length_km=length,
                    )
                )
            prev = n

    await db.flush()
    return net
