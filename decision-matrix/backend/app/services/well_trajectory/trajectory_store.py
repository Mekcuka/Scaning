"""Read/write well trajectory JSON on pad object properties."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.services.well_trajectory.properties import (
    PAD_WELLS_TRAJECTORIES_JSON,
    WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT,
    WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON,
    WELL_TRAJECTORY_COMPUTED_AT,
)


def read_trajectories_json(props: dict[str, Any] | None) -> list[dict[str, Any]]:
    raw = (props or {}).get(PAD_WELLS_TRAJECTORIES_JSON)
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict):
            out.append(dict(item))
    return out


def store_trajectories_json(
    props: dict[str, Any] | None,
    trajectories: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    out = dict(props or {})
    if not trajectories:
        out.pop(PAD_WELLS_TRAJECTORIES_JSON, None)
        return out
    out[PAD_WELLS_TRAJECTORIES_JSON] = trajectories
    return out


def store_computed_at(props: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(props or {})
    out[WELL_TRAJECTORY_COMPUTED_AT] = datetime.now(UTC).isoformat()
    return out


def read_computed_at(props: dict[str, Any] | None) -> str | None:
    raw = (props or {}).get(WELL_TRAJECTORY_COMPUTED_AT)
    return str(raw) if raw is not None else None


def read_clearance_pairs_json(props: dict[str, Any] | None) -> list[dict[str, Any]]:
    raw = (props or {}).get(WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON)
    if not isinstance(raw, list):
        return []
    return [dict(item) for item in raw if isinstance(item, dict)]


def read_clearance_computed_at(props: dict[str, Any] | None) -> str | None:
    raw = (props or {}).get(WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT)
    return str(raw) if raw is not None else None


def store_clearance_results(
    props: dict[str, Any] | None,
    *,
    pairs: list[dict[str, Any]],
    computed_at: str,
) -> dict[str, Any]:
    out = dict(props or {})
    out[WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON] = pairs
    out[WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT] = computed_at
    return out
