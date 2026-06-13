"""line_footprint_attach property validation."""

from types import SimpleNamespace

from app.geo.line_footprint_attach import (
    LINE_FOOTPRINT_ATTACH_KEY,
    _endpoint_valid_for_point,
    _parse_endpoint,
)


def test_parse_endpoint_accepts_t():
    ep = _parse_endpoint({"point_id": "abc", "edge_index": 2, "t": 0.25})
    assert ep == {"point_id": "abc", "edge_index": 2, "t": 0.25}


def test_parse_endpoint_rejects_invalid():
    assert _parse_endpoint(None) is None
    assert _parse_endpoint({"point_id": "", "edge_index": 0}) is None
    assert _parse_endpoint({"point_id": "x", "edge_index": -1}) is None


def test_endpoint_valid_for_earthwork_rectangle():
    point = SimpleNamespace(
        subtype="oil_pad",
        longitude=37.6,
        latitude=55.75,
        properties={"pad_length_m": 120, "pad_width_m": 80},
    )
    valid = _endpoint_valid_for_point(
        {"point_id": "p1", "edge_index": 0, "t": 0.5},
        point,
    )
    assert valid == {"point_id": "p1", "edge_index": 0, "t": 0.5}


def test_endpoint_invalid_for_node():
    point = SimpleNamespace(
        subtype="node",
        longitude=37.6,
        latitude=55.75,
        properties={},
    )
    assert _endpoint_valid_for_point({"point_id": "p1", "edge_index": 0}, point) is None


def test_endpoint_invalid_edge_index():
    point = SimpleNamespace(
        subtype="substation",
        longitude=37.6,
        latitude=55.75,
        properties={"pad_length_m": 120, "pad_width_m": 80},
    )
    assert _endpoint_valid_for_point({"point_id": "p1", "edge_index": 99}, point) is None


def test_attach_key_constant():
    assert LINE_FOOTPRINT_ATTACH_KEY == "line_footprint_attach"
