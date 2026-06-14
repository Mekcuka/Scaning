"""Infrastructure layer CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas import LayerCreate, LayerResponse, LayerUpdate
from app.services.map_layers.api_handlers import (
    handle_create_layer,
    handle_delete_layer,
    handle_list_layers,
    handle_update_layer,
)

layers_router = APIRouter(tags=["map-layers"])


@layers_router.get("/projects/{project_id}/infrastructure/layers", response_model=list[LayerResponse])
async def list_layers(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_list_layers(project_id, user, db)


@layers_router.post("/projects/{project_id}/infrastructure/layers", response_model=LayerResponse, status_code=201)
async def create_layer(
    project_id: UUID,
    data: LayerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_create_layer(project_id, data, user, db)


@layers_router.patch("/projects/{project_id}/infrastructure/layers/{layer_id}", response_model=LayerResponse)
async def update_layer(
    project_id: UUID,
    layer_id: UUID,
    data: LayerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_layer(project_id, layer_id, data, user, db)


@layers_router.delete("/projects/{project_id}/infrastructure/layers/{layer_id}", status_code=204)
async def delete_layer(
    project_id: UUID,
    layer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await handle_delete_layer(project_id, layer_id, user, db)
