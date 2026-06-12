"""Tests for profile volume with envelope."""

from pad_earthwork.schemas import EnvelopeWrap, ProfileChainagePoint, ProfileSketch
from pad_earthwork.volume_profile import (
    compute_volumes_profile,
    compute_volumes_profile_with_envelope,
)


def _flat_profile() -> ProfileSketch:
    return ProfileSketch(
        width_m=40,
        design_elevation_m=152,
        chainage_points=[
            ProfileChainagePoint(chainage_m=0, elevation_m=150),
            ProfileChainagePoint(chainage_m=100, elevation_m=150),
        ],
    )


def test_profile_envelope_adds_extra_volume():
    sketch = _flat_profile()
    strip_fill, strip_cut, _, _ = compute_volumes_profile(sketch)
    assert strip_fill == 8000.0
    assert strip_cut == 0.0

    fill, cut, _, warnings = compute_volumes_profile_with_envelope(
        sketch,
        EnvelopeWrap(wrap_width_m=3),
        height_m=2,
    )
    assert fill == strip_fill + 840.0
    assert cut == strip_cut
    assert "profile_envelope_side_wrap_approximation" in warnings


def test_profile_without_envelope_uses_strip_only():
    sketch = _flat_profile()
    fill, _, _, warnings = compute_volumes_profile(sketch)
    assert fill == 8000.0
    assert "profile_envelope_side_wrap_approximation" not in warnings
