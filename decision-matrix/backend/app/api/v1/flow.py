"""Fluid flow schematic API (PFD)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import PointOfInterest, Project, User
from app.schemas import (
    EconomicFlowResponse,
    FlowSchematicResponse,
    FlowSchematicSave,
)
from app.services.economic_flow_schematic import get_economic_flow_schematic
from app.services.flow_schematic_store import (
    delete_flow_schematic_layout,
    get_flow_schematic,
    save_flow_schematic,
)

flow_router = APIRouter()


async def _project(project_id: UUID, user: User, db: AsyncSession) -> Project:
    row = await db.scalar(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row


async def _poi(project_id: UUID, poi_id: UUID, db: AsyncSession) -> PointOfInterest:
    poi = await db.scalar(
        select(PointOfInterest).where(
            PointOfInterest.id == poi_id,
            PointOfInterest.project_id == project_id,
        )
    )
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi


@flow_router.get(
    "/projects/{project_id}/pois/{poi_id}/flow-schematic",
    response_model=FlowSchematicResponse,
)
async def get_flow_schematic_endpoint(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    poi = await _poi(project_id, poi_id, db)
    data = await get_flow_schematic(db, project_id, poi)
    return FlowSchematicResponse(**data)


@flow_router.put(
    "/projects/{project_id}/pois/{poi_id}/flow-schematic",
    response_model=FlowSchematicResponse,
)
async def put_flow_schematic(
    project_id: UUID,
    poi_id: UUID,
    body: FlowSchematicSave,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    poi = await _poi(project_id, poi_id, db)
    node_ids = {n.id for n in body.nodes}
    for edge in body.edges:
        if edge.source not in node_ids or edge.target not in node_ids:
            raise HTTPException(status_code=400, detail="Edge references unknown node")
    data = await save_flow_schematic(db, poi, body.nodes, body.edges)
    await db.commit()
    return FlowSchematicResponse(**data)


@flow_router.delete(
    "/projects/{project_id}/pois/{poi_id}/flow-schematic",
    response_model=FlowSchematicResponse,
)
async def reset_flow_schematic(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    poi = await _poi(project_id, poi_id, db)
    data = await get_flow_schematic(db, project_id, poi)
    return FlowSchematicResponse(**data)


@flow_router.get(
    "/projects/{project_id}/pois/{poi_id}/economic-flow-schematic",
    response_model=EconomicFlowResponse,
)
async def get_economic_flow_schematic_endpoint(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    poi = await _poi(project_id, poi_id, db)
    data = await get_economic_flow_schematic(db, project_id, poi)
    return EconomicFlowResponse(**data)
