from app.geo.render_3d_properties import (
    RENDER_3D_BASE_KEY,
    RENDER_3D_HEIGHT_KEY,
    feature_properties_for_import,
    merge_geojson_render_3d,
    z_from_geojson_coordinates,
)
from app.services.import_service import _parse_csv_rows, _parse_geojson


def test_z_from_point_coordinates():
    assert z_from_geojson_coordinates("Point", [30.0, 60.0, 12.5]) == 12.5


def test_z_from_linestring_first_vertex():
    assert z_from_geojson_coordinates(
        "LineString",
        [[30.0, 60.0], [31.0, 61.0, 8.0]],
    ) == 8.0


def test_feature_properties_for_import_geometry_z():
    props = feature_properties_for_import({"height_m": 5}, geometry_z=3.0)
    merged = merge_geojson_render_3d(props)
    assert merged[RENDER_3D_HEIGHT_KEY] == 5
    assert merged[RENDER_3D_BASE_KEY] == 3.0


def test_parse_geojson_passes_properties_and_z():
    content = """{
      "type": "FeatureCollection",
      "features": [{
        "type": "Feature",
        "properties": {
          "subtype": "node",
          "name": "N1",
          "height_m": 15
        },
        "geometry": {
          "type": "Point",
          "coordinates": [37.6, 55.7, 4.2]
        }
      }]
    }"""
    rows, errors = _parse_geojson(content)
    assert not errors
    assert len(rows) == 1
    assert rows[0]["properties"]["height_m"] == 15
    assert rows[0]["properties"][RENDER_3D_BASE_KEY] == 4.2


def test_parse_csv_height_m_column():
    content = "type,name,lon,lat,height_m\nnode,A,37.6,55.7,20\n"
    rows, errors = _parse_csv_rows(content)
    assert not errors
    assert rows[0]["properties"]["height_m"] == "20"
