from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, verify_csrf
from app.api.rbac import require_roles
from app.api.v1.admin import admin_router
from app.api.v1.admin_jobs import admin_jobs_router
from app.api.v1.auth import auth_router
from app.core.database import get_db
from app.models import (
    PointOfInterest,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    User,
)
from app.models.enums import AccessLevel, UserRole, WriteScope
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
    ProjectJobCreateResponse,
)
from app.services.cost_rates import DEFAULT_COST_RATES, merge_project_cost_rates
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS
from app.services.project_delete import delete_project_cascade
from app.services.project_access import list_accessible_projects, resolve_project
from app.api.v1.flow import flow_router
from app.api.v1.graph import graph_router
from app.api.v1.import_connections import connections_router
from app.api.v1.sand_logistics import sand_logistics_router
from app.api.v1.jobs import jobs_router
from app.api.v1.map import map_router
from app.api.v1.one_pagers import one_pagers_router
from app.geo.geometry_utils import point_wkt
from app.services.infrastructure_analysis import run_poi_analysis, run_project_pois_analysis
from app.services.serializers import load_project_owners, poi_to_response, project_to_response

router = APIRouter(dependencies=[Depends(verify_csrf)])
router.include_router(auth_router)
router.include_router(admin_router)
router.include_router(admin_jobs_router)
router.include_router(one_pagers_router)
router.include_router(map_router)
router.include_router(graph_router)
router.include_router(flow_router)
router.include_router(connections_router)
router.include_router(sand_logistics_router)
router.include_router(jobs_router)


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    projects = await list_accessible_projects(user, db)
    owners = await load_project_owners(db, projects)
    out = []
    for p in projects:
        cnt = await db.scalar(select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == p.id))
        out.append(project_to_response(p, poi_count=cnt or 0, owner=owners.get(p.user_id)))
    return out


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    data: ProjectCreate,
    user: User = Depends(require_roles(UserRole.admin, UserRole.analyst)),
    db: AsyncSession = Depends(get_db),
):
    project = Project(user_id=user.id, name=data.name, description=data.description, status="draft")
    db.add(project)
    await db.flush()
    db.add(ProjectCostRates(project_id=project.id, rates=dict(DEFAULT_COST_RATES)))
    db.add(ProjectEconomicParams(project_id=project.id, params=dict(DEFAULT_ECONOMIC_PARAMS)))
    db.add(ProjectDistanceDefaults(project_id=project.id))
    await db.commit()
    await db.refresh(project)
    return project_to_response(project, poi_count=0, owner=user)


@router.get("/projects/{project_id}/distance-defaults", response_model=DistanceDefaultsResponse)
async def get_distance_defaults(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    row = await db.scalar(select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    if not row:
        raise HTTPException(status_code=404, detail="Distance defaults not found")
    return DistanceDefaultsResponse.model_validate(row)


@router.put("/projects/{project_id}/distance-defaults", response_model=DistanceDefaultsResponse)
async def update_distance_defaults(
    project_id: UUID,
    data: DistanceDefaultsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
    row = await db.scalar(select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id))
    if not row:
        raise HTTPException(status_code=404, detail="Distance defaults not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    await db.commit()
    await db.refresh(row)
    return DistanceDefaultsResponse.model_validate(row)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = await _get_user_project(project_id, user, db)
    cnt = await db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    owner = await db.get(User, project.user_id)
    return project_to_response(project, poi_count=cnt or 0, owner=owner)


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, data: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    project = await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    cnt = await db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    owner = await db.get(User, project.user_id)
    return project_to_response(project, poi_count=cnt or 0, owner=owner)


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.owner)
    await delete_project_cascade(db, project_id)
    await db.commit()


@router.get("/projects/{project_id}/rates", response_model=CostRatesResponse)
async def get_rates(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_user_project(project_id, user, db)
    result = await db.execute(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    rates_row = result.scalar_one_or_none()
    rates = merge_project_cost_rates(rates_row.rates if rates_row else None)
    return CostRatesResponse(project_id=project_id, rates=rates)


@router.put("/projects/{project_id}/rates", response_model=CostRatesResponse)
async def update_rates(
    project_id: UUID, data: CostRatesUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
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


@router.get("/projects/{project_id}/economic-params", response_model=EconomicParamsResponse)
async def get_economic_params(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    result = await db.execute(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id)
    )
    row = result.scalar_one_or_none()
    params = {**DEFAULT_ECONOMIC_PARAMS, **(row.params if row else {})}
    return EconomicParamsResponse(project_id=project_id, params=params)


@router.put("/projects/{project_id}/economic-params", response_model=EconomicParamsResponse)
async def update_economic_params(
    project_id: UUID,
    data: EconomicParamsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
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


@router.get("/projects/{project_id}/pois", response_model=list[POIResponse])
async def list_pois(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_user_project(project_id, user, db)
    result = await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == project_id))
    pois = result.scalars().all()
    return [poi_to_response(poi) for poi in pois]


@router.post("/projects/{project_id}/pois", response_model=POIResponse, status_code=201)
async def create_poi(
    project_id: UUID, data: POICreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
    defaults = await db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id)
    )
    poi = PointOfInterest(
        project_id=project_id,
        name=data.name,
        description=data.description,
        geometry=point_wkt(data.lon, data.lat),
        longitude=data.lon,
        latitude=data.lat,
        planned_production_volume=data.planned_production_volume,
        production_per_well=data.production_per_well,
        wells_per_pad=data.wells_per_pad,
        fluid_type=data.fluid_type,
        water_injection_volume=data.water_injection_volume,
        gas_factor=data.gas_factor,
        eng_power=data.eng_power,
        eng_injection=data.eng_injection,
        eng_gas=data.eng_gas,
        eng_oil_preparation=data.eng_oil_preparation,
        eng_well_gathering=data.eng_well_gathering,
        eng_transport=data.eng_transport,
    )
    if defaults:
        poi.threshold_gas_processing_km = defaults.threshold_gas_processing_km
        poi.threshold_gtes_km = defaults.threshold_gtes_km
        poi.threshold_substation_km = defaults.threshold_substation_km
        poi.threshold_refinery_km = defaults.threshold_refinery_km
        poi.max_total_line_autoroad_km = defaults.max_total_line_autoroad_km
        poi.max_total_line_oil_pipeline_km = defaults.max_total_line_oil_pipeline_km
        poi.max_total_line_gas_pipeline_km = defaults.max_total_line_gas_pipeline_km
        poi.max_total_line_water_pipeline_km = defaults.max_total_line_water_pipeline_km
        poi.max_total_line_power_line_km = defaults.max_total_line_power_line_km
        poi.km_per_pad_autoroad = defaults.km_per_pad_autoroad
        poi.km_per_pad_oil_pipeline = defaults.km_per_pad_oil_pipeline
        poi.km_per_pad_gas_pipeline = defaults.km_per_pad_gas_pipeline
        poi.km_per_pad_water_pipeline = defaults.km_per_pad_water_pipeline
        poi.km_per_pad_power_line = defaults.km_per_pad_power_line
    db.add(poi)
    await db.commit()
    await db.refresh(poi)
    return poi_to_response(poi)


@router.post("/projects/{project_id}/pois/analyze-all")
async def analyze_all_pois(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
    from app.services.job_enqueue import commit_and_schedule, create_and_schedule_job, jobs_async_enabled
    from app.services.project_jobs import JOB_TYPE_POI_ANALYZE_ALL, ActiveProjectJobError

    if jobs_async_enabled():
        try:
            job = await create_and_schedule_job(
                db,
                project_id=project_id,
                user_id=user.id,
                job_type=JOB_TYPE_POI_ANALYZE_ALL,
                payload={},
            )
            await commit_and_schedule(db, job)
        except ActiveProjectJobError as e:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Project already has an active job",
                    "active_job_id": str(e.active_job_id),
                },
            ) from e
        resp = ProjectJobCreateResponse(job_id=job.id, job_type=job.job_type, status=job.status)
        return JSONResponse(status_code=202, content=resp.model_dump(mode="json"))

    payload = await run_project_pois_analysis(db, project_id)
    await db.commit()
    return payload


@router.post("/projects/{project_id}/pois/{poi_id}/analyze")
async def analyze_poi(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db, min_access=AccessLevel.write)
    poi = await _get_poi(poi_id, project_id, db)
    result = await run_poi_analysis(db, project_id, poi)
    await db.commit()
    return result


async def _get_user_project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    min_access: AccessLevel = AccessLevel.read,
    write_scope: WriteScope = WriteScope.project,
) -> Project:
    return await resolve_project(
        project_id, user, db, min_access=min_access, write_scope=write_scope
    )


async def _get_poi(poi_id: UUID, project_id: UUID, db: AsyncSession) -> PointOfInterest:
    result = await db.execute(
        select(PointOfInterest).where(PointOfInterest.id == poi_id, PointOfInterest.project_id == project_id)
    )
    poi = result.scalar_one_or_none()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi


