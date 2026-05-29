"""Tests for fluid routing rules."""

from app.geo.fluid_routing import active_fluids, oil_uses_pipeline_transport, water_uses_local_utilization
from app.services.calculations import EngineeringState


def test_active_fluids_oil_project():
    st = EngineeringState(fluid_type="oil", eng_injection="centralized", water_injection_volume=0)
    fluids = active_fluids(st)
    assert fluids["oil"] is True
    assert fluids["water"] is True
    assert fluids["gas"] is True


def test_active_fluids_oil_always_has_water_branch():
    st = EngineeringState(fluid_type="oil", eng_injection="local", water_injection_volume=0)
    assert active_fluids(st)["water"] is True


def test_active_fluids_gas_no_oil_branch():
    st = EngineeringState(fluid_type="gas", eng_injection="local", water_injection_volume=0)
    fluids = active_fluids(st)
    assert fluids["oil"] is False
    assert fluids["water"] is False
    assert fluids["gas"] is True


def test_water_local_utilization_when_local_injection():
    st = EngineeringState(
        fluid_type="oil",
        eng_injection="local",
        water_injection_volume=200.0,
    )
    assert water_uses_local_utilization(st) is True
    st2 = EngineeringState(
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=200.0,
    )
    assert water_uses_local_utilization(st2) is False
    st3 = EngineeringState(
        fluid_type="oil",
        eng_injection="local",
        water_injection_volume=0,
    )
    assert water_uses_local_utilization(st3) is True


def test_oil_auto_transport_skips_pipeline():
    st = EngineeringState(fluid_type="oil", eng_transport="auto")
    assert oil_uses_pipeline_transport(st) is False
    st2 = EngineeringState(fluid_type="oil", eng_transport="pipeline")
    assert oil_uses_pipeline_transport(st2) is True
