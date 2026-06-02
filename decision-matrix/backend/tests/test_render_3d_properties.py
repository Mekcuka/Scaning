"""render_3d_properties merge helpers."""

from app.geo.render_3d_properties import (
    RENDER_3D_MODEL_ID_KEY,
    RENDER_3D_STYLE_KEY,
    merge_infra_properties_patch,
)
from app.services.map3d_custom_models import normalize_assigned_subtypes


def test_merge_infra_properties_patch_clears_nullable_keys():
    existing = {
        RENDER_3D_MODEL_ID_KEY: "custom:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        RENDER_3D_STYLE_KEY: "model",
        "sand_volume_m3": 10,
    }
    merged = merge_infra_properties_patch(
        existing,
        {
            RENDER_3D_MODEL_ID_KEY: None,
            RENDER_3D_STYLE_KEY: "",
            "sand_volume_m3": 12,
        },
    )
    assert RENDER_3D_MODEL_ID_KEY not in merged
    assert RENDER_3D_STYLE_KEY not in merged
    assert merged["sand_volume_m3"] == 12


def test_normalize_assigned_subtypes_legacy_pad():
    assert normalize_assigned_subtypes(["pad"]) == ["oil_pad"]
