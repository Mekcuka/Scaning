from pad_earthwork.schemas import PlanPolygonSketch, PlanVertex
from pad_earthwork.volume_plan import (
    derive_params_from_polygon,
    polygon_area_m2,
    polygon_bbox_dims,
    polygon_footprint_area_m2,
)


def test_polygon_area_triangle():
    verts = [
        PlanVertex(east_m=0, north_m=0),
        PlanVertex(east_m=10, north_m=0),
        PlanVertex(east_m=0, north_m=10),
    ]
    assert polygon_footprint_area_m2(verts) == 50.0


def test_polygon_bbox():
    verts = [
        PlanVertex(east_m=-5, north_m=-3),
        PlanVertex(east_m=15, north_m=-3),
        PlanVertex(east_m=15, north_m=7),
        PlanVertex(east_m=-5, north_m=7),
    ]
    length, width, rot = polygon_bbox_dims(verts)
    assert length == 20.0
    assert width == 10.0
    assert rot == 0.0


def test_derive_params_from_polygon():
    sketch = PlanPolygonSketch(
        vertices=[
            PlanVertex(east_m=-10, north_m=-5),
            PlanVertex(east_m=10, north_m=-5),
            PlanVertex(east_m=10, north_m=5),
            PlanVertex(east_m=-10, north_m=5),
        ]
    )
    params = derive_params_from_polygon(
        sketch,
        height_m=2,
        reference_elevation_m=100,
    )
    assert params.length_m == 20.0
    assert params.width_m == 10.0
    assert params.height_m == 2.0


def test_polygon_area_square():
    assert polygon_area_m2([(0, 0), (5, 0), (5, 5), (0, 5)]) == 25.0
