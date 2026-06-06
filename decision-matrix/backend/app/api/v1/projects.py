"""Projects, POI, rates, and economic params API."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.rbac import require_roles
from app.api.v1.project_deps import get_user_project
from app.core.database import get_db
from app.models import (
    PointOfInterest,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    User,
)
from app.models.enums import AccessLevel, UserRole
from app.schemas import (
    CostRatesResponse,
    CostRatesUpdate,
    DistanceDefaultsResponse,
    DistanceDefaultsUpdate,
    EconomicParamsResponse,
    EconomicParamsUpdate,
    POICreate,
    POIResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
)
from app.services.cost_rates import DEFAULT_COST_RATES, merge_project_cost_rates
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS
from app.services.poi_create import create_poi_for_project
from app.services.project_access import list_accessible_projects
from app.services.project_delete import delete_project_cascade
from app.services.project_setup import create_project_with_defaults
from app.services.serializers import load_project_owners, poi_to_response, project_to_response

projects_router = APIRouter(tags=["projects"])


@projects_router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    projects = await list_accessible_projects(user, db)
    owners = await load_project_owners(db, projects)
    out = []
    for p in projects:
        cnt = await db.scalar(select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == p.id))
        out.append(project_to_response(p, poi_count=cnt or 0, owner=owners.get(p.user_id)))
    return out


@projects_router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    user: User = Depends(require_roles(UserRole.admin, UserRole.analyst)),
    db: AsyncSession = Depends(get_db),
):
    project = await create_project_with_defaults(
        db, user=user, name=data.name, description=data.description
    )
    return project_to_response(project, poi_count=0, owner=user)


@projects_router.get("/projects/{project_id}/distance-defaults", response_model=DistanceDefaultsResponse)
async def get_distance_defaults(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await get_user_project(project_id, user, db)
    row = await db.scalar(select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    if not row:
        raise HTTPException(status_code=404, detail="Distance defaults not found")
    return DistanceDefaultsResponse.model_validate(row)


@projects_router.put("/projects/{project_id}/distance-defaults", response_model=DistanceDefaultsResponse)
async def update_distance_defaults(
    project_id: UUID,
    data: DistanceDefaultsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    row = await db.scalar(select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    if not row:
        raise HTTPException(status_code=404, detail="Distance defaults not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return DistanceDefaultsResponse.model_validate(row)


@projects_router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await get_user_project(project_id, user, db)
    cnt = await db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    owner = await db.get(User, project.user_id)
    return project_to_response(project, poi_count=cnt or 0, owner=owner)


@projects_router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, data: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    project = await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    cnt = await db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    owner = await db.get(User, project.user_id)
    return project_to_response(project, poi_count=cnt or 0, owner=owner)


@projects_router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await get_user_project(project_id, user, db, min_access=AccessLevel.owner)
    await delete_project_cascade(db, project_id)
    await db.commit()


@projects_router.get("/projects/{project_id}/rates", response_model=CostRatesResponse)
async def get_rates(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await get_user_project(project_id, user, db)
    result = await db.execute(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates_row = result.scalar_one_or_none()
    rates = merge_project_cost_rates(rates_row.rates if rates_row else None)
    return CostRatesResponse(project_id=project_id, rates=rates)


@projects_router.put("/projects/{project_id}/rates", response_model=CostRatesResponse)
async def update_rates(
    project_id: UUID, data: CostRatesUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    result = await db.execute(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates_row = result.scalar_one_or_none()
    if not rates_row:
        rates_row = ProjectCostRates(project_id=project_id, rates=data.rates)
        db.add(rates_row)
    else:
        rates_row.rates = {**DEFAULT_COST_RATES, **rates_row.rates, **data.rates}
    await db.commit()
    await db.refresh(rates_row)
    return CostRatesResponse(
        project_id=project_id,
        rates=merge_project_cost_rates(rates_row.rates),
    )


@projects_router.get("/projects/{project_id}/economic-params", response_model=EconomicParamsResponse)
async def get_economic_params(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await get_user_project(project_id, user, db)
    result = await db.execute(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    params = {**DEFAULT_ECONOMIC_PARAMS, **(row.params if row else {})}
    return EconomicParamsResponse(project_id=project_id, params=params)


@projects_router.put("/projects/{project_id}/economic-params", response_model=EconomicParamsResponse)
async def update_economic_params(
    project_id: UUID,
    data: EconomicParamsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    result = await db.execute(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        row = ProjectEconomicParams(project_id=project_id, params=data.params)
        db.add(row)
    else:
        row.params = {**DEFAULT_ECONOMIC_PARAMS, **row.params, **data.params}
    await db.commit()
    return EconomicParamsResponse(
        project_id=project_id, params={**DEFAULT_ECONOMIC_PARAMS, **row.params}
    )


@projects_router.get("/projects/{project_id}/pois", response_model=list[POIResponse])
async def list_pois(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await get_user_project(project_id, user, db)
    result = await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == project_id))
    pois = result.scalars().all()
    return [poi_to_response(poi) for poi in pois]


@projects_router.post("/projects/{project_id}/pois", response_model=POIResponse, status_code=201)
async def create_poi(
    project_id: UUID, data: POICreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    poi = await create_poi_for_project(db, project_id, data)
    return poi_to_response(poi)
