"""Defaults for sand volume properties on create."""

from app.geo.sand_properties import (
    DEFAULT_SAND_DEMAND_M3,
    DEFAULT_SAND_QUARRY_VOLUME_M3,
    SAND_VOLUME_CURRENT_M3,
    SAND_VOLUME_DEMAND_M3,
    SAND_VOLUME_INITIAL_M3,
    SAND_VOLUME_MODE,
    apply_default_sand_volumes,
)


def test_default_quarry_volumes():
    props = apply_default_sand_volumes("sand_quarry", {})
    assert props[SAND_VOLUME_INITIAL_M3] == DEFAULT_SAND_QUARRY_VOLUME_M3
    assert props[SAND_VOLUME_CURRENT_M3] == DEFAULT_SAND_QUARRY_VOLUME_M3


def test_default_consumer_demand():
    props = apply_default_sand_volumes("oil_pad", {})
    assert props[SAND_VOLUME_DEMAND_M3] == DEFAULT_SAND_DEMAND_M3


def test_skips_line_and_node():
    assert apply_default_sand_volumes("autoroad", {}) == {}
    assert apply_default_sand_volumes("node", {}) == {}


def test_preserves_explicit_values():
    props = apply_default_sand_volumes("oil_pad", {SAND_VOLUME_DEMAND_M3: 42.0})
    assert props[SAND_VOLUME_DEMAND_M3] == 42.0


def test_strips_sand_from_well_bottomholes():
    polluted = {
        SAND_VOLUME_DEMAND_M3: 1000.0,
        SAND_VOLUME_MODE: "single",
        "well_bottomhole_tvd_m": 2000.0,
    }
    for subtype in (
        "well_bottomhole_nnb",
        "well_bottomhole_gs_heel",
        "well_bottomhole_gs_toe",
    ):
        props = apply_default_sand_volumes(subtype, polluted)
        assert SAND_VOLUME_DEMAND_M3 not in props
        assert SAND_VOLUME_MODE not in props
        assert props["well_bottomhole_tvd_m"] == 2000.0
