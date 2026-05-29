"""POI scenario ranking: matrix build, TOPSIS/WSM, expert defaults (FR-9)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    PointOfInterest,
    PoiInfrastructureAnalysis,
    ProjectRankingSettings,
    Scenario,
    ScenarioCriterionValue,
)
from app.services.infrastructure_analysis import build_enriched_analysis_from_db, link_poi_scenarios
from app.services.calculations import (
    calc_topsis_scores,
    calc_wsm_scores,
    normalize_matrix,
    rank_alternatives,
)

DEFAULT_RANKING_CRITERIA: list[dict[str, str]] = [
    {"id": "total_cost_mln", "name": "Общая стоимость", "type": "cost", "value_source": "computed"},
    {"id": "total_distance_km", "name": "Общее расстояние", "type": "cost", "value_source": "computed"},
    {"id": "exceed_count", "name": "Количество превышений", "type": "cost", "value_source": "computed"},
    {"id": "risk", "name": "Риск реализации", "type": "cost", "value_source": "user"},
    {"id": "time_months", "name": "Время реализации", "type": "cost", "value_source": "user"},
    {"id": "reliability", "name": "Надежность инфраструктуры", "type": "benefit", "value_source": "user"},
]

DEFAULT_RANKING_WEIGHTS: dict[str, float] = {
    "total_cost_mln": 0.35,
    "total_distance_km": 0.15,
    "exceed_count": 0.2,
    "risk": 0.1,
    "time_months": 0.1,
    "reliability": 0.1,
}

DEFAULT_EXPERT_VALUES: dict[str, float] = {"risk": 5.0, "time_months": 12.0, "reliability": 5.0}

USER_CRITERION_IDS = frozenset({"risk", "time_months", "reliability"})


def normalize_criteria(raw: list[dict] | None) -> list[dict[str, str]]:
    if not raw:
        return list(DEFAULT_RANKING_CRITERIA)
    out: list[dict[str, str]] = []
    for item in raw:
        cid = str(item.get("id", ""))
        if not cid:
            continue
        value_source = str(item.get("value_source") or ("user" if cid in USER_CRITERION_IDS else "computed"))
        out.append(
            {
                "id": cid,
                "name": str(item.get("name") or cid),
                "type": str(item.get("type", "cost")),
                "value_source": value_source,
            }
        )
    return out or list(DEFAULT_RANKING_CRITERIA)


def validate_weights(weights: dict[str, float]) -> None:
    total = sum(float(v) for v in weights.values())
    if abs(total - 1.0) > 0.001:
        raise HTTPException(status_code=400, detail="Weights sum must be 1.0")


def get_effective_expert_value(
    criterion_id: str,
    stored: dict[str, float],
    defaults: dict[str, float],
) -> float:
    if criterion_id in stored:
        return float(stored[criterion_id])
    if criterion_id in defaults:
        return float(defaults[criterion_id])
    if criterion_id in DEFAULT_EXPERT_VALUES:
        return float(DEFAULT_EXPERT_VALUES[criterion_id])
    return 0.0


def scenario_metric_value(
    scenario: Scenario,
    criterion_id: str,
    scenario_values: dict[str, float],
    *,
    default_expert_values: dict[str, float] | None = None,
) -> float:
    defaults = default_expert_values or DEFAULT_EXPERT_VALUES
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
    if criterion_id in USER_CRITERION_IDS or criterion_id in defaults:
        return get_effective_expert_value(criterion_id, scenario_values, defaults)
    if criterion_id in scenario_values:
        return float(scenario_values[criterion_id])
    return float(results.get(criterion_id, 0.0))


def build_ranking_matrix(
    scenarios: list[Scenario],
    settings: ProjectRankingSettings,
    values_map: dict[tuple[str, str], float],
) -> dict[str, Any]:
    criteria = normalize_criteria(settings.criteria)
    criterion_ids = [c["id"] for c in criteria]
    defaults = dict(settings.default_expert_values or DEFAULT_EXPERT_VALUES)

    scenario_summaries = [
        {
            "id": str(sc.id),
            "name": sc.name,
            "scenario_type": sc.scenario_type,
        }
        for sc in scenarios
    ]

    values: dict[str, dict[str, float]] = {}
    raw_matrix: list[list[float]] = []

    for sc in scenarios:
        sid = str(sc.id)
        scenario_values = {
            criterion_id: value
            for (scenario_id, criterion_id), value in values_map.items()
            if scenario_id == sid
        }
        row_values: dict[str, float] = {}
        row: list[float] = []
        for cid in criterion_ids:
            val = scenario_metric_value(sc, cid, scenario_values, default_expert_values=defaults)
            row_values[cid] = val
            row.append(val)
        values[sid] = row_values
        raw_matrix.append(row)

    criterion_types = [c["type"] for c in criteria]
    normalized = normalize_matrix(raw_matrix, criterion_types) if raw_matrix else []

    normalized_by_scenario: dict[str, dict[str, float]] = {}
    for idx, sc in enumerate(scenarios):
        sid = str(sc.id)
        normalized_by_scenario[sid] = {
            criterion_ids[j]: normalized[idx][j] for j in range(len(criterion_ids))
        }

    return {
        "scenarios": scenario_summaries,
        "criteria": criteria,
        "values": values,
        "normalized_values": normalized_by_scenario,
    }


def compute_ranking_for_scenarios(
    scenarios: list[Scenario],
    settings: ProjectRankingSettings,
    values_map: dict[tuple[str, str], float],
    *,
    custom_weights: dict[str, float] | None = None,
) -> dict[str, Any]:
    criteria = normalize_criteria(settings.criteria)
    criterion_ids = [c["id"] for c in criteria]
    criterion_types = [c["type"] for c in criteria]
    weights_map = custom_weights or dict(settings.weights or DEFAULT_RANKING_WEIGHTS)
    validate_weights(weights_map)
    weights = [float(weights_map.get(cid, 0.0)) for cid in criterion_ids]
    defaults = dict(settings.default_expert_values or DEFAULT_EXPERT_VALUES)

    matrix: list[list[float]] = []
    for sc in scenarios:
        scenario_values = {
            criterion_id: value
            for (scenario_id, criterion_id), value in values_map.items()
            if scenario_id == str(sc.id)
        }
        row = [scenario_metric_value(sc, cid, scenario_values, default_expert_values=defaults) for cid in criterion_ids]
        matrix.append(row)

    normalized = normalize_matrix(matrix, criterion_types)
    algorithm = (settings.algorithm or "topsis").lower()
    if algorithm == "wsm":
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
                "scenario_type": scenario.scenario_type,
                "score": rank_item["score"],
                "rank": rank_item["rank"],
            }
        )

    matrix_payload = build_ranking_matrix(scenarios, settings, values_map)
    return {
        "algorithm": settings.algorithm,
        "alternatives": alternatives,
        "matrix": matrix_payload,
    }


def settings_to_response(row: ProjectRankingSettings) -> dict[str, Any]:
    return {
        "algorithm": row.algorithm,
        "criteria": normalize_criteria(row.criteria),
        "weights": row.weights or dict(DEFAULT_RANKING_WEIGHTS),
        "default_expert_values": row.default_expert_values or dict(DEFAULT_EXPERT_VALUES),
        "ahp_pairwise": row.ahp_pairwise or {},
    }


async def get_or_create_ranking_settings(
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
        default_expert_values=dict(DEFAULT_EXPERT_VALUES),
        ahp_pairwise={},
    )
    db.add(row)
    await db.flush()
    return row


async def _load_poi_scenarios(db: AsyncSession, project_id: UUID, poi_id: UUID) -> list[Scenario]:
    return (
        await db.execute(
            select(Scenario)
            .where(Scenario.project_id == project_id, Scenario.poi_id == poi_id)
            .order_by(Scenario.created_at.asc())
        )
    ).scalars().all()


async def ensure_poi_scenarios_for_ranking(
    db: AsyncSession, project_id: UUID, poi_id: UUID
) -> list[Scenario]:
    """Return POI-linked scenarios, materializing them from analysis when missing."""
    rows = await _load_poi_scenarios(db, project_id, poi_id)
    if rows:
        return rows

    has_analysis = await db.scalar(
        select(PoiInfrastructureAnalysis.id)
        .where(PoiInfrastructureAnalysis.poi_id == poi_id)
        .limit(1)
    )
    if not has_analysis:
        raise HTTPException(status_code=404, detail="No scenarios for POI. Run analyze first.")

    poi = await db.get(PointOfInterest, poi_id)
    if poi is None or poi.project_id != project_id:
        raise HTTPException(status_code=404, detail="No scenarios for POI. Run analyze first.")

    result = await build_enriched_analysis_from_db(db, project_id, poi)
    await link_poi_scenarios(db, project_id, poi_id, result)
    await db.flush()

    rows = await _load_poi_scenarios(db, project_id, poi_id)
    if not rows:
        raise HTTPException(status_code=404, detail="No scenarios for POI. Run analyze first.")
    return rows


async def list_scenarios_for_ranking(db: AsyncSession, project_id: UUID, poi_id: UUID) -> list[Scenario]:
    return await ensure_poi_scenarios_for_ranking(db, project_id, poi_id)


def _pick_base_scenario(scenarios: list[Scenario]) -> Scenario:
    for sc in scenarios:
        if sc.scenario_type == "base":
            return sc
    return scenarios[0]


async def compute_project_pois_ranking(
    db: AsyncSession,
    project_id: UUID,
    settings_poi_id: UUID,
) -> dict[str, Any]:
    """Rank POIs in a project using each POI's base scenario and shared weights from settings_poi_id."""
    template = await get_or_create_ranking_settings(db, project_id, settings_poi_id)
    pois = (
        await db.execute(select(PointOfInterest).where(PointOfInterest.project_id == project_id))
    ).scalars().all()

    entries: list[tuple[PointOfInterest, Scenario, dict[tuple[str, str], float], dict[str, float]]] = []
    skipped: list[str] = []

    for poi in pois:
        try:
            scenarios = await ensure_poi_scenarios_for_ranking(db, project_id, poi.id)
        except HTTPException:
            skipped.append(poi.name)
            continue
        base = _pick_base_scenario(scenarios)
        poi_settings = await get_or_create_ranking_settings(db, project_id, poi.id)
        values_map = await load_stored_criterion_values(db, poi_settings.id)
        defaults = dict(poi_settings.default_expert_values or DEFAULT_EXPERT_VALUES)
        entries.append((poi, base, values_map, defaults))

    if not entries:
        raise HTTPException(
            status_code=404,
            detail="No POIs with analysis. Run analyze for at least one POI.",
        )

    criteria = normalize_criteria(template.criteria)
    criterion_ids = [c["id"] for c in criteria]
    criterion_types = [c["type"] for c in criteria]
    weights_map = dict(template.weights or DEFAULT_RANKING_WEIGHTS)
    validate_weights(weights_map)
    weights = [float(weights_map.get(cid, 0.0)) for cid in criterion_ids]

    matrix: list[list[float]] = []
    values: dict[str, dict[str, float]] = {}
    for poi, base, values_map, defaults in entries:
        poi_key = str(poi.id)
        scenario_values = {
            criterion_id: value
            for (scenario_id, criterion_id), value in values_map.items()
            if scenario_id == str(base.id)
        }
        row_values: dict[str, float] = {}
        row: list[float] = []
        for cid in criterion_ids:
            val = scenario_metric_value(base, cid, scenario_values, default_expert_values=defaults)
            row_values[cid] = val
            row.append(val)
        values[poi_key] = row_values
        matrix.append(row)

    normalized = normalize_matrix(matrix, criterion_types)
    algorithm = (template.algorithm or "topsis").lower()
    if algorithm == "wsm":
        scores = calc_wsm_scores(normalized, weights)
    else:
        scores = calc_topsis_scores(normalized, weights)

    ranked = rank_alternatives(scores)
    ranked_map = {entry["index"]: entry for entry in ranked}
    alternatives = []
    for idx, (poi, base, _values_map, _defaults) in enumerate(entries):
        rank_item = ranked_map[idx]
        alternatives.append(
            {
                "poi_id": poi.id,
                "scenario_id": base.id,
                "name": poi.name,
                "scenario_type": "poi",
                "score": rank_item["score"],
                "rank": rank_item["rank"],
            }
        )

    scenario_summaries = [
        {"id": str(poi.id), "name": poi.name, "scenario_type": "poi"} for poi, *_ in entries
    ]
    normalized_by_poi: dict[str, dict[str, float]] = {}
    for idx, (poi, *_rest) in enumerate(entries):
        poi_key = str(poi.id)
        normalized_by_poi[poi_key] = {
            criterion_ids[j]: normalized[idx][j] for j in range(len(criterion_ids))
        }

    return {
        "algorithm": template.algorithm,
        "alternatives": alternatives,
        "matrix": {
            "scenarios": scenario_summaries,
            "criteria": criteria,
            "values": values,
            "normalized_values": normalized_by_poi,
        },
        "ranking_unit": "poi",
        "skipped_pois": skipped,
    }


async def load_stored_criterion_values(
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
