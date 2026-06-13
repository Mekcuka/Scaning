"""footprint connection template validation and API."""

from app.geo.footprint_connection_template import sanitize_footprint_connection_template


def test_sanitize_template_cardinal_and_center():
    raw = {
        "oil_pipeline": {"cardinal": "east", "t": 0.25},
        "gas_pipeline": None,
        "invalid_subtype": {"cardinal": "north"},
        "water_pipeline": {"cardinal": "bad"},
        "power_line": {"cardinal": "south", "t": 2.0},
    }
    out = sanitize_footprint_connection_template(raw)
    assert out["oil_pipeline"] == {"cardinal": "east", "t": 0.25}
    assert out["gas_pipeline"] is None
    assert "invalid_subtype" not in out
    assert "water_pipeline" not in out
    assert out["power_line"] == {"cardinal": "south", "t": 1.0}


def test_sanitize_template_empty():
    assert sanitize_footprint_connection_template(None) == {}
    assert sanitize_footprint_connection_template([]) == {}
