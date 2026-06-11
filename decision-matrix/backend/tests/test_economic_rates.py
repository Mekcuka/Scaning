"""Tests for economic parameter merging."""

from app.services.economic_rates import (
    DEFAULT_ECONOMIC_PARAMS,
    merge_economic_params,
    resolve_economic_params,
    sparse_economic_overrides,
)


def test_resolve_economic_params_poi_override():
    project = {"opex_refinery": 20000.0}
    poi = {"opex_refinery": 25000.0}
    merged = resolve_economic_params(project, poi)
    assert merged["opex_refinery"] == 25000.0
    assert merged["opex_gtes"] == DEFAULT_ECONOMIC_PARAMS["opex_gtes"]


def test_sparse_economic_overrides():
    project = merge_economic_params({"opex_refinery": 20000.0})
    effective = {**project, "opex_refinery": 22000.0}
    assert sparse_economic_overrides(effective, project) == {"opex_refinery": 22000.0}
