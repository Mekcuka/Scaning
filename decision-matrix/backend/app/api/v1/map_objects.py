"""Infrastructure objects, batch delete, autoroad-connect."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas import (
    AutoroadConnectRequest,
    AutoroadConnectResponse,
    FacilityInfraObjectCreate,
    InfraObjectCreate,
    InfraObjectResponse,
    InfraObjectUpdate,
    MapBatchDeleteRequest,
    MapBatchDeleteResponse,
    MapBatchPasteRequest,
    MapBatchPasteResponse,
)
from app.services.map_objects.api_handlers import (
    handle_autoroad_connect,
    handle_batch_delete,
    handle_batch_paste,
    handle_clear_project_infrastructure,
    handle_create_facility_infra_object,
    handle_create_infra_object,
    handle_delete_infra_object,
    handle_list_infra_objects,
    handle_update_infra_object,
)

objects_router = APIRouter(tags=["map-objects"])


@objects_router.get("/projects/{project_id}/infrastructure/objects", response_model=list[InfraObjectResponse])
async def list_infra_objects(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    subtype: str | None = None,
    q: str | None = None,
    bbox: str | None = Query(None, description="minLon,minLat,maxLon,maxLat"),
    visible_layers_only: bool = True,
):
    return await handle_list_infra_objects(
        project_id,
        user,
        db,
        subtype=subtype,
        q=q,
        bbox=bbox,
        visible_layers_only=visible_layers_only,
    )


@objects_router.post("/projects/{project_id}/infrastructure/clear")
async def clear_project_infrastructure_route(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove all infrastructure objects and graph data for the project (POIs are kept)."""
    return await handle_clear_project_infrastructure(project_id, user, db)


@objects_router.post("/projects/{project_id}/infrastructure/objects", response_model=InfraObjectResponse, status_code=201)
async def create_infra_object(
    project_id: UUID,
    data: InfraObjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_create_infra_object(project_id, data, user, db)


@objects_router.post(
    "/projects/{project_id}/infrastructure/facility-objects",
    response_model=InfraObjectResponse,
    status_code=201,
)
async def create_facility_infra_object(
    project_id: UUID,
    data: FacilityInfraObjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Создать НПЗ или НПС — в теле обязательно поле subtype."""
    return await handle_create_facility_infra_object(project_id, data, user, db)


@objects_router.post("/projects/{project_id}/infrastructure/autoroad-connect")
async def autoroad_connect_objects(
    project_id: UUID,
    data: AutoroadConnectRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Соединить выбранные точечные объекты по сети автодорог (deprecated — use autoroad-network)."""
    return await handle_autoroad_connect(project_id, data, user, db)


@objects_router.patch(
    "/projects/{project_id}/infrastructure/objects/{object_id}", response_model=InfraObjectResponse
)
async def update_infra_object(
    project_id: UUID,
    object_id: UUID,
    data: InfraObjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_infra_object(project_id, object_id, data, user, db)


@objects_router.post(
    "/projects/{project_id}/map/batch-delete",
    response_model=MapBatchDeleteResponse,
)
async def batch_delete_map_objects(
    project_id: UUID,
    data: MapBatchDeleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete many infra objects and/or POIs in one transaction (avoids parallel DELETE races)."""
    return await handle_batch_delete(project_id, data, user, db)


@objects_router.post(
    "/projects/{project_id}/map/batch-paste",
    response_model=MapBatchPasteResponse,
)
async def batch_paste_map_objects(
    project_id: UUID,
    data: MapBatchPasteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create many POIs and infra objects from map clipboard in one transaction."""
    return await handle_batch_paste(project_id, data, user, db)


@objects_router.delete("/projects/{project_id}/infrastructure/objects/{object_id}", status_code=204)
async def delete_infra_object(
    project_id: UUID,
    object_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await handle_delete_infra_object(project_id, object_id, user, db)
