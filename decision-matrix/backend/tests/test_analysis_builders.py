"""Tests for analysis param_type builder registry (SOLID phase 5)."""

import asyncio
from unittest.mock import MagicMock
from uuid import uuid4

from app.services.analysis.builders import ANALYSIS_PARAM_BUILDERS
from app.services.analysis.builders.external_linear import ExternalLinearBuilder
from app.services.analysis.builders.internal_linear import InternalLinearBuilder
from app.services.analysis.builders.types import AnalysisBuildContext
from app.services.analysis.compute import get_distance_maps
from app.services.analysis.read import synthesize_missing_internal_linear_items
from app.services.calculations import EngineeringState, apply_engineering_rules
from app.services.cost_rates import (
    ANALYSIS_LINEAR_SUBTYPES,
    DEFAULT_COST_RATES,
    EXTERNAL_LINEAR_SUBTYPES,
    EXTERNAL_POINT_SUBTYPES,
)


def test_registry_has_three_param_type_builders():
    param_types = {b.param_type for b in ANALYSIS_PARAM_BUILDERS}
    assert param_types == {"internal", "external_linear", "external"}


def test_registry_subtypes_match_cost_rates():
    by_type = {b.param_type: b for b in ANALYSIS_PARAM_BUILDERS}
    assert by_type["internal"].__class__.__name__ == "InternalLinearBuilder"
    assert by_type["external_linear"].__class__.__name__ == "ExternalLinearBuilder"
    assert by_type["external"].__class__.__name__ == "ExternalPointBuilder"
    # Subtype lists live in cost_rates — builders import them directly.
    assert len(ANALYSIS_LINEAR_SUBTYPES) >= 5
    assert len(EXTERNAL_LINEAR_SUBTYPES) >= 5
    assert len(EXTERNAL_POINT_SUBTYPES) >= 5


def _poi_mock(*, fluid_type: str) -> MagicMock:
    poi = MagicMock()
    poi.id = uuid4()
    poi.fluid_type = fluid_type
    for field in (
        "km_per_pad_autoroad",
        "km_per_pad_oil_pipeline",
        "km_per_pad_gas_pipeline",
        "km_per_pad_water_pipeline",
        "km_per_pad_power_line",
        "max_total_line_autoroad_km",
        "max_total_line_oil_pipeline_km",
        "max_total_line_gas_pipeline_km",
        "max_total_line_water_pipeline_km",
        "max_total_line_power_line_km",
        "threshold_gas_processing_km",
        "threshold_gtes_km",
        "threshold_substation_km",
        "threshold_refinery_km",
    ):
        setattr(poi, field, None)
    return poi


async def _internal_items_for_fluid(fluid_type: str) -> list[dict]:
    poi = _poi_mock(fluid_type=fluid_type)
    eng = EngineeringState(fluid_type=fluid_type)
    km_per_pad_map, max_line_map, threshold_map = get_distance_maps(poi, None)
    ctx = AnalysisBuildContext(
        db=MagicMock(),
        project_id=uuid4(),
        poi=poi,
        spatial=MagicMock(),
        rates=dict(DEFAULT_COST_RATES),
        pads=2,
        subtype_status=apply_engineering_rules(eng),
        km_per_pad_map=km_per_pad_map,
        max_line_map=max_line_map,
        threshold_map=threshold_map,
        manual_external={},
        manual_external_linear={},
    )
    batch = await InternalLinearBuilder().build_all(ctx)
    return batch.items


def test_internal_linear_builder_gas_pipeline_by_fluid():
    gas_items = asyncio.run(_internal_items_for_fluid("gas"))
    gas_pipe = next(i for i in gas_items if i["subtype"] == "gas_pipeline")
    oil_pipe = next(i for i in gas_items if i["subtype"] == "oil_pipeline")
    water_pipe = next(i for i in gas_items if i["subtype"] == "water_pipeline")
    assert gas_pipe["status"] == "computed"
    assert gas_pipe["cost_mln"] > 0
    assert gas_pipe.get("formula_label")
    assert oil_pipe["status"] == "not_required"
    assert oil_pipe["cost_mln"] == 0
    assert water_pipe["status"] == "not_required"
    assert water_pipe["cost_mln"] == 0

    oil_items = asyncio.run(_internal_items_for_fluid("oil"))
    gas_pipe_oil = next(i for i in oil_items if i["subtype"] == "gas_pipeline")
    oil_pipe_oil = next(i for i in oil_items if i["subtype"] == "oil_pipeline")
    assert gas_pipe_oil["status"] == "not_required"
    assert gas_pipe_oil["cost_mln"] == 0
    assert oil_pipe_oil["status"] == "computed"
    assert oil_pipe_oil["cost_mln"] > 0


def test_synthesize_missing_internal_gas_pipeline_for_stale_analysis():
    eng = EngineeringState(fluid_type="gas")
    poi = _poi_mock(fluid_type="gas")
    km_per_pad_map, _, _ = get_distance_maps(poi, None)
    stale_items = [
        {
            "subtype": "autoroad",
            "param_type": "internal",
            "status": "computed",
            "cost_mln": 1.0,
        }
    ]
    extra = synthesize_missing_internal_linear_items(
        stale_items,
        eng=eng,
        rates=dict(DEFAULT_COST_RATES),
        km_per_pad_map=km_per_pad_map,
        pads=2,
    )
    gas_pipe = next(i for i in extra if i["subtype"] == "gas_pipeline")
    oil_pipe = next(i for i in extra if i["subtype"] == "oil_pipeline")
    water_pipe = next(i for i in extra if i["subtype"] == "water_pipeline")
    assert gas_pipe["status"] == "computed"
    assert gas_pipe["cost_mln"] > 0
    assert oil_pipe["status"] == "not_required"
    assert oil_pipe["cost_mln"] == 0
    assert water_pipe["status"] == "not_required"
    assert water_pipe["cost_mln"] == 0


async def _external_linear_items_for_fluid(fluid_type: str) -> tuple[list[dict], list[str]]:
    poi = _poi_mock(fluid_type=fluid_type)
    eng = EngineeringState(fluid_type=fluid_type)
    km_per_pad_map, max_line_map, threshold_map = get_distance_maps(poi, None)
    searched: list[str] = []

    async def _find_nearest(_db, _project_id, _poi, subtype):
        searched.append(subtype)
        return None

    spatial = MagicMock()
    spatial.find_nearest_external_linear = _find_nearest
    ctx = AnalysisBuildContext(
        db=MagicMock(),
        project_id=uuid4(),
        poi=poi,
        spatial=spatial,
        rates=dict(DEFAULT_COST_RATES),
        pads=2,
        subtype_status=apply_engineering_rules(eng),
        km_per_pad_map=km_per_pad_map,
        max_line_map=max_line_map,
        threshold_map=threshold_map,
        manual_external={},
        manual_external_linear={},
    )
    batch = await ExternalLinearBuilder().build_all(ctx)
    return batch.items, searched


def test_external_linear_builder_skips_oil_and_water_for_gas():
    items, searched = asyncio.run(_external_linear_items_for_fluid("gas"))
    oil_pipe = next(i for i in items if i["subtype"] == "oil_pipeline")
    water_pipe = next(i for i in items if i["subtype"] == "water_pipeline")
    assert oil_pipe["status"] == "not_required"
    assert oil_pipe["cost_mln"] == 0
    assert water_pipe["status"] == "not_required"
    assert water_pipe["cost_mln"] == 0
    assert "oil_pipeline" not in searched
    assert "water_pipeline" not in searched
