"""Validate point.properties.footprint_line_connections (display-only line attach per subtype)."""

from __future__ import annotations

from app.geo.constants import LINE_SUBTYPES
from app.services.line_footprint_attach import endpoint_valid_for_footprint_point
from app.subtype_manifest import EARTHWORK_SUBTYPES

FOOTPRINT_LINE_CONNECTIONS_KEY = "footprint_line_connections"
_LINE_SUBTYPE_SET = frozenset(LINE_SUBTYPES)


def _parse_edge_attach(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None
    edge_index = raw.get("edge_index")
    try:
        idx = int(edge_index)
    except (TypeError, ValueError):
        return None
    if idx < 0:
        return None
    out: dict = {"edge_index": idx}
    t_raw = raw.get("t")
    if t_raw is not None and t_raw != "":
        try:
            t = float(t_raw)
        except (TypeError, ValueError):
            return None
        out["t"] = max(0.0, min(1.0, t))
    return out


def _edge_valid_for_point(point, edge: dict) -> dict | None:
    if point.subtype not in EARTHWORK_SUBTYPES:
        return None
    valid = endpoint_valid_for_footprint_point({"point_id": "x", **edge}, point)
    if not valid:
        return None
    out = {"edge_index": valid["edge_index"]}
    if "t" in valid:
        out["t"] = valid["t"]
    return out


def sanitize_footprint_line_connections_in_properties(
    *,
    subtype: str,
    properties: dict | None,
    point,
) -> dict:
    """Sanitize connections on point update; `point` is the object being updated."""
    props = dict(properties or {})
    raw = props.get(FOOTPRINT_LINE_CONNECTIONS_KEY)
    if raw is None:
        return props
    if subtype not in EARTHWORK_SUBTYPES:
        props.pop(FOOTPRINT_LINE_CONNECTIONS_KEY, None)
        return props
    if not isinstance(raw, dict):
        props.pop(FOOTPRINT_LINE_CONNECTIONS_KEY, None)
        return props

    cleaned: dict[str, dict] = {}
    for key, value in raw.items():
        if key not in _LINE_SUBTYPE_SET:
            continue
        edge = _parse_edge_attach(value)
        if not edge:
            continue
        valid = _edge_valid_for_point(point, edge)
        if valid:
            cleaned[key] = valid

    if cleaned:
        props[FOOTPRINT_LINE_CONNECTIONS_KEY] = cleaned
    else:
        props.pop(FOOTPRINT_LINE_CONNECTIONS_KEY, None)
    return props
