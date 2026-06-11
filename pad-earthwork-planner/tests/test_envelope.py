import pytest

from pad_earthwork.envelope import (
    compute_envelope_volumes,
    envelope_fill_volume_m3,
    offset_polygon_outward,
)
from pad_earthwork.schemas import EnvelopeWrap, PlanVertex


def test_offset_square_grows_area():
    square = [
        PlanVertex(east_m=-5, north_m=-5),
        PlanVertex(east_m=5, north_m=-5),
        PlanVertex(east_m=5, north_m=5),
        PlanVertex(east_m=-5, north_m=5),
    ]
    outer = offset_polygon_outward(square, 2.0)
    assert len(outer) == 4
    xs = [v.east_m for v in outer]
    assert max(xs) >= 6.5
    assert min(xs) <= -6.5


def test_envelope_fill_volume_truncated_pyramid():
    # S_top=100, S_bottom=196, H=2 → (2/3)×(100+196+√19600)=290⅔
    assert envelope_fill_volume_m3(100.0, 196.0, 2.0) == pytest.approx(290 + 2 / 3)


def test_compute_envelope_volumes_square():
    square = [
        PlanVertex(east_m=-5, north_m=-5),
        PlanVertex(east_m=5, north_m=-5),
        PlanVertex(east_m=5, north_m=5),
        PlanVertex(east_m=-5, north_m=5),
    ]
    fill, area_bottom, outer, warnings = compute_envelope_volumes(
        square,
        2.0,
        EnvelopeWrap(wrap_width_m=2.0),
    )
    assert fill > 200.0
    assert area_bottom > 100.0
    assert len(outer) == 4
    assert "envelope_volume_is_truncated_pyramid_approximation" in warnings
