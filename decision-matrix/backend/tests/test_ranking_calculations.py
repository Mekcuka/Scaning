from app.services.calculations import (
    calc_ahp_consistency_ratio,
    calc_ahp_weights,
    calc_topsis_scores,
    normalize_matrix,
    rebalance_weights,
    thousand_to_million_rub,
)
from app.services.ranking_service import (
    DEFAULT_EXPERT_VALUES,
    build_ranking_matrix,
    compute_ranking_for_scenarios,
    get_effective_expert_value,
    scenario_metric_value,
    validate_weights,
)
from app.models import ProjectRankingSettings, Scenario
import pytest
from fastapi import HTTPException


def test_normalize_matrix_cost_and_benefit():
    values = [
        [100.0, 1.0],
        [50.0, 2.0],
    ]
    normalized = normalize_matrix(values, ["cost", "benefit"])
    assert normalized[0][0] == 0.0
    assert normalized[1][0] == 1.0
    assert normalized[0][1] == 0.0
    assert normalized[1][1] == 1.0


def test_rebalance_weights_keeps_sum_and_boosts_target():
    base = {"a": 0.5, "b": 0.3, "c": 0.2}
    result = rebalance_weights(base, "b", 0.1)
    assert abs(sum(result.values()) - 1.0) < 1e-9
    assert result["b"] > base["b"]


def test_topsis_and_units_conversion():
    normalized = [[0.8, 0.2], [0.2, 0.8]]
    scores = calc_topsis_scores(normalized, [0.5, 0.5])
    assert len(scores) == 2
    assert thousand_to_million_rub(2500) == 2.5


def test_ahp_weights_sum_to_one():
    pairwise = {
        "a": {"a": 1, "b": 3, "c": 5},
        "b": {"a": 1 / 3, "b": 1, "c": 2},
        "c": {"a": 1 / 5, "b": 0.5, "c": 1},
    }
    weights = calc_ahp_weights(pairwise)
    assert abs(sum(weights.values()) - 1.0) < 1e-6
    assert weights["a"] > weights["c"]


def test_ahp_consistency_ratio_positive():
    pairwise = {
        "cost": {"cost": 1, "risk": 3},
        "risk": {"cost": 1 / 3, "risk": 1},
    }
    cr = calc_ahp_consistency_ratio(pairwise)
    assert cr >= 0.0


def test_effective_expert_defaults():
    assert get_effective_expert_value("risk", {}, DEFAULT_EXPERT_VALUES) == 5.0
    assert get_effective_expert_value("risk", {"risk": 8.0}, DEFAULT_EXPERT_VALUES) == 8.0


def test_validate_weights_raises_on_bad_sum():
    with pytest.raises(HTTPException):
        validate_weights({"a": 0.5, "b": 0.3})


def _make_scenario(name: str, total_cost: float, exceed: int = 0) -> Scenario:
    sc = Scenario(name=name, project_id=None, scenario_type="scenario")  # type: ignore[arg-type]
    sc.results = {
        "total_cost_mln": total_cost,
        "analysis": [{"distance_km": 10.0, "status": "within_limit"}]
        + [{"distance_km": 1.0, "status": "exceeds_limit"}] * exceed,
    }
    return sc


def test_compute_ranking_orders_by_cost():
    settings = ProjectRankingSettings(
        project_id=None,  # type: ignore[arg-type]
        poi_id=None,  # type: ignore[arg-type]
        algorithm="topsis",
        criteria=[
            {"id": "total_cost_mln", "name": "Cost", "type": "cost", "value_source": "computed"},
            {"id": "exceed_count", "name": "Exceed", "type": "cost", "value_source": "computed"},
        ],
        weights={"total_cost_mln": 0.7, "exceed_count": 0.3},
        default_expert_values=dict(DEFAULT_EXPERT_VALUES),
    )
    scenarios = [
        _make_scenario("Cheap", 10.0, 0),
        _make_scenario("Expensive", 50.0, 2),
    ]
    result = compute_ranking_for_scenarios(scenarios, settings, {})
    ranked = sorted(result["alternatives"], key=lambda x: x["rank"])
    assert ranked[0]["name"] == "Cheap"
    assert ranked[1]["name"] == "Expensive"


def test_build_ranking_matrix_includes_defaults():
    settings = ProjectRankingSettings(
        project_id=None,  # type: ignore[arg-type]
        poi_id=None,  # type: ignore[arg-type]
        algorithm="topsis",
        criteria=[
            {"id": "risk", "name": "Risk", "type": "cost", "value_source": "user"},
        ],
        weights={"risk": 1.0},
        default_expert_values={"risk": 7.0},
    )
    sc = _make_scenario("Base", 1.0)
    sc.scenario_type = "base"
    matrix = build_ranking_matrix([sc], settings, {})
    sid = str(sc.id)
    assert matrix["values"][sid]["risk"] == 7.0


def test_scenario_metric_value_computed():
    sc = _make_scenario("S", 12.5, 1)
    assert scenario_metric_value(sc, "total_cost_mln", {}) == 12.5
    assert scenario_metric_value(sc, "exceed_count", {}) == 1.0
