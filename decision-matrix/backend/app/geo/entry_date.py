"""Commissioning date (Дата ввода) in InfrastructureObject.properties."""

from __future__ import annotations

from datetime import date, datetime

ENTRY_DATE_KEY = "entry_date"
NODE_SUBTYPE = "node"
DEFAULT_ENTRY_DATE = date(2020, 1, 1)
DEFAULT_ENTRY_DATE_ISO = "2020-01-01"


def object_shows_entry_date(subtype: str) -> bool:
    return subtype.strip().lower() != NODE_SUBTYPE


def parse_entry_date(raw: object | None) -> date | None:
    if raw is None or raw == "":
        return None
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    if isinstance(raw, datetime):
        return raw.date()
    text = str(raw).strip()
    if not text:
        return None
    try:
        if "T" in text:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def read_entry_date(properties: dict | None) -> date:
    parsed = parse_entry_date((properties or {}).get(ENTRY_DATE_KEY))
    return parsed if parsed is not None else DEFAULT_ENTRY_DATE


def entry_date_to_iso(d: date) -> str:
    return d.isoformat()


def is_in_service(entry: date, as_of: date) -> bool:
    return entry <= as_of


def apply_default_entry_date(subtype: str, properties: dict | None) -> dict:
    props = dict(properties or {})
    if object_shows_entry_date(subtype) and ENTRY_DATE_KEY not in props:
        props[ENTRY_DATE_KEY] = DEFAULT_ENTRY_DATE_ISO
    return props
