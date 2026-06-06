"""Infrastructure layer CRUD."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import cast, delete, or_, select, String, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import (
    get_infra_object,
    get_layer,
    get_or_create_default_layer,
    get_poi,
    get_user_project,
    require_infra_write,
    require_project_write,
)
from app.core.database import get_db
from app.models import User

from app.models import InfrastructureLayer
from app.schemas import LayerCreate, LayerResponse, LayerUpdate

layers_router = APIRouter(tags=["map-layers"])

@layers_router.get("/projects/{project_id}/infrastructure/layers", response_model=list[LayerResponse])
async def list_layers(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await get_user_project(project_id, user, db)
    result = await db.execute(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
        .order_by(InfrastructureLayer.sort_order, InfrastructureLayer.name)
    )
    layers = result.scalars().all()
    return [
        LayerResponse(
            id=layer.id,
            project_id=layer.project_id,
            name=layer.name,
            layer_type=layer.layer_type,
            source_type=layer.source_type,
            is_visible=layer.is_visible,
            opacity=layer.opacity,
            sort_order=layer.sort_order,
            style_config=layer.style_config or {},
        )
        for layer in layers
    ]


@layers_router.post("/projects/{project_id}/infrastructure/layers", response_model=LayerResponse, status_code=201)
async def create_layer(
    project_id: UUID,
    data: LayerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_infra_write(project_id, user, db)
    layer = InfrastructureLayer(
        project_id=project_id,
        name=data.name,
        layer_type=data.layer_type,
        source_type=data.source_type,
        is_visible=data.is_visible,
        opacity=data.opacity,
        sort_order=data.sort_order,
        style_config=data.style_config,
    )
    db.add(layer)
    await db.commit()
    await db.refresh(layer)
    return LayerResponse(
        id=layer.id,
        project_id=layer.project_id,
        name=layer.name,
        layer_type=layer.layer_type,
        source_type=layer.source_type,
        is_visible=layer.is_visible,
        opacity=layer.opacity,
        sort_order=layer.sort_order,
        style_config=layer.style_config or {},
    )


@layers_router.patch("/projects/{project_id}/infrastructure/layers/{layer_id}", response_model=LayerResponse)
async def update_layer(
    project_id: UUID,
    layer_id: UUID,
    data: LayerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_infra_write(project_id, user, db)
    layer = await get_layer(layer_id, project_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(layer, field, value)
    await db.commit()
    await db.refresh(layer)
    return LayerResponse(
        id=layer.id,
        project_id=layer.project_id,
        name=layer.name,
        layer_type=layer.layer_type,
        source_type=layer.source_type,
        is_visible=layer.is_visible,
        opacity=layer.opacity,
        sort_order=layer.sort_order,
        style_config=layer.style_config or {},
    )


@layers_router.delete("/projects/{project_id}/infrastructure/layers/{layer_id}", status_code=204)
async def delete_layer(
    project_id: UUID,
    layer_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_infra_write(project_id, user, db)
    layer = await get_layer(layer_id, project_id, db)
    await db.delete(layer)
    await db.commit()
