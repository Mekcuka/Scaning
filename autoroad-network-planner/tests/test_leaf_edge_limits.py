"""Leaf-edge length limits (connector / attachment radius)."""

from __future__ import annotations

from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from network_planner.api.app import app
from network_planner.schemas.io import PlanOptions, PlanRequest, TerminalInput
from network_planner.steiner.constraints import (
    build_attachment_limits_from_request,
    terminal_leaf_edge_length,
)
from network_planner.steiner.steinerpy import is_steinerpy_available
from network_planner.steiner.types import SteinerTreeResult
from network_planner.steiner.validate import normalize_terminal_leaves

client = TestClient(app)

PLAN_ENDPOINT = "/v1/plan/steinerpy"


def _sample_request(**kwargs) -> dict:
    start = uuid4()
    end = uuid4()
    base = {
        "project_id": str(uuid4()),
        "terminals": [
            {
                "id": str(start),
                "type": "oil_pad",
                "role": "start",
                "lon": 37.60,
                "lat": 55.75,
            },
            {
                "id": str(uuid4()),
                "type": "oil_pad",
                "role": "intermediate",
                "lon": 37.62,
                "lat": 55.76,
            },
            {
                "id": str(end),
                "type": "gas_processing",
                "role": "end",
                "lon": 37.64,
                "lat": 55.74,
            },
        ],
        "options": {"connector_max_km": 5.0, "max_points": 50},
    }
    base.update(kwargs)
    return base


def test_hub_skip_leaf_edge_length():
    ids = ["a", "b", "c"]
    tree = normalize_terminal_leaves(
        SteinerTreeResult(
            edges=[
                ("a", "b", (0.0, 0.0), (500.0, 0.0)),
                ("b", "c", (500.0, 0.0), (1000.0, 0.0)),
            ],
            length_m=1000.0,
        ),
        set(ids),
    )
    assert terminal_leaf_edge_length(tree, "b", (500.0, 0.0)) == pytest.approx(500.0)


def test_custom_steiner_hub_prefix():
    tree = SteinerTreeResult(
        edges=[
            ("a", "b", (0.0, 0.0), (500.0, 0.0)),
            ("b", "c", (500.0, 0.0), (1000.0, 0.0)),
        ],
        length_m=1000.0,
    )
    fixed = normalize_terminal_leaves(
        tree,
        {"a", "b", "c"},
        hub_prefix="myhub",
    )
    assert "myhub:0" in fixed.steiner_points


@pytest.mark.skipif(not is_steinerpy_available(), reason="steinerpy not installed")
def test_plan_accepts_attachment_max_km():
    body = _sample_request()
    body["terminals"][0]["attachment_max_km"] = 1.0
    r = client.post(PLAN_ENDPOINT, json=body)
    assert r.status_code == 200


@pytest.mark.skipif(not is_steinerpy_available(), reason="steinerpy not installed")
def test_plan_enforce_attachment_radius_false():
    body = _sample_request()
    body["options"]["enforce_attachment_radius"] = False
    r = client.post(PLAN_ENDPOINT, json=body)
    assert r.status_code == 200
    assert not any("attachment_radius" in w for w in r.json()["warnings"])


def test_build_limits_from_request():
    uid = uuid4()
    req = PlanRequest(
        terminals=[
            TerminalInput(
                id=uid,
                role="start",
                lon=37.6,
                lat=55.75,
                attachment_max_km=0.5,
            ),
            TerminalInput(id=uuid4(), role="end", lon=37.7, lat=55.75),
        ],
        options=PlanOptions(connector_max_km=0.2),
    )
    gid = f"terminal:{uid}"
    limits = build_attachment_limits_from_request([gid, f"terminal:{req.terminals[1].id}"], req)
    assert limits[gid] == pytest.approx(500.0)
    assert limits[f"terminal:{req.terminals[1].id}"] == pytest.approx(200.0)
