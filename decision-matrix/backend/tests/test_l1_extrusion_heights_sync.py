import json
from pathlib import Path

from app.geo.render_3d_properties import default_height_for_subtype, l1_default_height_m, l1_heights_table

from app.geo.render_3d_properties import _resolve_l1_json_path

_L1_JSON = _resolve_l1_json_path()
_FRONTEND_TS = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "map3d" / "extrusionHeights.ts"


def test_backend_l1_matches_shared_json():
    data = json.loads(_L1_JSON.read_text(encoding="utf-8"))
    assert l1_heights_table() == {k: float(v) for k, v in data["heights"].items()}
    assert l1_default_height_m() == float(data["default_height_m"])


def test_backend_defaults_use_l1_table():
    assert default_height_for_subtype("oil_pipeline") == 4
    assert default_height_for_subtype("unknown_subtype_xyz") == l1_default_height_m()


def test_frontend_ts_imports_shared_json():
    text = _FRONTEND_TS.read_text(encoding="utf-8")
    assert "l1_extrusion_heights.json" in text
