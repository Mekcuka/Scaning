"""Sand volume keys in InfrastructureObject.properties (logistics MVP)."""

from __future__ import annotations

SAND_VOLUME_INITIAL_M3 = "sand_volume_initial_m3"
SAND_VOLUME_CURRENT_M3 = "sand_volume_current_m3"
SAND_VOLUME_DEMAND_M3 = "sand_volume_m3"

SAND_QUARRY_SUBTYPE = "sand_quarry"
NODE_SUBTYPE = "node"

# Point subtypes excluded from sand demand
SAND_DEMAND_EXCLUDED_SUBTYPES = frozenset({NODE_SUBTYPE, SAND_QUARRY_SUBTYPE})

# Defaults applied on create when keys are not provided (MVP logistics).
DEFAULT_SAND_DEMAND_M3 = 1000.0
DEFAULT_SAND_QUARRY_VOLUME_M3 = 10_000.0


def parse_nonneg_float(raw: object | None) -> float | None:
    if raw is None or raw == "":
        return None
    try:
        n = float(raw)
    except (TypeError, ValueError):
        return None
    if n < 0 or n != n:
        return None
    return n


def read_quarry_volumes(properties: dict | None) -> tuple[float, float]:
    props = properties or {}
    initial = parse_nonneg_float(props.get(SAND_VOLUME_INITIAL_M3)) or 0.0
    current = parse_nonneg_float(props.get(SAND_VOLUME_CURRENT_M3))
    if current is None:
        current = initial
    return initial, current


def read_sand_demand_m3(properties: dict | None) -> float:
    return parse_nonneg_float((properties or {}).get(SAND_VOLUME_DEMAND_M3)) or 0.0


def is_sand_consumer_subtype(subtype: str) -> bool:
    return subtype not in SAND_DEMAND_EXCLUDED_SUBTYPES


def apply_default_sand_volumes(subtype: str, properties: dict | None) -> dict:
    """Fill sand volume properties on new point objects when keys are absent."""
    from app.geo.constants import LINE_SUBTYPES

    props = dict(properties or {})
    st = subtype.strip().lower()
    if st in LINE_SUBTYPES:
        return props
    if st == SAND_QUARRY_SUBTYPE:
        if SAND_VOLUME_INITIAL_M3 not in props:
            props[SAND_VOLUME_INITIAL_M3] = DEFAULT_SAND_QUARRY_VOLUME_M3
        if SAND_VOLUME_CURRENT_M3 not in props:
            initial = parse_nonneg_float(props.get(SAND_VOLUME_INITIAL_M3))
            props[SAND_VOLUME_CURRENT_M3] = (
                initial if initial is not None else DEFAULT_SAND_QUARRY_VOLUME_M3
            )
    elif is_sand_consumer_subtype(st) and SAND_VOLUME_DEMAND_M3 not in props:
        props[SAND_VOLUME_DEMAND_M3] = DEFAULT_SAND_DEMAND_M3
    return props
