"""Tests for project cost rate merging."""

from app.services.cost_rates import (
    DEFAULT_COST_RATES,
    merge_project_cost_rates,
    resolve_cost_rates,
    sparse_rate_overrides,
)


def test_merge_project_cost_rates_zero_does_not_override_default():
    merged = merge_project_cost_rates({"refinery": 0, "eq_gas": 0})
    assert merged["refinery"] == DEFAULT_COST_RATES["refinery"] == 500000
    assert merged["eq_gas"] == DEFAULT_COST_RATES["eq_gas"] == 450000


def test_merge_project_cost_rates_non_zero_override():
    merged = merge_project_cost_rates({"refinery": 600000})
    assert merged["refinery"] == 600000
    assert merged["eq_gas"] == 450000


def test_merge_project_cost_rates_unknown_key_preserved():
    merged = merge_project_cost_rates({"custom_rate": 0})
    assert merged["custom_rate"] == 0


def test_resolve_cost_rates_inherits_project():
    project = {"refinery": 600000}
    assert resolve_cost_rates(project, None)["refinery"] == 600000
    assert resolve_cost_rates(project, None)["eq_gas"] == DEFAULT_COST_RATES["eq_gas"]


def test_resolve_cost_rates_poi_override():
    project = {"refinery": 600000}
    poi = {"refinery": 700000, "eq_gas": 0}
    merged = resolve_cost_rates(project, poi)
    assert merged["refinery"] == 700000
    assert merged["eq_gas"] == DEFAULT_COST_RATES["eq_gas"]


def test_sparse_rate_overrides():
    project = merge_project_cost_rates({"refinery": 600000})
    effective = {**project, "refinery": 700000}
    assert sparse_rate_overrides(effective, project) == {"refinery": 700000}
    assert sparse_rate_overrides(project, project) is None
