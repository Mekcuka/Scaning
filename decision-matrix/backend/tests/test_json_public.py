"""Tests for JSON public encoding helpers."""

import json
import math

from app.core.json_public import json_public_roundtrip, sanitize_json_floats


def test_sanitize_json_floats_replaces_nan_and_inf():
    payload = {
        "min_sf": float("nan"),
        "md": float("inf"),
        "ok": 1.5,
        "nested": [{"tvd": float("-inf")}, {"tvd": 100.0}],
    }
    cleaned = sanitize_json_floats(payload)
    assert cleaned["min_sf"] is None
    assert cleaned["md"] is None
    assert cleaned["ok"] == 1.5
    assert cleaned["nested"][0]["tvd"] is None
    assert cleaned["nested"][1]["tvd"] == 100.0


def test_json_public_roundtrip_is_json_compliant():
    payload = {"x": float("nan"), "y": [float("inf"), 2.0]}
    out = json_public_roundtrip(payload)
    text = json.dumps(out)
    assert "null" in text
    assert out["x"] is None
    assert out["y"] == [None, 2.0]
    assert math.isfinite(out["y"][1])
