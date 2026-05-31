"""3D render overrides in InfrastructureObject.properties (L2)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

RENDER_3D_HEIGHT_KEY = "render_3d_height_m"
RENDER_3D_BASE_KEY = "render_3d_base_m"
RENDER_3D_VISIBLE_KEY = "render_3d_visible"
RENDER_3D_STYLE_KEY = "render_3d_style"
RENDER_3D_MODEL_ID_KEY = "render_3d_model_id"

_RESERVED_IMPORT_PROP_KEYS = frozenset({"type", "subtype", "name"})

_L1_JSON_PATH = Path(__file__).resolve().parents[3] / "shared" / "l1_extrusion_heights.json"
with _L1_JSON_PATH.open(encoding="utf-8") as _f:
    _L1_DATA = json.load(_f)
_L1_HEIGHTS: dict[str, float] = {k: float(v) for k, v in _L1_DATA["heights"].items()}
_DEFAULT_HEIGHT_M = float(_L1_DATA["default_height_m"])


def l1_heights_table() -> dict[str, float]:
    """L1 default heights (shared with frontend via l1_extrusion_heights.json)."""
    return dict(_L1_HEIGHTS)


def l1_default_height_m() -> float:
    return _DEFAULT_HEIGHT_M


def default_height_for_subtype(subtype: str) -> float:
    return _L1_HEIGHTS.get(subtype.strip().lower(), _DEFAULT_HEIGHT_M)


def _parse_nonneg_float(raw: object | None) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        n = float(raw)
    except (TypeError, ValueError):
        return None
    if n < 0 or n != n:
        return None
    return n


def _parse_visible(raw: object | None) -> bool:
    if raw is False or raw == "false":
        return False
    return True


@dataclass(frozen=True)
class Render3DConfig:
    height_m: float
    base_m: float
    visible: bool


def read_render_3d(subtype: str, properties: dict | None) -> Render3DConfig:
    props = properties or {}
    height_override = _parse_nonneg_float(props.get(RENDER_3D_HEIGHT_KEY))
    base_override = _parse_nonneg_float(props.get(RENDER_3D_BASE_KEY))
    return Render3DConfig(
        height_m=height_override if height_override is not None else default_height_for_subtype(subtype),
        base_m=base_override if base_override is not None else 0.0,
        visible=_parse_visible(props.get(RENDER_3D_VISIBLE_KEY)),
    )


def render_3d_effective_dict(subtype: str, properties: dict | None) -> dict[str, float | bool]:
    cfg = read_render_3d(subtype, properties)
    return {
        "height_m": cfg.height_m,
        "base_m": cfg.base_m,
        "visible": cfg.visible,
    }


def extract_z_meters(coord: list | tuple) -> float | None:
    if len(coord) < 3:
        return None
    return _parse_nonneg_float(coord[2])


def z_from_geojson_coordinates(gtype: str, coords: object) -> float | None:
    """First Z from Point or LineString vertices → render_3d_base_m."""
    if gtype == "Point" and isinstance(coords, (list, tuple)) and coords:
        return extract_z_meters(coords)
    if gtype == "LineString" and isinstance(coords, list):
        for vertex in coords:
            if isinstance(vertex, (list, tuple)):
                z = extract_z_meters(vertex)
                if z is not None:
                    return z
    return None


def feature_properties_for_import(
    raw_props: dict | None,
    *,
    geometry_z: float | None = None,
) -> dict:
    """Copy GeoJSON/CSV properties for import (exclude type/subtype/name)."""
    props = {k: v for k, v in dict(raw_props or {}).items() if k not in _RESERVED_IMPORT_PROP_KEYS}
    if geometry_z is not None and RENDER_3D_BASE_KEY not in props:
        props[RENDER_3D_BASE_KEY] = geometry_z
    return props


def merge_geojson_render_3d(properties: dict) -> dict:
    """Map GeoJSON Z / height_m aliases into render_3d_* keys."""
    props = dict(properties)
    if RENDER_3D_HEIGHT_KEY not in props and "height_m" in props:
        v = _parse_nonneg_float(props.get("height_m"))
        if v is not None:
            props[RENDER_3D_HEIGHT_KEY] = v
    elevation = props.pop("elevation_m", None)
    if RENDER_3D_BASE_KEY not in props and elevation is not None:
        v = _parse_nonneg_float(elevation)
        if v is not None:
            props[RENDER_3D_BASE_KEY] = v
    return props


def apply_default_render_3d(subtype: str, properties: dict | None) -> dict:
    """Fill L2 keys only when absent (do not overwrite imports)."""
    props = dict(properties or {})
    st = subtype.strip().lower()
    if RENDER_3D_HEIGHT_KEY not in props:
        props[RENDER_3D_HEIGHT_KEY] = default_height_for_subtype(st)
    if RENDER_3D_BASE_KEY not in props:
        props[RENDER_3D_BASE_KEY] = 0.0
    if RENDER_3D_VISIBLE_KEY not in props:
        props[RENDER_3D_VISIBLE_KEY] = True
    return props
