"""HTTP orchestration for infrastructure layer BFF."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_layer, get_user_project, require_infra_write
from app.models import InfrastructureLayer, User
from app.schemas import LayerCreate, LayerResponse, LayerUpdate


def layer_to_response(layer: InfrastructureLayer) -> LayerResponse:
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


async def handle_list_layers(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> list[LayerResponse]:
    await get_user_project(project_id, user, db)
    result = await db.execute(
        select(InfrastructureLayer)
        .where(InfrastructureLayer.project_id == project_id)
        .order_by(InfrastructureLayer.sort_order, InfrastructureLayer.name)
    )
    return [layer_to_response(layer) for layer in result.scalars().all()]


async def handle_create_layer(
    project_id: UUID,
    data: LayerCreate,
    user: User,
    db: AsyncSession,
) -> LayerResponse:
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
    return layer_to_response(layer)


async def handle_update_layer(
    project_id: UUID,
    layer_id: UUID,
    data: LayerUpdate,
    user: User,
    db: AsyncSession,
) -> LayerResponse:
    await require_infra_write(project_id, user, db)
    layer = await get_layer(layer_id, project_id, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(layer, field, value)
    await db.commit()
    await db.refresh(layer)
    return layer_to_response(layer)


async def handle_delete_layer(
    project_id: UUID,
    layer_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await require_infra_write(project_id, user, db)
    layer = await get_layer(layer_id, project_id, db)
    await db.delete(layer)
    await db.commit()
