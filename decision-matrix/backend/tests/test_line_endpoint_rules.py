"""Line endpoint snap to point object coordinates."""

import uuid

import pytest

from app.models import InfrastructureObject
from app.services.line_endpoint_rules import (
    ENDPOINT_SNAP_TOLERANCE_KM,
    LineEndpointRuleError,
    snap_line_endpoint_coords,
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
