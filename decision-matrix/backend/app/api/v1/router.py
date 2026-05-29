from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, decode_token, get_password_hash, verify_password
from app.models import (
    PointOfInterest,
    Project,
    ProjectCostRates,
    ProjectDistanceDefaults,
    ProjectEconomicParams,
    Scenario,
    ScenarioCriterionValue,
    User,
)
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
    RankingRequest,
    RankingResponse,
    RankingRunResponse,
    RankingSensitivityResponse,
    RankingSettingsResponse,
    RankingSettingsUpdate,
    RankingCriterionValuesUpdate,
    RankingMatrixResponse,
    RankingAhpCalculateRequest,
    RankingAhpCalculateResponse,
    ScenarioResponse,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.services.calculations import (
    rebalance_weights,
    calc_topsis_scores,
    calc_wsm_scores,
    normalize_matrix,
    rank_alternatives,
    calc_ahp_weights,
    calc_ahp_consistency_ratio,
)
from app.services.ranking_service import (
    DEFAULT_RANKING_WEIGHTS,
    build_ranking_matrix,
    compute_project_pois_ranking,
    compute_ranking_for_scenarios,
    get_or_create_ranking_settings,
    list_scenarios_for_ranking,
    load_stored_criterion_values,
    settings_to_response,
    validate_weights,
)
from app.services.cost_rates import DEFAULT_COST_RATES, merge_project_cost_rates
from app.services.economic_rates import DEFAULT_ECONOMIC_PARAMS
from app.services.project_delete import delete_project_cascade
from app.api.v1.flow import flow_router
from app.api.v1.graph import graph_router
from app.api.v1.import_connections import connections_router
from app.api.v1.map import map_router
from app.geo.geometry_utils import point_wkt
from app.services.infrastructure_analysis import link_poi_scenarios, run_poi_analysis, run_project_pois_analysis
from app.services.serializers import poi_to_response

router = APIRouter()
router.include_router(map_router)
router.include_router(graph_router)
router.include_router(flow_router)
router.include_router(connections_router)


@router.post("/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=data.email,
        username=data.username,
        password_hash=get_password_hash(data.password),
        role="analyst",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/auth/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/auth/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return user


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).where(Project.user_id == user.id).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    out = []
    for p in projects:
        cnt = await db.scalar(select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == p.id))
        out.append(
            ProjectResponse(
                id=p.id,
                name=p.name,
                description=p.description,
                status=p.status,
                visibility=p.visibility,
                poi_count=cnt or 0,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return out


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(data: ProjectCreate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    project = Project(user_id=user.id, name=data.name, description=data.description, status="draft")
    db.add(project)
    await db.flush()
    db.add(ProjectCostRates(project_id=project.id, rates=dict(DEFAULT_COST_RATES)))
    db.add(ProjectEconomicParams(project_id=project.id, params=dict(DEFAULT_ECONOMIC_PARAMS)))
    db.add(ProjectDistanceDefaults(project_id=project.id))
    db.add(Scenario(project_id=project.id, name="Базовый", scenario_type="base"))
    await db.commit()
    await db.refresh(project)
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        visibility=project.visibility,
        poi_count=0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


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
    await _get_user_project(project_id, user, db)
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
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        visibility=project.visibility,
        poi_count=cnt or 0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID, data: ProjectUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    project = await _get_user_project(project_id, user, db)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    cnt = await db.scalar(
        select(func.count()).select_from(PointOfInterest).where(PointOfInterest.project_id == project.id)
    )
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        visibility=project.visibility,
        poi_count=cnt or 0,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/projects/{project_id}", status_code=204)
async def delete_project(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    owned = await db.scalar(
        select(Project.id).where(Project.id == project_id, Project.user_id == user.id)
    )
    if not owned:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
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
    await _get_user_project(project_id, user, db)
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
    await _get_user_project(project_id, user, db)
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
    await _get_user_project(project_id, user, db)
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
    await _get_user_project(project_id, user, db)
    payload = await run_project_pois_analysis(db, project_id)
    await db.commit()
    return payload


@router.post("/projects/{project_id}/pois/{poi_id}/analyze")
async def analyze_poi(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    result = await run_poi_analysis(db, project_id, poi)
    await link_poi_scenarios(db, project_id, poi.id, result)
    await db.commit()
    return result


@router.get("/projects/{project_id}/scenarios", response_model=list[ScenarioResponse])
async def list_scenarios(project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _get_user_project(project_id, user, db)
    result = await db.execute(select(Scenario).where(Scenario.project_id == project_id))
    return result.scalars().all()


@router.get(
    "/projects/{project_id}/pois/{poi_id}/ranking",
    response_model=RankingSettingsResponse,
)
async def get_ranking_settings(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    row = await get_or_create_ranking_settings(db, project_id, poi_id)
    await db.commit()
    return RankingSettingsResponse(**settings_to_response(row))


@router.put(
    "/projects/{project_id}/pois/{poi_id}/ranking",
    response_model=RankingSettingsResponse,
)
async def update_ranking_settings(
    project_id: UUID,
    poi_id: UUID,
    data: RankingSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    row = await get_or_create_ranking_settings(db, project_id, poi_id)
    payload = data.model_dump(exclude_unset=True)
    if "algorithm" in payload and payload["algorithm"]:
        row.algorithm = str(payload["algorithm"]).lower()
    if "criteria" in payload and payload["criteria"] is not None:
        row.criteria = [c.model_dump() if hasattr(c, "model_dump") else c for c in payload["criteria"]]
    if "weights" in payload and payload["weights"] is not None:
        validate_weights(payload["weights"])
        row.weights = payload["weights"]
    if "default_expert_values" in payload and payload["default_expert_values"] is not None:
        row.default_expert_values = payload["default_expert_values"]
    if "ahp_pairwise" in payload and payload["ahp_pairwise"] is not None:
        row.ahp_pairwise = payload["ahp_pairwise"]
    await db.commit()
    await db.refresh(row)
    return RankingSettingsResponse(**settings_to_response(row))


@router.post(
    "/projects/{project_id}/pois/{poi_id}/ranking/ahp/calculate",
    response_model=RankingAhpCalculateResponse,
)
async def calculate_ranking_ahp_weights(
    project_id: UUID,
    poi_id: UUID,
    data: RankingAhpCalculateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    row = await get_or_create_ranking_settings(db, project_id, poi_id)
    weights = calc_ahp_weights(data.ahp_pairwise)
    cr = calc_ahp_consistency_ratio(data.ahp_pairwise)
    validate_weights(weights)
    row.ahp_pairwise = data.ahp_pairwise
    row.weights = weights
    await db.commit()
    return RankingAhpCalculateResponse(weights=weights, consistency_ratio=round(cr, 4))


@router.get(
    "/projects/{project_id}/pois/{poi_id}/ranking/matrix",
    response_model=RankingMatrixResponse,
)
async def get_ranking_matrix(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    settings = await get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await list_scenarios_for_ranking(db, project_id, poi_id)
    values_map = await load_stored_criterion_values(db, settings.id)
    matrix = build_ranking_matrix(scenarios, settings, values_map)
    await db.commit()
    return RankingMatrixResponse(**matrix)


@router.put("/projects/{project_id}/pois/{poi_id}/ranking/criterion-values")
async def update_ranking_criterion_values(
    project_id: UUID,
    poi_id: UUID,
    data: RankingCriterionValuesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    ranking = await get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await list_scenarios_for_ranking(db, project_id, poi_id)
    scenario_map = {str(sc.id): sc for sc in scenarios}

    for scenario_id, criterion_map in data.values.items():
        scenario = scenario_map.get(scenario_id)
        if not scenario:
            continue
        for criterion_id, value in criterion_map.items():
            row = await db.scalar(
                select(ScenarioCriterionValue).where(
                    ScenarioCriterionValue.ranking_settings_id == ranking.id,
                    ScenarioCriterionValue.scenario_id == scenario.id,
                    ScenarioCriterionValue.criterion_id == criterion_id,
                )
            )
            if row is None:
                row = ScenarioCriterionValue(
                    ranking_settings_id=ranking.id,
                    scenario_id=scenario.id,
                    criterion_id=criterion_id,
                    value=float(value),
                )
                db.add(row)
            else:
                row.value = float(value)
    await db.commit()
    return {"ok": True}


@router.post(
    "/projects/{project_id}/ranking/pois/calculate",
    response_model=RankingRunResponse,
)
async def calculate_project_pois_ranking(
    project_id: UUID,
    settings_poi_id: UUID = Query(..., description="POI whose weights/algorithm apply to all POIs"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rank all POIs in the project (base scenario per POI) using weights from settings_poi_id."""
    await _get_user_project(project_id, user, db)
    await _get_poi(settings_poi_id, project_id, db)
    result = await compute_project_pois_ranking(db, project_id, settings_poi_id)
    await db.commit()
    return RankingRunResponse(**result)


@router.post(
    "/projects/{project_id}/pois/{poi_id}/ranking/calculate",
    response_model=RankingRunResponse,
)
async def calculate_poi_ranking(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    settings = await get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await list_scenarios_for_ranking(db, project_id, poi_id)
    values_map = await load_stored_criterion_values(db, settings.id)
    result = compute_ranking_for_scenarios(scenarios, settings, values_map)
    await db.commit()
    return RankingRunResponse(**result)


@router.post(
    "/projects/{project_id}/pois/{poi_id}/ranking/sensitivity",
    response_model=RankingSensitivityResponse,
)
async def calculate_poi_ranking_sensitivity(
    project_id: UUID,
    poi_id: UUID,
    criterion_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_user_project(project_id, user, db)
    await _get_poi(poi_id, project_id, db)
    settings = await get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await list_scenarios_for_ranking(db, project_id, poi_id)
    values_map = await load_stored_criterion_values(db, settings.id)
    points = []
    base_weights = dict(settings.weights or DEFAULT_RANKING_WEIGHTS)
    if criterion_id not in base_weights:
        raise HTTPException(status_code=400, detail="Unknown criterion_id")
    for delta in (-0.2, -0.1, 0.0, 0.1, 0.2):
        weights = rebalance_weights(base_weights, criterion_id, delta)
        ranking_result = compute_ranking_for_scenarios(scenarios, settings, values_map, custom_weights=weights)
        points.append({"delta": delta, "alternatives": ranking_result["alternatives"]})
    await db.commit()
    return RankingSensitivityResponse(
        algorithm=settings.algorithm,
        criterion_id=criterion_id,
        points=points,
    )


@router.post("/ranking/calculate", response_model=RankingResponse)
async def calculate_ranking(data: RankingRequest, user: User = Depends(get_current_user)):
    normalized = normalize_matrix(data.criteria_values, data.criterion_types)
    if data.algorithm.lower() == "wsm":
        scores = calc_wsm_scores(normalized, data.weights)
    else:
        scores = calc_topsis_scores(normalized, data.weights)
    return RankingResponse(
        algorithm=data.algorithm,
        scores=scores,
        ranking=rank_alternatives(scores),
    )


async def _get_user_project(project_id: UUID, user: User, db: AsyncSession) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.user_id == user.id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


async def _get_poi(poi_id: UUID, project_id: UUID, db: AsyncSession) -> PointOfInterest:
    result = await db.execute(
        select(PointOfInterest).where(PointOfInterest.id == poi_id, PointOfInterest.project_id == project_id)
    )
    poi = result.scalar_one_or_none()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")
    return poi


