from app.geo.render_3d_properties import (
    RENDER_3D_BASE_KEY,
    RENDER_3D_HEIGHT_KEY,
    RENDER_3D_SCALE_KEY,
    RENDER_3D_VISIBLE_KEY,
    apply_default_render_3d,
    default_height_for_subtype,
    feature_properties_for_import,
    merge_geojson_render_3d,
    read_render_3d,
    z_from_geojson_coordinates,
)


def test_default_height_oil_pipeline():
    assert default_height_for_subtype("oil_pipeline") == 4


def test_apply_default_only_missing_keys():
    props = apply_default_render_3d("node", {RENDER_3D_HEIGHT_KEY: 99})
    assert props[RENDER_3D_HEIGHT_KEY] == 99
    assert props[RENDER_3D_VISIBLE_KEY] is True


def test_read_render_3d_override():
    cfg = read_render_3d("substation", {RENDER_3D_HEIGHT_KEY: 25})
    assert cfg.height_m == 25


def test_read_render_3d_visible_false():
    cfg = read_render_3d("node", {RENDER_3D_VISIBLE_KEY: False})
    assert cfg.visible is False


def test_read_render_3d_scale_override():
    cfg = read_render_3d("node", {RENDER_3D_SCALE_KEY: 1.5})
    assert cfg.scale == 1.5


def test_read_render_3d_scale_defaults_to_one():
    cfg = read_render_3d("node", {})
    assert cfg.scale == 1.0


def test_merge_geojson_height_alias():
    props = merge_geojson_render_3d({"height_m": 12})
    assert props[RENDER_3D_HEIGHT_KEY] == 12


def test_z_from_geojson_point():
    assert z_from_geojson_coordinates("Point", [1.0, 2.0, 3.5]) == 3.5


def test_feature_properties_excludes_reserved_keys():
    props = feature_properties_for_import(
        {"type": "node", "subtype": "node", "name": "X", "height_m": 9},
        geometry_z=2.0,
    )
    assert "type" not in props
    assert props["height_m"] == 9
    assert props[RENDER_3D_BASE_KEY] == 2.0
