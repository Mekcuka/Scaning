"""Read/write PyWellGeo JSON on pad object properties."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

from app.services.well_trajectory.properties import (
    PAD_PYWELLGEO_LAST_COMPUTED_AT,
    PAD_PYWELLGEO_SETTINGS_JSON,
    PAD_PYWELLGEO_TREES_JSON,
)

DEFAULT_PYWELLGEO_SETTINGS: dict[str, Any] = {
    "default_radius_m": 0.10795,
    "tsurface_c": 10.0,
    "tgrad_c_per_m": 0.031,
    "yaml_format_default": "XYZGENERIC",
}


def read_settings_json(props: dict[str, Any] | None) -> dict[str, Any]:
    raw = (props or {}).get(PAD_PYWELLGEO_SETTINGS_JSON)
    if not isinstance(raw, dict):
        return dict(DEFAULT_PYWELLGEO_SETTINGS)
    merged = dict(DEFAULT_PYWELLGEO_SETTINGS)
    merged.update(raw)
    return merged


def read_trees_json(props: dict[str, Any] | None) -> list[dict[str, Any]]:
    raw = (props or {}).get(PAD_PYWELLGEO_TREES_JSON)
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict):
            out.append(dict(item))
    return out


def trees_json_for_api(props: dict[str, Any] | None) -> list[dict[str, Any]]:
    """Trees safe for HTTP JSON (deep main-bore chains)."""
    return json.loads(json.dumps(read_trees_json(props), default=str))


def store_settings_json(props: dict[str, Any] | None, settings: dict[str, Any]) -> dict[str, Any]:
    out = dict(props or {})
    out[PAD_PYWELLGEO_SETTINGS_JSON] = settings
    return out


def store_trees_json(props: dict[str, Any] | None, trees: list[dict[str, Any]]) -> dict[str, Any]:
    out = dict(props or {})
    if trees:
        out[PAD_PYWELLGEO_TREES_JSON] = trees
    else:
        out.pop(PAD_PYWELLGEO_TREES_JSON, None)
    return out


def store_computed_at(props: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(props or {})
    out[PAD_PYWELLGEO_LAST_COMPUTED_AT] = datetime.now(UTC).isoformat()
    return out


def read_computed_at(props: dict[str, Any] | None) -> str | None:
    raw = (props or {}).get(PAD_PYWELLGEO_LAST_COMPUTED_AT)
    return str(raw) if raw is not None else None
