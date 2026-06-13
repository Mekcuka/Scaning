"""Tests for resolve_footprint_lonlat."""

from types import SimpleNamespace

from app.services.pad_earthwork.service import resolve_footprint_lonlat


def _obj(subtype: str, *, lon: float = 37.62, lat: float = 55.76, properties: dict | None = None):
    return SimpleNamespace(
        subtype=subtype,
        longitude=lon,
        latitude=lat,
        properties=properties or {},
    )


def test_resolve_footprint_default_rectangle():
    corners = resolve_footprint_lonlat(_obj("substation"))
    assert corners is not None
    assert len(corners) == 4
    lons = [c[0] for c in corners]
    lats = [c[1] for c in corners]
    assert min(lons) < 37.62 < max(lons)
    assert min(lats) < 55.76 < max(lats)


def test_resolve_footprint_skips_node():
    assert resolve_footprint_lonlat(_obj("node")) is None


def test_resolve_footprint_sand_quarry():
    corners = resolve_footprint_lonlat(_obj("sand_quarry"))
    assert corners is not None
    assert len(corners) == 4


def test_resolve_footprint_custom_dimensions():
    corners = resolve_footprint_lonlat(
        _obj("substation", properties={"pad_length_m": 100, "pad_width_m": 50}),
    )
    assert corners is not None
    lon_span = max(c[0] for c in corners) - min(c[0] for c in corners)
    lat_span = max(c[1] for c in corners) - min(c[1] for c in corners)
    assert lon_span > 0
    assert lat_span > 0
