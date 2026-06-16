"""Infra JSON serialization with deep PyWellGeo trees."""

import json
from uuid import uuid4

from app.models import InfrastructureObject
from app.services.serializers import infra_to_public_json, infra_to_response


def _deep_pywellgeo_tree(depth: int) -> dict:
    node: dict = {"name": "main", "md": depth, "branches": []}
    for i in range(depth - 1, 0, -1):
        node = {"name": "main", "md": i, "branches": [node]}
    return {"branches": [node]}


def _make_oil_pad(properties: dict) -> InfrastructureObject:
    return InfrastructureObject(
        id=uuid4(),
        layer_id=uuid4(),
        name="pad",
        category="point",
        subtype="oil_pad",
        geometry="POINT(37.5 55.75)",
        longitude=37.5,
        latitude=55.75,
        properties=properties,
    )


def test_infra_to_public_json_deep_pywellgeo_tree():
    depth = 90
    props = {"pad_pywellgeo_trees_json": [_deep_pywellgeo_tree(depth)]}
    obj = _make_oil_pad(props)

    resp = infra_to_response(obj)
    # Pydantic model_dump may hit depth guard on very deep trees (version-dependent);
    # infra_to_public_json must always serialize for HTTP.
    payload = infra_to_public_json(obj)
    text = json.dumps(payload)
    assert "pad_pywellgeo_trees_json" in text
    assert payload["subtype"] == "oil_pad"
    tree = payload["properties"]["pad_pywellgeo_trees_json"][0]
    assert tree["branches"][0]["name"] == "main"


def test_infra_to_public_json_sanitizes_nan_in_properties():
    import math

    obj = _make_oil_pad(
        {
            "pad_wells_trajectories_json": [
                {
                    "well_index": 0,
                    "clearance": {"min_sf": math.nan},
                    "survey": {"stations": [{"md": 0, "tvd": 0}, {"md": math.nan, "tvd": 100}]},
                }
            ]
        }
    )
    payload = infra_to_public_json(obj)
    json.dumps(payload)
    traj = payload["properties"]["pad_wells_trajectories_json"][0]
    assert traj["clearance"]["min_sf"] is None
    assert traj["survey"]["stations"][1]["md"] is None
