"""Tests for external linear environment analysis."""

from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.infrastructure_analysis import _subtype_cost_thousand
from app.services.spatial import (
    _candidates_from_line_object,
    _pick_nearest,
    coords_match,
    distance_to_object,
    haversine_km,
)


def _poi(lon: float, lat: float):
    return SimpleNamespace(longitude=lon, latitude=lat, id=uuid4())


def _line_obj(name: str, coords: list[tuple[float, float]]):
    lon, lat = coords[0]
    end_lon, end_lat = coords[-1]
    return SimpleNamespace(
        id=uuid4(),
        name=name,
        longitude=lon,
        latitude=lat,
        end_longitude=end_lon if len(coords) > 1 else None,
        end_latitude=end_lat if len(coords) > 1 else None,
        coordinates=None,
    )


def test_line_candidates_include_vertices_and_on_segment(monkeypatch):
    """External linear search considers both polyline vertices and closest-on-segment points."""
    poi = _poi(37.62, 55.76)
    obj = _line_obj("Road", [(37.60, 55.75), (37.70, 55.75)])
    monkeypatch.setattr(
        "app.services.spatial.line_coords_from_object",
        lambda o: [(37.60, 55.75), (37.70, 55.75)],
    )
    candidates = _candidates_from_line_object(poi, obj)
    types = {c.anchor_type for c in candidates}
    assert "line_nearest_point" in types
    assert "line_vertex" in types
    best = _pick_nearest(candidates)
    assert best is not None
    assert best.distance_km == min(c.distance_km for c in candidates)


def test_coords_match_eps():
    assert coords_match(1.0, 2.0, 1.0 + 5e-7, 2.0)
    assert not coords_match(1.0, 2.0, 1.001, 2.0)


def test_external_linear_cost_is_distance_times_rate():
    cost = _subtype_cost_thousand(
        None,
        subtype="autoroad",
        param_type="external_linear",
        status="within_limit",
        distance_km=10.0,
        rates={"autoroad": 5000},
        pads_count=1,
    )
    assert cost == 50_000.0


def test_distance_to_object_two_point_line(monkeypatch):
    poi = _poi(37.6176, 55.7558)
    obj = _line_obj("Seg", [(37.60, 55.75), (37.65, 55.76)])
    monkeypatch.setattr(
        "app.services.spatial.line_coords_from_object",
        lambda o: [(37.60, 55.75), (37.65, 55.76)],
    )
    res = distance_to_object(poi, obj)
    assert res.distance_km < haversine_km(37.6176, 55.7558, 37.60, 55.75) + 0.01
    assert res.anchor_type == "line_nearest_point"
