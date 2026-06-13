"""Tests for pad placement variant scoring."""

from __future__ import annotations

from app.services.pad_placement.score import rank_variants, variant_sort_key
from app.services.pad_placement.schemas import PlacementVariantOut


def test_rank_prefers_fewer_pads_then_lower_md():
    two_pad = PlacementVariantOut(
        variant_index=0,
        pad_count=2,
        sum_md_m=4000,
        pads=[],
        invalid=False,
    )
    one_pad = PlacementVariantOut(
        variant_index=0,
        pad_count=1,
        sum_md_m=5000,
        pads=[],
        invalid=False,
    )
    ranked = rank_variants([two_pad, one_pad])
    assert ranked[0].pad_count == 1
    assert variant_sort_key(ranked[0]) < variant_sort_key(ranked[1])


def test_invalid_variants_sort_last():
    bad = PlacementVariantOut(
        variant_index=0,
        pad_count=1,
        sum_md_m=1000,
        pads=[],
        invalid=True,
    )
    good = PlacementVariantOut(
        variant_index=0,
        pad_count=2,
        sum_md_m=9000,
        pads=[],
        invalid=False,
    )
    ranked = rank_variants([bad, good])
    assert ranked[0].invalid is False
