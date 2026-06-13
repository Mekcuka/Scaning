"""Tests for pad placement MD sum and ranking."""

from __future__ import annotations

from app.services.pad_placement.evaluate import sum_md_m_from_candidate
from app.services.pad_placement.schemas import (
    LogicalWell,
    PadCandidateOut,
    PlacementVariantOut,
)
from app.services.pad_placement.score import rank_variants, variant_sort_key


def _trajectory(*, md: float, well_index: int = 0) -> dict:
    return {
        "well_index": well_index,
        "survey": {
            "source": "calculated",
            "stations": [
                {"md": 0, "tvd": 0, "n": 0, "e": 0},
                {"md": md, "tvd": md * 0.8, "n": 100, "e": 50},
            ],
        },
    }


def test_sum_md_m_from_stations():
    pads = [
        PadCandidateOut(
            candidate_id="p0",
            center_longitude=37.0,
            center_latitude=55.0,
            assigned_logical_ids=["nnb:1", "nnb:2"],
            trajectories=[_trajectory(md=1000, well_index=0), _trajectory(md=800, well_index=1)],
        ),
    ]
    total, warnings = sum_md_m_from_candidate(pads)
    assert total == 1800.0
    assert warnings == []


def test_sum_md_m_fallback_to_logical_well_tvd():
    pads = [
        PadCandidateOut(
            candidate_id="p0",
            center_longitude=37.0,
            center_latitude=55.0,
            assigned_logical_ids=["nnb:1"],
            trajectories=[{"well_index": 0, "target": {"tvd_m": 1500}}],
        ),
    ]
    logical = [
        LogicalWell(
            logical_id="nnb:1",
            profile="nnb",
            bottomhole_ids=[],
            td_longitude=37.0,
            td_latitude=55.0,
            tvd_m=1500,
        ),
    ]
    total, warnings = sum_md_m_from_candidate(pads, logical)
    assert total == 1500.0
    assert any("MD fallback to TVD" in w for w in warnings)


def test_rank_prefers_lower_sum_md_when_pad_count_equal():
    high_md = PlacementVariantOut(
        variant_index=0,
        pad_count=2,
        sum_md_m=5000,
        pads=[],
        invalid=False,
    )
    low_md = PlacementVariantOut(
        variant_index=0,
        pad_count=2,
        sum_md_m=4000,
        pads=[],
        invalid=False,
    )
    ranked = rank_variants([high_md, low_md])
    assert ranked[0].sum_md_m == 4000
    assert variant_sort_key(ranked[0]) < variant_sort_key(ranked[1])
