"""Lexicographic ranking of pad placement variants."""

from __future__ import annotations

from app.services.pad_placement.schemas import PlacementVariantOut


def variant_sort_key(variant: PlacementVariantOut) -> tuple:
    """Lower tuple = better variant."""
    return (
        1 if variant.invalid else 0,
        variant.pad_count,
        variant.sum_md_m,
        variant.sf_violation_count,
        -(variant.min_sf if variant.min_sf is not None else float("inf")),
    )


def rank_variants(variants: list[PlacementVariantOut]) -> list[PlacementVariantOut]:
    ranked = sorted(variants, key=variant_sort_key)
    for i, variant in enumerate(ranked):
        variant.variant_index = i
    return ranked


def score_variant(
    *,
    pad_count: int,
    sum_md_m: float,
    invalid: bool,
    score_warnings: list[str],
    min_sf: float | None = None,
    sf_violation_count: int = 0,
) -> PlacementVariantOut:
    return PlacementVariantOut(
        variant_index=0,
        pad_count=pad_count,
        sum_md_m=sum_md_m,
        pads=[],
        score_warnings=score_warnings,
        invalid=invalid,
        min_sf=min_sf,
        sf_violation_count=sf_violation_count,
    )
