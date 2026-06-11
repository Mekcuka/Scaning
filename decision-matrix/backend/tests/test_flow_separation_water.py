"""Produced water from oil debit and separation share."""

from app.models import PointOfInterest
from app.services.flow_capacity import (
    _branch_capacity,
    liquid_from_oil_thousand_t_per_year,
    produced_water_from_oil_thousand_t_per_year,
)


def test_liquid_and_produced_water_from_oil():
    assert liquid_from_oil_thousand_t_per_year(500.0, 0.85) == 588.2
    assert produced_water_from_oil_thousand_t_per_year(500.0, 0.85) == 88.2


def test_branch_capacity_water_at_separator_uses_produced_not_injection():
    poi = PointOfInterest(
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        planned_production_volume=500.0,
        water_injection_volume=250.0,
    )
    cap, unit = _branch_capacity(
        poi,
        500.0,
        250.0,
        "water",
        separation_share=0.85,
    )
    assert unit == "thousand_t_per_year"
    assert cap == 88.2
