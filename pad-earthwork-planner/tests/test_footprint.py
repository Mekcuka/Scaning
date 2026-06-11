import math

from pad_earthwork.footprint import footprint_corners_lonlat


def test_footprint_four_corners():
    corners = footprint_corners_lonlat(37.62, 55.76, 100, 50, 0)
    assert len(corners) == 4
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    assert min(lons) < 37.62 < max(lons)
    assert min(lats) < 55.76 < max(lats)


def test_footprint_rotation_changes_corners():
    base = footprint_corners_lonlat(0, 0, 100, 50, 0)
    rotated = footprint_corners_lonlat(0, 0, 100, 50, 45)
    assert base != rotated
    # center unchanged approximately
    cx = sum(c[0] for c in rotated) / 4
    cy = sum(c[1] for c in rotated) / 4
    assert abs(cx) < 1e-9
    assert abs(cy) < 1e-9


def test_footprint_area_order_of_magnitude():
    corners = footprint_corners_lonlat(37.0, 55.0, 1000, 1000, 0)
    # rough bbox span in degrees for 1km
    lon_span = max(c[0] for c in corners) - min(c[0] for c in corners)
    lat_span = max(c[1] for c in corners) - min(c[1] for c in corners)
    assert 0.005 < lon_span < 0.02
    assert 0.005 < lat_span < 0.02
    assert math.isfinite(lon_span)
