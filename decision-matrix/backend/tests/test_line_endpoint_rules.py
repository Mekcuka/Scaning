"""Line endpoint snap to point object coordinates."""

import uuid

import pytest

from app.models import InfrastructureObject
from app.services.line_endpoint_rules import (
    ENDPOINT_SNAP_TOLERANCE_KM,
    LineEndpointRuleError,
    snap_line_endpoint_coords,
    snap_line_endpoint_coords_preserve,
)


def _point_obj(lon: float, lat: float, subtype: str = "oil_pad") -> InfrastructureObject:
    return InfrastructureObject(
        id=uuid.uuid4(),
        layer_id=uuid.uuid4(),
        name="Куст",
        category="point",
        subtype=subtype,
        geometry="POINT(0 0)",
        longitude=lon,
        latitude=lat,
        end_longitude=None,
        end_latitude=None,
        properties={},
    )


def test_snap_rewrites_endpoints_to_exact_object_coords():
    pad = _point_obj(37.6, 55.75)
    near_start = (37.6001, 55.7501)
    near_finish = (37.7001, 55.8501)
    node = _point_obj(37.7, 55.85, subtype="node")

    lon, lat, end_lon, end_lat, coords = snap_line_endpoint_coords(
        lon=near_start[0],
        lat=near_start[1],
        end_lon=near_finish[0],
        end_lat=near_finish[1],
        coordinates=[
            [near_start[0], near_start[1]],
            [37.65, 55.8],
            [near_finish[0], near_finish[1]],
        ],
        candidates=[pad, node],
    )

    assert lon == pad.longitude
    assert lat == pad.latitude
    assert end_lon == node.longitude
    assert end_lat == node.latitude
    assert coords is not None
    assert coords[0] == [pad.longitude, pad.latitude]
    assert coords[-1] == [node.longitude, node.latitude]
    assert coords[1] == [37.65, 55.8]


def test_snap_rejects_endpoint_outside_tolerance():
    pad = _point_obj(37.6, 55.75)
    with pytest.raises(LineEndpointRuleError):
        snap_line_endpoint_coords(
            lon=38.0,
            lat=56.0,
            end_lon=37.7,
            end_lat=55.85,
            coordinates=None,
            candidates=[pad],
        )


def test_tolerance_constant_matches_frontend():
    assert ENDPOINT_SNAP_TOLERANCE_KM == 0.3


def test_preserve_geometry_keeps_unsnapped_end():
    """Clipboard paste: finish stays on submitted path when only start has twin id."""
    pad = _point_obj(37.6, 55.75)
    far_finish = (37.7, 55.85)
    mid = (37.65, 55.8)

    lon, lat, end_lon, end_lat, coords = snap_line_endpoint_coords_preserve(
        lon=37.6001,
        lat=55.7501,
        end_lon=far_finish[0],
        end_lat=far_finish[1],
        coordinates=[[37.6001, 55.7501], list(mid), list(far_finish)],
        forced_start=pad,
        forced_finish=None,
    )

    assert lon == pad.longitude
    assert lat == pad.latitude
    assert end_lon == far_finish[0]
    assert end_lat == far_finish[1]
    assert coords[-1] == list(far_finish)
    assert coords[1] == list(mid)


def test_forced_start_snap_ignores_closer_neighbor():
    """Clipboard paste: explicit start id must not jump to a closer unrelated point."""
    pad = _point_obj(37.6, 55.75)
    closer = _point_obj(37.60005, 55.75005)
    far_finish = _point_obj(37.7, 55.85, subtype="node")
    near_start = (37.6001, 55.7501)

    lon, lat, end_lon, end_lat, coords = snap_line_endpoint_coords(
        lon=near_start[0],
        lat=near_start[1],
        end_lon=37.7001,
        end_lat=55.8501,
        coordinates=[[near_start[0], near_start[1]], [37.65, 55.8], [37.7001, 55.8501]],
        candidates=[pad, closer, far_finish],
        forced_start=pad,
        forced_finish=None,
    )

    assert lon == pad.longitude
    assert lat == pad.latitude
    assert end_lon == far_finish.longitude
    assert coords[0] == [pad.longitude, pad.latitude]
