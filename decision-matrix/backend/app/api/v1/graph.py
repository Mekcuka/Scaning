"""Infrastructure graph API (FR-2.4.5)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import InfrastructureEdge, InfrastructureNetwork, InfrastructureNode, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.services.graph_builder import build_network_from_lines
from app.services.project_access import resolve_project

graph_router = APIRouter()


class NetworkResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str

    model_config = {"from_attributes": True}


class NodeResponse(BaseModel):
    id: UUID
    network_id: UUID
    infrastructure_object_id: UUID | None
    lon: float
    lat: float


class EdgeResponse(BaseModel):
    id: UUID
    network_id: UUID
    from_node_id: UUID
    to_node_id: UUID
    length_km: float


async def _project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    min_access: AccessLevel = AccessLevel.read,
) -> Project:
    return await resolve_project(project_id, user, db, min_access=min_access, write_scope=WriteScope.infra)


@graph_router.get("/projects/{project_id}/infrastructure/networks", response_model=list[NetworkResponse])
async def list_networks(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _project(project_id, user, db)
    rows = (await db.execute(select(InfrastructureNetwork).where(InfrastructureNetwork.project_id == project_id))).scalars().all()
    return rows


@graph_router.post("/projects/{project_id}/infrastructure/networks/build", response_model=NetworkResponse)
async def build_network(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _project(project_id, user, db, min_access=AccessLevel.write)
    net = await build_network_from_lines(db, project_id)
    await db.commit()
    await db.refresh(net)
    return net


@graph_router.get("/projects/{project_id}/infrastructure/networks/{network_id}/nodes", response_model=list[NodeResponse])
async def list_nodes(
    project_id: UUID,
    network_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    nodes = (
        await db.execute(select(InfrastructureNode).where(InfrastructureNode.network_id == network_id))
    ).scalars().all()
    edges = (
        await db.execute(select(InfrastructureEdge).where(InfrastructureEdge.network_id == network_id))
    ).scalars().all()
    used_node_ids: set[UUID] = set()
    for edge in edges:
        used_node_ids.add(edge.from_node_id)
        used_node_ids.add(edge.to_node_id)
    return [
        NodeResponse(
            id=n.id,
            network_id=n.network_id,
            infrastructure_object_id=n.infrastructure_object_id,
            lon=n.longitude,
            lat=n.latitude,
        )
        for n in nodes
        if n.id in used_node_ids
    ]


@graph_router.get("/projects/{project_id}/infrastructure/networks/{network_id}/edges", response_model=list[EdgeResponse])
async def list_edges(
    project_id: UUID,
    network_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    node_ids = {
        row[0]
        for row in (
            await db.execute(select(InfrastructureNode.id).where(InfrastructureNode.network_id == network_id))
        ).all()
    }
    rows = (
        await db.execute(select(InfrastructureEdge).where(InfrastructureEdge.network_id == network_id))
    ).scalars().all()
    return [
        EdgeResponse(
            id=e.id,
            network_id=e.network_id,
            from_node_id=e.from_node_id,
            to_node_id=e.to_node_id,
            length_km=e.length_km,
        )
        for e in rows
        if e.from_node_id in node_ids and e.to_node_id in node_ids
    ]
