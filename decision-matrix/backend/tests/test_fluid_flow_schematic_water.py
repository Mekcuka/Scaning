"""Test centralized water shows BKNS without network."""

from uuid import uuid4

from app.models import PointOfInterest
from app.services.calculations import EngineeringState
from app.services.fluid_flow_schematic import _schematic_from_state


def test_centralized_water_shows_bkns_without_network():
    poi = PointOfInterest(
        id=uuid4(),
        project_id=uuid4(),
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=250.0,
    )
    state = EngineeringState(
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=250.0,
    )
    data = _schematic_from_state(poi, state, None, network_built=False)
    labels = [n["label"] for n in data["nodes"]]
    assert "Вода" in labels
    assert "БКНС" in labels
    assert "В пласт" in labels


def test_water_branch_always_for_oil_even_zero_injection_volume():
    poi = PointOfInterest(
        id=uuid4(),
        project_id=uuid4(),
        name="Куст",
        longitude=30.0,
        latitude=60.0,
        fluid_type="oil",
        eng_injection="centralized",
        water_injection_volume=0,
    )
    state = EngineeringState(fluid_type="oil", eng_injection="centralized", water_injection_volume=0)
    data = _schematic_from_state(poi, state, None, network_built=False)
    branch_fluids = [n["fluid"] for n in data["nodes"] if n["kind"] == "fluid_branch"]
    assert "water" in branch_fluids
    assert any(n["label"] == "В пласт" for n in data["nodes"])
