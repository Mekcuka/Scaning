"""DIP ports: network planner and spatial query (SOLID phase 4)."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.services.analysis.run import run_poi_analysis
from app.services.autoroad_network.planner_port import (
    DefaultNetworkPlanner,
    NetworkPlannerPort,
    get_network_planner,
)
from app.services.spatial import NearestResult
from app.services.spatial_port import DefaultSpatialQuery, SpatialQueryPort, get_spatial_query


def test_network_planner_port_default_singleton():
    planner = get_network_planner()
    assert isinstance(planner, DefaultNetworkPlanner)
    assert hasattr(planner, "compute")


def test_spatial_query_port_default_singleton():
    spatial = get_spatial_query()
    assert isinstance(spatial, DefaultSpatialQuery)


class _FakeSpatial:
    async def find_nearest_object_by_subtype(self, *args, **kwargs):
        return None

    async def find_nearest_external_linear(self, *args, **kwargs):
        return None


def test_run_poi_analysis_accepts_spatial_port_override():
    """Analysis run uses injected spatial port instead of default DB spatial."""

    async def _run() -> None:
        class _RecordingSpatial(_FakeSpatial):
            def __init__(self):
                self.external_calls = 0
                self.point_calls = 0

            async def find_nearest_external_linear(self, db, project_id, poi, subtype):
                self.external_calls += 1
                return None

            async def find_nearest_object_by_subtype(
                self, db, project_id, poi, subtype, *, nearest_policy="point_on_line"
            ):
                self.point_calls += 1
                return NearestResult(
                    object_id=uuid4(),
                    name="stub",
                    distance_km=1.0,
                    anchor_type="point_object",
                    anchor_lon=37.6,
                    anchor_lat=55.75,
                )

        spatial = _RecordingSpatial()
        poi = SimpleNamespace(
        id=uuid4(),
        planned_production_volume=1000,
        production_per_well=100,
        wells_per_pad=10,
        fluid_type="oil",
        eng_power="external",
        eng_injection="local",
        eng_gas="none",
        eng_oil_preparation="central",
        eng_transport="pipeline",
        water_injection_volume=0,
        km_per_pad_autoroad=None,
        km_per_pad_oil_pipeline=None,
        km_per_pad_gas_pipeline=None,
        km_per_pad_water_pipeline=None,
        km_per_pad_power_line=None,
        max_total_line_autoroad_km=None,
        max_total_line_oil_pipeline_km=None,
        max_total_line_gas_pipeline_km=None,
        max_total_line_water_pipeline_km=None,
        max_total_line_power_line_km=None,
        max_total_line_methanol_pipeline_km=None,
        max_total_line_additional_line_km=None,
        threshold_gas_processing_km=None,
        threshold_gtes_km=None,
        threshold_substation_km=None,
        threshold_refinery_km=None,
        threshold_ground_pumping_station_km=None,
        threshold_sand_quarry_km=None,
        cost_rates=None,
            longitude=37.6,
            latitude=55.75,
        )

        db = AsyncMock()
        db.scalar = AsyncMock(return_value=None)
        empty = MagicMock()
        empty.scalars.return_value.all.return_value = []
        db.execute = AsyncMock(return_value=empty)
        db.add = MagicMock()
        db.flush = AsyncMock()

        project_id = uuid4()
        await run_poi_analysis(db, project_id, poi, spatial=spatial)

        assert spatial.external_calls >= 1
        assert spatial.point_calls >= 1

    asyncio.run(_run())


def test_spatial_query_port_is_protocol():
    assert isinstance(DefaultSpatialQuery(), SpatialQueryPort)


def test_network_planner_port_is_protocol():
    assert isinstance(DefaultNetworkPlanner(), NetworkPlannerPort)
