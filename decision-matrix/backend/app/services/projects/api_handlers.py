"""HTTP orchestration for projects BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.project_deps import get_user_project
from app.geo.footprint_connection_template import sanitize_footprint_connection_template
from app.models import (
    PointOfInterest,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    ProjectFootprintConnectionTemplate,
    User,
)
from app.models.enums import AccessLevel
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
from app.services.cost_rates import DEFAULT_COST_RATES, merge_project_cost_rates
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS
from app.services.poi_create import create_poi_for_project
from app.services.project_access import list_accessible_projects
from app.services.project_delete import delete_project_cascade
from app.services.project_setup import create_project_with_defaults
from app.services.serializers import load_project_owners, poi_to_response, project_to_response


async def _project_response(db: AsyncSession, project) -> ProjectResponse:
    cnt = await db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    owner = await db.get(User, project.user_id)
    return project_to_response(project, poi_count=cnt or 0, owner=owner)


async def handle_list_projects(user: User, db: AsyncSession) -> list[ProjectResponse]:
    projects = await list_accessible_projects(user, db)
    owners = await load_project_owners(db, projects)
    out = []
    for p in projects:
        cnt = await db.scalar(
            select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == p.id)
        )
        out.append(project_to_response(p, poi_count=cnt or 0, owner=owners.get(p.user_id)))
    return out


async def handle_create_project(
    data: ProjectCreate,
    user: User,
    db: AsyncSession,
) -> ProjectResponse:
    project = await create_project_with_defaults(
        db, user=user, name=data.name, description=data.description
    )
    return project_to_response(project, poi_count=0, owner=user)


async def handle_get_distance_defaults(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> DistanceDefaultsResponse:
    await get_user_project(project_id, user, db)
    row = await db.scalar(select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    if not row:
        raise HTTPException(status_code=404, detail="Distance defaults not found")
    return DistanceDefaultsResponse.model_validate(row)


async def handle_update_distance_defaults(
    project_id: UUID,
    data: DistanceDefaultsUpdate,
    user: User,
    db: AsyncSession,
) -> DistanceDefaultsResponse:
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    row = await db.scalar(select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    if not row:
        raise HTTPException(status_code=404, detail="Distance defaults not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return DistanceDefaultsResponse.model_validate(row)


async def handle_get_project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> ProjectResponse:
    project = await get_user_project(project_id, user, db)
    return await _project_response(db, project)


async def handle_update_project(
    project_id: UUID,
    data: ProjectUpdate,
    user: User,
    db: AsyncSession,
) -> ProjectResponse:
    project = await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return await _project_response(db, project)


async def handle_delete_project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await get_user_project(project_id, user, db, min_access=AccessLevel.owner)
    await delete_project_cascade(db, project_id)
    await db.commit()


async def handle_get_rates(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> CostRatesResponse:
    await get_user_project(project_id, user, db)
    result = await db.execute(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates_row = result.scalar_one_or_none()
    rates = merge_project_cost_rates(rates_row.rates if rates_row else None)
    return CostRatesResponse(project_id=project_id, rates=rates)


async def handle_update_rates(
    project_id: UUID,
    data: CostRatesUpdate,
    user: User,
    db: AsyncSession,
) -> CostRatesResponse:
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


async def handle_get_economic_params(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> EconomicParamsResponse:
    await get_user_project(project_id, user, db)
    result = await db.execute(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    params = {**DEFAULT_ECONOMIC_PARAMS, **(row.params if row else {})}
    return EconomicParamsResponse(project_id=project_id, params=params)


async def handle_update_economic_params(
    project_id: UUID,
    data: EconomicParamsUpdate,
    user: User,
    db: AsyncSession,
) -> EconomicParamsResponse:
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


async def handle_get_footprint_connection_template(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> FootprintConnectionTemplateResponse:
    await get_user_project(project_id, user, db)
    result = await db.execute(
        select(ProjectFootprintConnectionTemplate).where(
            ProjectFootprintConnectionTemplate.project_id == project_id
        )
    )
    row = result.scalar_one_or_none()
    template = sanitize_footprint_connection_template(row.template if row else {})
    return FootprintConnectionTemplateResponse(project_id=project_id, template=template)


async def handle_update_footprint_connection_template(
    project_id: UUID,
    data: FootprintConnectionTemplateUpdate,
    user: User,
    db: AsyncSession,
) -> FootprintConnectionTemplateResponse:
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    cleaned = sanitize_footprint_connection_template(data.template)
    result = await db.execute(
        select(ProjectFootprintConnectionTemplate).where(
            ProjectFootprintConnectionTemplate.project_id == project_id
        )
    )
    row = result.scalar_one_or_none()
    if not row:
        row = ProjectFootprintConnectionTemplate(project_id=project_id, template=cleaned)
        db.add(row)
    else:
        row.template = cleaned
    await db.commit()
    await db.refresh(row)
    return FootprintConnectionTemplateResponse(project_id=project_id, template=cleaned)


async def handle_list_pois(
    project_id: UUID,
    user: User,
    db: AsyncSession,
) -> list[POIResponse]:
    await get_user_project(project_id, user, db)
    result = await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == project_id))
    pois = result.scalars().all()
    return [poi_to_response(poi) for poi in pois]


async def handle_create_poi(
    project_id: UUID,
    data: POICreate,
    user: User,
    db: AsyncSession,
) -> POIResponse:
    await get_user_project(project_id, user, db, min_access=AccessLevel.write)
    poi = await create_poi_for_project(db, project_id, data)
    return poi_to_response(poi)
