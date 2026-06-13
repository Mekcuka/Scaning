"""Tests for anti-collision clearance."""

from fastapi.testclient import TestClient

from well_trajectory.api import app
from well_trajectory.clearance import compute_clearance_pairs
from well_trajectory.schemas import ClearancePairsRequest, ClearanceSurveyIn

client = TestClient(app)


def _survey(name: str, e_off: float = 0.0) -> ClearanceSurveyIn:
    return ClearanceSurveyIn(
        name=name,
        md=[0, 500, 2000],
        inc=[0, 30, 90],
        azi=[90, 90, 90],
        n=[0, 200, 500],
        e=[e_off, e_off + 50, e_off + 800],
        tvd=[0, 400, 2500],
        error_model="ISCWSA MWD Rev5.11",
        azi_reference="grid",
    )


def test_compute_clearance_pairs_smoke():
    request = ClearancePairsRequest(
        surveys=[_survey("A", 0), _survey("B", 9)],
        pairs=[[0, 1]],
        threshold=1.0,
    )
    result = compute_clearance_pairs(request)
    assert len(result.pairs) == 1
    assert result.pairs[0].min_sf > 0
    assert isinstance(result.pairs[0].warning, bool)


def test_parallel_wells_low_sf():
    request = ClearancePairsRequest(
        surveys=[_survey("A", 0), _survey("B", 9)],
        pairs=[[0, 1]],
        threshold=1.0,
    )
    result = compute_clearance_pairs(request)
    assert result.pairs[0].min_sf < 1.0
    assert result.pairs[0].warning is True


def test_clearance_pairs_endpoint():
    res = client.post(
        "/v1/clearance/pairs",
        json={
            "surveys": [
                {
                    "name": "A",
                    "md": [0, 500, 2000],
                    "inc": [0, 30, 90],
                    "azi": [90, 90, 90],
                    "n": [0, 200, 500],
                    "e": [0, 50, 800],
                    "tvd": [0, 400, 2500],
                },
                {
                    "name": "B",
                    "md": [0, 500, 2000],
                    "inc": [0, 30, 90],
                    "azi": [90, 90, 90],
                    "n": [0, 200, 500],
                    "e": [9, 59, 809],
                    "tvd": [0, 400, 2500],
                },
            ],
            "pairs": [[0, 1]],
            "method": "iscwsa",
            "threshold": 1.0,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["pairs"]) == 1
    assert "min_sf" in body["pairs"][0]
