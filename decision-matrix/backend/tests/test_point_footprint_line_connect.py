"""footprint_line_connections property validation."""

from types import SimpleNamespace

from app.services.point_footprint_line_connect import (
    FOOTPRINT_LINE_CONNECTIONS_KEY,
    _edge_valid_for_point,
    _parse_edge_attach,
    sanitize_footprint_line_connections_in_properties,
)


def test_parse_edge_attach():
    assert _parse_edge_attach({"edge_index": 2, "t": 0.25}) == {"edge_index": 2, "t": 0.25}
    assert _parse_edge_attach({"edge_index": -1}) is None


def test_edge_valid_for_earthwork_rectangle():
    point = SimpleNamespace(
        subtype="oil_pad",
        longitude=37.6,
        latitude=55.75,
        properties={"pad_length_m": 120, "pad_width_m": 80},
    )
    valid = _edge_valid_for_point(point, {"edge_index": 0, "t": 0.5})
    assert valid == {"edge_index": 0, "t": 0.5}


def test_sanitize_strips_for_non_earthwork():
    point = SimpleNamespace(subtype="node", longitude=0, latitude=0, properties={})
    props = sanitize_footprint_line_connections_in_properties(
        subtype="node",
        properties={FOOTPRINT_LINE_CONNECTIONS_KEY: {"oil_pipeline": {"edge_index": 0}}},
        point=point,
    )
    assert FOOTPRINT_LINE_CONNECTIONS_KEY not in props


def test_connections_key_constant():
    assert FOOTPRINT_LINE_CONNECTIONS_KEY == "footprint_line_connections"
