from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
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
    ProjectRankingSettings,
    Scenario,
    ScenarioCriterionValue,
    User,
)
from app.schemas import (
    CostRatesResponse,
    CostRatesUpdate,
    DistanceDefaultsResponse,
    DistanceDefaultsUpdate,
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
)
from app.services.cost_rates import DEFAULT_COST_RATES
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

DEFAULT_RANKING_CRITERIA = [
    {"id": "total_cost_mln", "name": "Общая стоимость", "type": "cost"},
    {"id": "total_distance_km", "name": "Общее расстояние", "type": "cost"},
    {"id": "exceed_count", "name": "Количество превышений", "type": "cost"},
    {"id": "risk", "name": "Риск реализации", "type": "cost"},
    {"id": "time_months", "name": "Время реализации", "type": "cost"},
    {"id": "reliability", "name": "Надежность инфраструктуры", "type": "benefit"},
]
DEFAULT_RANKING_WEIGHTS = {
    "total_cost_mln": 0.35,
    "total_distance_km": 0.15,
    "exceed_count": 0.2,
    "risk": 0.1,
    "time_months": 0.1,
    "reliability": 0.1,
}
DEFAULT_EXPERT_VALUES = {"risk": 5.0, "time_months": 12.0, "reliability": 5.0}


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
    rates = {**DEFAULT_COST_RATES, **(rates_row.rates if rates_row else {})}
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
    return CostRatesResponse(project_id=project_id, rates={**DEFAULT_COST_RATES, **rates_row.rates})


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
    row = await _get_or_create_ranking_settings(db, project_id, poi_id)
    await db.commit()
    return RankingSettingsResponse(
        algorithm=row.algorithm,
        criteria=row.criteria or DEFAULT_RANKING_CRITERIA,
        weights=row.weights or DEFAULT_RANKING_WEIGHTS,
    )


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
    row = await _get_or_create_ranking_settings(db, project_id, poi_id)
    payload = data.model_dump(exclude_unset=True)
    if "algorithm" in payload and payload["algorithm"]:
        row.algorithm = str(payload["algorithm"]).lower()
    if "criteria" in payload and payload["criteria"] is not None:
        row.criteria = payload["criteria"]
    if "weights" in payload and payload["weights"] is not None:
        _validate_weights(payload["weights"])
        row.weights = payload["weights"]
    await db.commit()
    await db.refresh(row)
    return RankingSettingsResponse(
        algorithm=row.algorithm,
        criteria=row.criteria or DEFAULT_RANKING_CRITERIA,
        weights=row.weights or DEFAULT_RANKING_WEIGHTS,
    )


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
    ranking = await _get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await _list_scenarios_for_ranking(db, project_id, poi_id)
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
    "/projects/{project_id}/pois/{poi_id}/ranking/calculate",
    response_model=RankingRunResponse,
)
async def calculate_poi_ranking(
    project_id: UUID, poi_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _get_user_project(project_id, user, db)
    poi = await _get_poi(poi_id, project_id, db)
    settings = await _get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await _list_scenarios_for_ranking(db, project_id, poi_id)
    values_map = await _load_stored_criterion_values(db, settings.id)
    ranking = _compute_ranking_for_scenarios(poi, scenarios, settings, values_map)
    await db.commit()
    return ranking


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
    poi = await _get_poi(poi_id, project_id, db)
    settings = await _get_or_create_ranking_settings(db, project_id, poi_id)
    scenarios = await _list_scenarios_for_ranking(db, project_id, poi_id)
    values_map = await _load_stored_criterion_values(db, settings.id)
    points = []
    base_weights = dict(settings.weights or DEFAULT_RANKING_WEIGHTS)
    if criterion_id not in base_weights:
        raise HTTPException(status_code=400, detail="Unknown criterion_id")
    for delta in (-0.2, -0.1, 0.0, 0.1, 0.2):
        weights = rebalance_weights(base_weights, criterion_id, delta)
        ranking_result = _compute_ranking_for_scenarios(poi, scenarios, settings, values_map, custom_weights=weights)
        points.append({"delta": delta, "alternatives": ranking_result.alternatives})
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


def _validate_weights(weights: dict[str, float]) -> None:
    total = sum(float(v) for v in weights.values())
    if abs(total - 1.0) > 0.001:
        raise HTTPException(status_code=400, detail="Weights sum must be 1.0")


def _scenario_metric_value(
    scenario: Scenario, poi: PointOfInterest, criterion_id: str, scenario_values: dict[str, float]
) -> float:
    results = scenario.results or {}
    analysis = results.get("analysis") if isinstance(results, dict) else None
    analysis_rows = analysis if isinstance(analysis, list) else []
    if criterion_id == "total_cost_mln":
        return float(results.get("total_cost_mln", 0.0))
    if criterion_id == "total_distance_km":
        return float(
            sum(float(row.get("distance_km", 0.0) or 0.0) for row in analysis_rows if isinstance(row, dict))
        )
    if criterion_id == "exceed_count":
        return float(
            sum(1 for row in analysis_rows if isinstance(row, dict) and row.get("status") == "exceeds_limit")
        )
    if criterion_id == "risk":
        return float(scenario_values.get("risk", DEFAULT_EXPERT_VALUES["risk"]))
    if criterion_id == "time_months":
        return float(scenario_values.get("time_months", DEFAULT_EXPERT_VALUES["time_months"]))
    if criterion_id == "reliability":
        return float(scenario_values.get("reliability", DEFAULT_EXPERT_VALUES["reliability"]))
    if criterion_id in scenario_values:
        return float(scenario_values[criterion_id])
    return float((scenario.results or {}).get(criterion_id, 0.0))


def _compute_ranking_for_scenarios(
    poi: PointOfInterest,
    scenarios: list[Scenario],
    settings: ProjectRankingSettings,
    values_map: dict[tuple[str, str], float],
    *,
    custom_weights: dict[str, float] | None = None,
) -> RankingRunResponse:
    criteria = settings.criteria or DEFAULT_RANKING_CRITERIA
    criterion_ids = [str(c.get("id")) for c in criteria]
    criterion_types = [str(c.get("type", "cost")) for c in criteria]
    weights_map = custom_weights or (settings.weights or DEFAULT_RANKING_WEIGHTS)
    _validate_weights(weights_map)
    weights = [float(weights_map.get(cid, 0.0)) for cid in criterion_ids]
    matrix: list[list[float]] = []
    for sc in scenarios:
        scenario_values = {
            criterion_id: value
            for (scenario_id, criterion_id), value in values_map.items()
            if scenario_id == str(sc.id)
        }
        row = [_scenario_metric_value(sc, poi, cid, scenario_values) for cid in criterion_ids]
        matrix.append(row)

    normalized = normalize_matrix(matrix, criterion_types)
    if (settings.algorithm or "topsis").lower() == "wsm":
        scores = calc_wsm_scores(normalized, weights)
    else:
        scores = calc_topsis_scores(normalized, weights)
    ranked = rank_alternatives(scores)
    ranked_map = {entry["index"]: entry for entry in ranked}
    alternatives = []
    for idx, scenario in enumerate(scenarios):
        rank_item = ranked_map[idx]
        alternatives.append(
            {
                "scenario_id": scenario.id,
                "name": scenario.name,
                "score": rank_item["score"],
                "rank": rank_item["rank"],
            }
        )
    return RankingRunResponse(algorithm=settings.algorithm, alternatives=alternatives)


async def _get_or_create_ranking_settings(
    db: AsyncSession, project_id: UUID, poi_id: UUID
) -> ProjectRankingSettings:
    row = await db.scalar(
        select(ProjectRankingSettings).where(
            ProjectRankingSettings.project_id == project_id, ProjectRankingSettings.poi_id == poi_id
        )
    )
    if row:
        return row
    row = ProjectRankingSettings(
        project_id=project_id,
        poi_id=poi_id,
        algorithm="topsis",
        criteria=list(DEFAULT_RANKING_CRITERIA),
        weights=dict(DEFAULT_RANKING_WEIGHTS),
    )
    db.add(row)
    await db.flush()
    return row


async def _list_scenarios_for_ranking(db: AsyncSession, project_id: UUID, poi_id: UUID) -> list[Scenario]:
    rows = (
        await db.execute(
            select(Scenario)
            .where(Scenario.project_id == project_id, Scenario.poi_id == poi_id)
            .order_by(Scenario.created_at.asc())
        )
    ).scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No scenarios for POI. Run analyze first.")
    return rows


async def _load_stored_criterion_values(
    db: AsyncSession, ranking_settings_id: UUID
) -> dict[tuple[str, str], float]:
    rows = (
        await db.execute(
            select(ScenarioCriterionValue).where(
                ScenarioCriterionValue.ranking_settings_id == ranking_settings_id
            )
        )
    ).scalars().all()
    return {(str(r.scenario_id), r.criterion_id): float(r.value) for r in rows}


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


