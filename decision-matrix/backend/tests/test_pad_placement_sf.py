"""Tests for SF-aware pad placement variant ranking (M5)."""

from __future__ import annotations

from app.services.pad_placement.score import rank_variants, variant_sort_key
from app.services.pad_placement.schemas import PlacementVariantOut


def test_sf_violations_rank_below_clean_variant():
    clean = PlacementVariantOut(
        variant_index=0,
        pad_count=2,
        sum_md_m=4000,
        pads=[],
        invalid=False,
        min_sf=1.5,
        sf_violation_count=0,
    )
    worse_sf = PlacementVariantOut(
        variant_index=0,
        pad_count=2,
        sum_md_m=4000,
        pads=[],
        invalid=False,
        min_sf=0.8,
        sf_violation_count=2,
    )
    ranked = rank_variants([worse_sf, clean])
    assert ranked[0].sf_violation_count == 0
    assert variant_sort_key(ranked[0]) < variant_sort_key(ranked[1])


def test_higher_min_sf_ranks_above_when_violations_equal():
    low_sf = PlacementVariantOut(
        variant_index=0,
        pad_count=1,
        sum_md_m=3000,
        pads=[],
        invalid=False,
        min_sf=0.9,
        sf_violation_count=1,
    )
    high_sf = PlacementVariantOut(
        variant_index=0,
        pad_count=1,
        sum_md_m=3000,
        pads=[],
        invalid=False,
        min_sf=1.4,
        sf_violation_count=1,
    )
    ranked = rank_variants([low_sf, high_sf])
    assert ranked[0].min_sf == 1.4
