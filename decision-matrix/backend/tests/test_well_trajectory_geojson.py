"""Unit tests for well trajectory GeoJSON builders."""

from __future__ import annotations

from types import SimpleNamespace

from app.services.well_trajectory.geojson import build_pad_geojson, collect_trajectory_warnings


def _pad_obj(**overrides):
    base = {
        "id": "00000000-0000-4000-8000-000000000001",
        "name": "Куст-1",
        "longitude": 37.62,
        "latitude": 55.76,
        "properties": {
            "pad_reference_elevation_m": 150.0,
            "pad_height_m": 2.0,
            "pad_well_count": 2,
            "pad_wells_local_json": [{"east_m": 0, "north_m": 0}, {"east_m": 9, "north_m": 0}],
            "pad_wells_trajectories_json": [
                {
                    "well_index": 0,
                    "name": "Скв-1",
                    "survey": {
                        "stations": [
                            {"n": 0, "e": 0, "tvd": 0, "md": 0},
                            {"n": 100, "e": 200, "tvd": 500, "md": 600},
                        ]
                    },
                    "target": {
                        "source": "manual_map",
                        "plan": {"east_m": 200, "north_m": 100},
                        "lon": 37.622,
                        "lat": 55.761,
                        "tvd_m": 1500,
                    },
                },
                {
                    "well_index": 1,
                    "name": "Скв-2",
                    "survey": {
                        "stations": [
                            {"n": 0, "e": 9, "tvd": 0, "md": 0},
                            {"n": 50, "e": 9, "tvd": 200, "md": 250},
                        ]
                    },
                },
            ],
        },
    }
    base.update(overrides)
    return SimpleNamespace(**base)


def test_build_pad_geojson_plan_and_3d_lines():
    fc = build_pad_geojson(_pad_obj())
    kinds = [f["properties"]["kind"] for f in fc["features"]]
    assert "trajectory" in kinds
    assert "trajectory_plan" in kinds
    assert "bottomhole_target" in kinds
    assert "bottomhole_target_3d" in kinds

    plan = next(f for f in fc["features"] if f["properties"]["kind"] == "trajectory_plan")
    assert len(plan["geometry"]["coordinates"][0]) == 2
    line3d = next(f for f in fc["features"] if f["properties"]["kind"] == "trajectory")
    assert len(line3d["geometry"]["coordinates"][0]) == 3


def test_collect_trajectory_warnings_missing_targets():
    warnings = collect_trajectory_warnings(_pad_obj())
    assert any("без цели" in w or "забоя" in w for w in warnings)
