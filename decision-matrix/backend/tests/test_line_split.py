"""Line split plan."""

from app.models import InfrastructureObject
from app.services.line_split import build_line_split_plan, split_line_coordinates_at


def _line() -> InfrastructureObject:
    return InfrastructureObject(
        id=None,  # type: ignore[arg-type]
        layer_id=None,  # type: ignore[arg-type]
        name="Road-1",
        subtype="autoroad",
        category="road",
        longitude=37.0,
        latitude=55.0,
        end_longitude=37.02,
        end_latitude=55.0,
        properties={"coordinates": [[37.0, 55.0], [37.01, 55.0], [37.02, 55.0]]},
    )


def test_split_line_coordinates_at():
    coords = [(37.0, 55.0), (37.01, 55.0), (37.02, 55.0)]
    parts = split_line_coordinates_at(coords, 0, 37.005, 55.0)
    assert parts is not None
    first, second = parts
    assert len(first) >= 2
    assert len(second) >= 2
    assert first[-1] == [37.005, 55.0]
    assert second[0] == [37.005, 55.0]


def test_build_line_split_plan():
    plan = build_line_split_plan(_line(), 0, 37.005, 55.0, "Road-1 (2)")
    assert plan is not None
    assert plan.second_name == "Road-1 (2)"
