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
                        "source": "calculated",
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
                        "source": "calculated",
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


def test_build_pad_geojson_pywellgeo_lateral_branches():
    tree = {
        "name": "main",
        "x": 0,
        "y": 0,
        "z": 0,
        "branches": [
            {
                "name": "main",
                "x": 0,
                "y": 0,
                "z": -100,
                "branches": [
                    {
                        "name": "lat1",
                        "x": 200,
                        "y": 100,
                        "z": -500,
                        "branches": [
                            {
                                "name": "lat1",
                                "x": 400,
                                "y": 200,
                                "z": -1500,
                                "branches": [],
                            }
                        ],
                    }
                ],
            }
        ],
    }
    fc = build_pad_geojson(
        _pad_obj(
            properties={
                **_pad_obj().properties,
                "pad_pywellgeo_trees_json": [
                    {"well_index": 0, "name": "Скв-1", "tree": tree},
                ],
            }
        )
    )
    plans = [f for f in fc["features"] if f["properties"]["kind"] == "trajectory_plan"]
    branches = [f for f in fc["features"] if f["properties"]["kind"] == "pywellgeo_branch"]
    assert len(plans) == 2  # well 1 from welleng; well 0 from pywellgeo main only
    well0_plan = next(f for f in plans if f["properties"]["well_index"] == 0)
    assert well0_plan["properties"].get("source") == "pywellgeo_main"
    assert len(branches) == 1
    assert branches[0]["properties"]["branch_name"] == "lat1"
    assert len(branches[0]["geometry"]["coordinates"]) == 2


def test_build_pad_geojson_pywellgeo_multiple_laterals_same_name():
    """Each lateral branch must appear on the map even when names repeat (e.g. lat1)."""
    tree = {
        "name": "main",
        "x": 0,
        "y": 0,
        "z": 0,
        "branches": [
            {
                "name": "main",
                "x": 0,
                "y": 0,
                "z": -100,
                "branches": [
                    {
                        "name": "lat1",
                        "x": 100,
                        "y": 50,
                        "z": -400,
                        "branches": [
                            {"name": "lat1", "x": 150, "y": 80, "z": -500, "branches": []},
                        ],
                    },
                    {
                        "name": "lat1",
                        "x": 200,
                        "y": 150,
                        "z": -600,
                        "branches": [
                            {"name": "lat1", "x": 250, "y": 180, "z": -700, "branches": []},
                        ],
                    },
                ],
            }
        ],
    }
    fc = build_pad_geojson(
        _pad_obj(
            properties={
                **_pad_obj().properties,
                "pad_pywellgeo_trees_json": [
                    {"well_index": 0, "name": "Скв-1", "tree": tree},
                ],
            }
        )
    )
    branches = [f for f in fc["features"] if f["properties"]["kind"] == "pywellgeo_branch"]
    assert len(branches) == 2
    branch_ids = {f["properties"]["branch_id"] for f in branches}
    assert len(branch_ids) == 2
    assert all(f["properties"]["branch_name"] == "lat1" for f in branches)


def test_build_pad_geojson_pywellgeo_skips_duplicate_welleng_survey():
    tree = {
        "name": "main",
        "x": 0,
        "y": 0,
        "z": 0,
        "branches": [
            {
                "name": "main",
                "x": 0,
                "y": 0,
                "z": -100,
                "branches": [],
            }
        ],
    }
    fc = build_pad_geojson(
        _pad_obj(
            properties={
                **_pad_obj().properties,
                "pad_pywellgeo_trees_json": [
                    {"well_index": 0, "name": "Скв-1", "tree": tree},
                ],
            }
        )
    )
    well0_plans = [
        f
        for f in fc["features"]
        if f["properties"]["kind"] == "trajectory_plan" and f["properties"]["well_index"] == 0
    ]
    well0_traj = [
        f
        for f in fc["features"]
        if f["properties"]["kind"] == "trajectory" and f["properties"]["well_index"] == 0
    ]
    assert len(well0_plans) == 1
    assert well0_plans[0]["properties"].get("source") == "pywellgeo_main"
    assert len(well0_traj) == 1
    assert well0_traj[0]["properties"].get("source") == "pywellgeo_main"


def test_build_pad_geojson_stub_survey_not_drawn_as_trajectory():
    fc = build_pad_geojson(
        _pad_obj(
            properties={
                **_pad_obj().properties,
                "pad_wells_trajectories_json": [
                    {
                        "well_index": 0,
                        "name": "Скв-1",
                        "survey": {
                            "source": "stub",
                            "stations": [
                                {"n": 0, "e": 0, "tvd": 0, "md": 0},
                                {"n": 0, "e": 0, "tvd": 50, "md": 50},
                            ],
                        },
                    },
                    {
                        "well_index": 1,
                        "name": "Скв-2",
                        "survey": {
                            "source": "calculated",
                            "stations": [
                                {"n": 0, "e": 9, "tvd": 0, "md": 0},
                                {"n": 50, "e": 9, "tvd": 200, "md": 250},
                            ],
                        },
                    },
                ],
            }
        )
    )
    traj = [f for f in fc["features"] if f["properties"]["kind"] == "trajectory"]
    plan = [f for f in fc["features"] if f["properties"]["kind"] == "trajectory_plan"]
    assert all(f["properties"]["well_index"] != 0 for f in traj)
    assert all(f["properties"]["well_index"] != 0 for f in plan)
    assert any(f["properties"]["well_index"] == 1 for f in traj)
    assert any(f["properties"]["well_index"] == 1 for f in plan)


def test_collect_trajectory_warnings_missing_targets():
    warnings = collect_trajectory_warnings(_pad_obj())
    assert any("без цели" in w or "забоя" in w for w in warnings)
