"""Tests for project cost rate merging."""

from app.services.cost_rates import DEFAULT_COST_RATES, merge_project_cost_rates


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
