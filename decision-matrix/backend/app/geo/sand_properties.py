"""Sand volume keys in InfrastructureObject.properties (logistics MVP)."""

from __future__ import annotations

from datetime import date

from app.geo.entry_date import is_in_service

SAND_VOLUME_INITIAL_M3 = "sand_volume_initial_m3"
SAND_VOLUME_CURRENT_M3 = "sand_volume_current_m3"
SAND_VOLUME_DEMAND_M3 = "sand_volume_m3"
SAND_VOLUME_BY_YEAR = "sand_volume_by_year"
SAND_VOLUME_MODE = "sand_volume_mode"

SAND_QUARRY_SUBTYPE = "sand_quarry"
NODE_SUBTYPE = "node"

SAND_PROPERTY_KEYS = frozenset(
    {
        SAND_VOLUME_INITIAL_M3,
        SAND_VOLUME_CURRENT_M3,
        SAND_VOLUME_DEMAND_M3,
        SAND_VOLUME_BY_YEAR,
        SAND_VOLUME_MODE,
    }
)

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


def read_sand_volume_by_year(properties: dict | None) -> dict[str, float]:
    raw = (properties or {}).get(SAND_VOLUME_BY_YEAR)
    if not isinstance(raw, dict):
        return {}
    out: dict[str, float] = {}
    for key, val in raw.items():
        year = str(key).strip()
        if not year.isdigit() or len(year) != 4:
            continue
        n = parse_nonneg_float(val)
        if n is not None and n > 0:
            out[year] = n
    return out


def read_sand_volume_input_mode(properties: dict | None) -> str:
    raw = (properties or {}).get(SAND_VOLUME_MODE)
    if raw == "yearly":
        return "yearly"
    if raw == "single":
        return "single"
    if read_sand_volume_by_year(properties):
        return "yearly"
    return "single"


def sand_demand_plan_total_m3(properties: dict | None) -> float:
    mode = read_sand_volume_input_mode(properties)
    if mode == "yearly":
        plan = read_sand_volume_by_year(properties)
        return sum(plan.values()) if plan else 0.0
    return read_sand_demand_m3(properties)


def _year_end(y: int) -> date:
    return date(y, 12, 31)


def demand_increment_for_year(
    properties: dict | None,
    entry_date: date,
    year: int,
) -> float:
    """Sand demand increment for calendar year (horizon simulation step)."""
    year_end = _year_end(year)
    if not is_in_service(entry_date, year_end):
        return 0.0
    mode = read_sand_volume_input_mode(properties)
    if mode == "yearly":
        return read_sand_volume_by_year(properties).get(str(year), 0.0)
    if year == entry_date.year:
        return read_sand_demand_m3(properties)
    return 0.0


def compute_horizon_bounds(
    entry_dates: list[date],
    plan_years: list[int],
) -> tuple[date, date]:
    """Default horizon [from, to] from entry dates and yearly plan years."""
    today = date.today()
    if not entry_dates:
        return today, today
    horizon_from = min(entry_dates)
    max_entry = max(entry_dates)
    max_plan_year = max(plan_years) if plan_years else max_entry.year
    end_year = max(max_entry.year, max_plan_year)
    horizon_to = date(end_year, 12, 31)
    return horizon_from, horizon_to


def effective_sand_demand_m3(
    properties: dict | None,
    entry_date: date,
    as_of: date,
) -> tuple[float, float, dict[str, float]]:
    """Return (effective demand at as_of, total plan m3, breakdown by year included)."""
    mode = read_sand_volume_input_mode(properties)
    plan = read_sand_volume_by_year(properties)
    plan_total = (
        sum(plan.values()) if mode == "yearly" and plan else read_sand_demand_m3(properties)
    )

    if mode == "yearly" and plan:
        breakdown: dict[str, float] = {}
        effective = 0.0
        for y in range(entry_date.year, as_of.year + 1):
            year_key = str(y)
            vol = plan.get(year_key, 0.0)
            if vol <= 0:
                continue
            year_as_of = min(as_of, _year_end(y))
            if is_in_service(entry_date, year_as_of):
                breakdown[year_key] = vol
                effective += vol
        return round(effective, 2), round(plan_total, 2), breakdown

    if is_in_service(entry_date, as_of):
        demand = read_sand_demand_m3(properties)
        return round(demand, 2), round(demand, 2), {}

    fallback = read_sand_demand_m3(properties)
    return 0.0, round(fallback, 2), {}


def strip_sand_volume_properties(properties: dict | None) -> dict:
    """Remove sand logistics keys (e.g. well bottomholes must not carry sand demand)."""
    props = dict(properties or {})
    for key in SAND_PROPERTY_KEYS:
        props.pop(key, None)
    return props


def is_sand_consumer_subtype(subtype: str) -> bool:
    from app.services.well_trajectory.bottomhole_properties import is_bottomhole_subtype

    st = subtype.strip().lower()
    if is_bottomhole_subtype(st):
        return False
    return st not in SAND_DEMAND_EXCLUDED_SUBTYPES


def apply_default_sand_volumes(subtype: str, properties: dict | None) -> dict:
    """Fill sand volume properties on new point objects when keys are absent."""
    from app.geo.constants import LINE_SUBTYPES
    from app.services.well_trajectory.bottomhole_properties import is_bottomhole_subtype

    props = dict(properties or {})
    st = subtype.strip().lower()
    if is_bottomhole_subtype(st):
        return strip_sand_volume_properties(props)
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
        props[SAND_VOLUME_MODE] = "single"
    return props
