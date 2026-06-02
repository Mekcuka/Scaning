"""Unit tests for sand logistics store helpers."""

from datetime import date, datetime, timezone
from uuid import uuid4

from app.models import ProjectSandLogisticsResult
from app.services.sand_logistics_store import (
    _parse_as_of,
    _result_payload_for_storage,
    row_to_response,
)


def test_parse_as_of_from_string():
    assert _parse_as_of("2025-03-15") == date(2025, 3, 15)


def test_result_payload_for_storage_strips_top_level():
    payload = _result_payload_for_storage(
        {
            "project_id": "p1",
            "as_of": "2025-01-01",
            "network_id": "n1",
            "subnet_count": 2,
            "subnets": [{"x": 1}],
            "warnings": ["w"],
            "object_names": {"a": "A"},
        }
    )
    assert "project_id" not in payload
    assert payload["subnet_count"] == 2
    assert payload["subnets"] == [{"x": 1}]
    assert payload["timeline"] == []


def test_row_to_response_includes_horizon_and_timeline():
    row = ProjectSandLogisticsResult(
        project_id=uuid4(),
        as_of=date(2025, 12, 31),
        horizon_from=date(2024, 1, 1),
        horizon_to=date(2025, 12, 31),
        network_id=None,
        result={
            "subnet_count": 1,
            "subnets": [{"subnet_index": 1}],
            "timeline": [{"year": 2025, "as_of": "2025-12-31", "subnets": []}],
            "warnings": [],
            "object_names": {},
        },
        calculated_at=datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc),
    )
    out = row_to_response(row)
    assert out["horizon_from"] == "2024-01-01"
    assert out["horizon_to"] == "2025-12-31"
    assert out["timeline"][0]["year"] == 2025


def test_row_to_response_includes_calculated_at():
    row = ProjectSandLogisticsResult(
        project_id=uuid4(),
        as_of=date(2025, 1, 1),
        network_id=None,
        result={"subnet_count": 0, "subnets": [], "warnings": [], "object_names": {}},
        calculated_at=datetime(2025, 6, 1, 12, 0, tzinfo=timezone.utc),
    )
    out = row_to_response(row)
    assert out["calculated_at"].startswith("2025-06-01")
    assert out["as_of"] == "2025-01-01"
