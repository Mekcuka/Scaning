from pad_earthwork.schemas import PlanRectangleSketch
from pad_earthwork.volume_plan import derive_params_from_plan, plan_corners_local_m, plan_footprint_area_m2


def test_plan_area():
    sketch = PlanRectangleSketch(length_m=120, width_m=80, rotation_deg=0)
    assert plan_footprint_area_m2(sketch) == 9600.0


def test_derive_params():
    sketch = PlanRectangleSketch(length_m=10, width_m=5, rotation_deg=15)
    params = derive_params_from_plan(sketch, height_m=2, reference_elevation_m=100)
    assert params.length_m == 10
    assert params.width_m == 5
    assert params.height_m == 2
    assert params.rotation_deg == 15
    assert params.reference_elevation_m == 100


def test_plan_corners_count():
    sketch = PlanRectangleSketch(length_m=100, width_m=50, rotation_deg=0)
    assert len(plan_corners_local_m(sketch)) == 4
