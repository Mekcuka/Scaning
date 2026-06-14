"""Projects, POI, rates, and economic params API."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.rbac import require_roles
from app.core.database import get_db
from app.models import User
from app.models.enums import UserRole
from app.schemas import (
    CostRatesResponse,
    CostRatesUpdate,
    DistanceDefaultsResponse,
    DistanceDefaultsUpdate,
    EconomicParamsResponse,
    EconomicParamsUpdate,
    FootprintConnectionTemplateResponse,
    FootprintConnectionTemplateUpdate,
    POICreate,
    POIResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.projects.api_handlers import (
    handle_create_poi,
    handle_create_project,
    handle_delete_project,
    handle_get_distance_defaults,
    handle_get_economic_params,
    handle_get_footprint_connection_template,
    handle_get_project,
    handle_get_rates,
    handle_list_pois,
    handle_list_projects,
    handle_update_distance_defaults,
    handle_update_economic_params,
    handle_update_footprint_connection_template,
    handle_update_project,
    handle_update_rates,
)

projects_router = APIRouter(tags=["projects"])


@projects_router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await handle_list_projects(user, db)


@projects_router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    user: User = Depends(require_roles(UserRole.admin, UserRole.analyst)),
    db: AsyncSession = Depends(get_db),
):
    return await handle_create_project(data, user, db)


@projects_router.get("/projects/{project_id}/distance-defaults", response_model=DistanceDefaultsResponse)
async def get_distance_defaults(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await handle_get_distance_defaults(project_id, user, db)


@projects_router.put("/projects/{project_id}/distance-defaults", response_model=DistanceDefaultsResponse)
async def update_distance_defaults(
    project_id: UUID,
    data: DistanceDefaultsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_distance_defaults(project_id, data, user, db)


@projects_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await handle_get_project(project_id, user, db)


@projects_router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, data: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await handle_update_project(project_id, data, user, db)


@projects_router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await handle_delete_project(project_id, user, db)


@projects_router.get("/projects/{project_id}/rates", response_model=CostRatesResponse)
async def get_rates(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await handle_get_rates(project_id, user, db)


@projects_router.put("/projects/{project_id}/rates", response_model=CostRatesResponse)
async def update_rates(
    project_id: UUID, data: CostRatesUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await handle_update_rates(project_id, data, user, db)


@projects_router.get("/projects/{project_id}/economic-params", response_model=EconomicParamsResponse)
async def get_economic_params(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await handle_get_economic_params(project_id, user, db)


@projects_router.put("/projects/{project_id}/economic-params", response_model=EconomicParamsResponse)
async def update_economic_params(
    project_id: UUID,
    data: EconomicParamsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_economic_params(project_id, data, user, db)


@projects_router.get(
    "/projects/{project_id}/footprint-connection-template",
    response_model=FootprintConnectionTemplateResponse,
)
async def get_footprint_connection_template(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await handle_get_footprint_connection_template(project_id, user, db)


@projects_router.put(
    "/projects/{project_id}/footprint-connection-template",
    response_model=FootprintConnectionTemplateResponse,
)
async def update_footprint_connection_template(
    project_id: UUID,
    data: FootprintConnectionTemplateUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_footprint_connection_template(project_id, data, user, db)


@projects_router.get("/projects/{project_id}/pois", response_model=list[POIResponse])
async def list_pois(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await handle_list_pois(project_id, user, db)


@projects_router.post("/projects/{project_id}/pois", response_model=POIResponse, status_code=201)
async def create_poi(
    project_id: UUID, data: POICreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    return await handle_create_poi(project_id, data, user, db)
