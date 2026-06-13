"""Validate project-level footprint line connection template (cardinal sides per line subtype)."""

from __future__ import annotations

from app.geo.constants import LINE_SUBTYPES

_LINE_SUBTYPE_SET = frozenset(LINE_SUBTYPES)
_VALID_CARDINALS = frozenset({"north", "south", "east", "west"})


def sanitize_footprint_connection_template(raw: object | None) -> dict[str, dict | None]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, dict | None] = {}
    for key, value in raw.items():
        if key not in _LINE_SUBTYPE_SET:
            continue
        if value is None:
            out[key] = None
            continue
        if not isinstance(value, dict):
            continue
        cardinal = value.get("cardinal")
        if not isinstance(cardinal, str) or cardinal not in _VALID_CARDINALS:
            continue
        entry: dict = {"cardinal": cardinal}
        t_raw = value.get("t")
        if t_raw is not None and t_raw != "":
            try:
                entry["t"] = max(0.0, min(1.0, float(t_raw)))
            except (TypeError, ValueError):
                pass
        out[key] = entry
    return out
