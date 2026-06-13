"""Tests for pad layout seed generation."""

from well_trajectory.pad_seed import DEFAULT_STUB_TVD_M, generate_from_pad_layout
from well_trajectory.schemas import PadGenerateFromLayoutRequest, WellLocal


def test_generate_twelve_vertical_stubs():
    req = PadGenerateFromLayoutRequest(
        wells_local=[WellLocal(east_m=float(i * 9), north_m=0.0) for i in range(12)],
        kb_m=151.0,
        rotation_deg=90.0,
    )
    result = generate_from_pad_layout(req)
    assert len(result.wells) == 12
    for i, well in enumerate(result.wells):
        assert well.well_index == i
        assert well.design.profile == "vertical"
        assert well.survey.stations[0].inc == 0.0
        assert well.survey.stations[-1].tvd == DEFAULT_STUB_TVD_M
        assert well.geometry is not None
        assert well.geometry.length_m == DEFAULT_STUB_TVD_M
