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
from app.services.well_trajectory.pywellgeo_store import read_trees_json, store_trees_json


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


def strip_well_clearance(well: dict[str, Any]) -> dict[str, Any]:
    out = dict(well)
    out.pop("clearance", None)
    return out


def strip_trajectories_clearance(trajectories: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        strip_well_clearance(w) if isinstance(w, dict) else w
        for w in trajectories
    ]


def clear_pad_clearance(props: dict[str, Any] | None) -> dict[str, Any]:
    out = dict(props or {})
    out.pop(WELL_TRAJECTORY_CLEARANCE_PAIRS_JSON, None)
    out.pop(WELL_TRAJECTORY_CLEARANCE_COMPUTED_AT, None)
    trajectories = read_trajectories_json(out)
    if trajectories:
        out = store_trajectories_json(out, strip_trajectories_clearance(trajectories))
    return out


def clear_pywellgeo_trees_for_wells(
    props: dict[str, Any] | None,
    well_indices: set[int],
) -> dict[str, Any]:
    if not well_indices:
        return dict(props or {})
    remaining = [
        tree
        for tree in read_trees_json(props)
        if int(tree.get("well_index", 0)) not in well_indices
    ]
    return store_trees_json(props, remaining)


def finalize_pad_trajectories(
    props: dict[str, Any] | None,
    trajectories: list[dict[str, Any]],
    *,
    clear_clearance: bool = True,
    clear_pywellgeo_indices: set[int] | None = None,
) -> dict[str, Any]:
    """Merge trajectories into pad properties and drop stale derived results."""
    out = store_trajectories_json(props, trajectories)
    if clear_clearance:
        out = clear_pad_clearance(out)
    if clear_pywellgeo_indices:
        out = clear_pywellgeo_trees_for_wells(out, clear_pywellgeo_indices)
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


def trajectory_changed_indices(
    before: list[dict[str, Any]],
    after: list[dict[str, Any]],
) -> set[int]:
    """Well indices whose target or survey stations changed (for PyWellGeo invalidation)."""
    changed: set[int] = set()
    max_len = max(len(before), len(after))
    for idx in range(max_len):
        old = before[idx] if idx < len(before) else None
        new = after[idx] if idx < len(after) else None
        if not isinstance(old, dict) or not isinstance(new, dict):
            changed.add(idx)
            continue
        if old.get("target") != new.get("target"):
            changed.add(idx)
            continue
        old_stations = (old.get("survey") or {}).get("stations")
        new_stations = (new.get("survey") or {}).get("stations")
        if old_stations != new_stations:
            changed.add(idx)
    return changed
