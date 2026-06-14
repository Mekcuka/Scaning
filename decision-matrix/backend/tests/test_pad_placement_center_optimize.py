"""Tests for M2+ pad center optimization."""

from __future__ import annotations

from app.services.pad_placement.placement import haversine_m, suggest_pad_center, td_centroid
from app.services.pad_placement.placement_optimize import find_best_pad_center
from app.services.pad_placement.schemas import LogicalWell, PadCandidateOut, PadPlacementParams


def _well(lon: float, lat: float) -> LogicalWell:
    return LogicalWell(
        logical_id=f"nnb:{lon}",
        profile="nnb",
        bottomhole_ids=[],
        td_longitude=lon,
        td_latitude=lat,
        tvd_m=1500,
    )


def _mock_evaluate(wells, *, center_lon, center_lat, candidate_id, **kwargs):
    per_well_md = sum(
        haversine_m(center_lon, center_lat, w.td_longitude, w.td_latitude) for w in wells
    )
    trajectories = [
        {
            "survey": {
                "source": "calculated",
                "stations": [{"md": 0}, {"md": per_well_md / len(wells)}],
            },
        }
        for _ in wells
    ]
    return PadCandidateOut(
        candidate_id=candidate_id,
        center_longitude=center_lon,
        center_latitude=center_lat,
        assigned_logical_ids=[w.logical_id for w in wells],
        trajectories=trajectories,
    )


def test_find_best_pad_center_prefers_centroid_over_heel_seed():
    wells = [
        _well(37.620, 55.760),
        _well(37.621, 55.761),
        _well(37.619, 55.759),
    ]
    params = PadPlacementParams(
        center_optimize=True,
        center_search_radius_m=400,
        center_search_step_m=200,
        min_pad_spacing_m=0,
    )
    clon, clat = td_centroid(wells)
    heel_lon, heel_lat = suggest_pad_center(wells)
    heel_dist = haversine_m(heel_lon, heel_lat, clon, clat)
    assert heel_dist > 100

    best, warnings = find_best_pad_center(
        wells,
        params=params,
        snapshots_by_id={},
        subtype="oil_pad",
        candidate_id="test_p0",
        existing_pads=[],
        other_centers=[],
        evaluate_fn=_mock_evaluate,
    )
    assert best is not None
    dist_to_centroid = haversine_m(best.center_longitude, best.center_latitude, clon, clat)
    assert dist_to_centroid < heel_dist * 0.5
    assert not any("No valid pad center" in w for w in warnings)


def test_find_best_pad_center_two_phase_refines_winner():
    wells = [_well(37.620, 55.760), _well(37.621, 55.761)]
    params = PadPlacementParams(
        center_optimize=True,
        center_search_radius_m=400,
        center_search_step_m=200,
        min_pad_spacing_m=0,
    )
    calls: list[str] = []

    def tracking_evaluate(wells, *, center_lon, center_lat, candidate_id, trajectory_design="full", **kwargs):
        calls.append(trajectory_design)
        return _mock_evaluate(
            wells,
            center_lon=center_lon,
            center_lat=center_lat,
            candidate_id=candidate_id,
            **kwargs,
        )

    best, _ = find_best_pad_center(
        wells,
        params=params,
        snapshots_by_id={},
        subtype="oil_pad",
        candidate_id="test_p0",
        existing_pads=[],
        other_centers=[],
        evaluate_fn=tracking_evaluate,
    )
    assert best is not None
    assert calls.count("full") == 1
    assert calls.count("coarse") >= 1


def test_find_best_pad_center_returns_none_when_all_spacing_blocked():
    wells = [_well(37.62, 55.76)]
    params = PadPlacementParams(min_pad_spacing_m=5000)
    best, warnings = find_best_pad_center(
        wells,
        params=params,
        snapshots_by_id={},
        subtype="oil_pad",
        candidate_id="test_p0",
        existing_pads=[],
        other_centers=[(37.62, 55.76)],
        evaluate_fn=_mock_evaluate,
    )
    assert best is None
    assert any("spacing" in w.lower() for w in warnings)
