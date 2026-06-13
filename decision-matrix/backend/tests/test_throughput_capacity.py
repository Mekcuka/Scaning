"""Default throughput capacity on infra create."""

from app.geo.throughput_capacity import apply_default_throughput_capacity


def test_apply_default_for_methanol_facility():
    props = apply_default_throughput_capacity("methanol_facility", {})
    assert props["throughput_capacity_annual"] == 500.0
    assert props["capacity_unit"] == "thousand_t_per_year"


def test_skips_excluded_subtypes():
    assert apply_default_throughput_capacity("node", {}) == {}


def test_skips_well_bottomhole_subtypes():
    for subtype in (
        "well_bottomhole_nnb",
        "well_bottomhole_gs_heel",
        "well_bottomhole_gs_toe",
    ):
        assert apply_default_throughput_capacity(subtype, {}) == {}


def test_does_not_override_existing():
    props = apply_default_throughput_capacity(
        "gas_processing",
        {"throughput_capacity_annual": 99.0, "capacity_unit": "thousand_m3_per_year"},
    )
    assert props["throughput_capacity_annual"] == 99.0
