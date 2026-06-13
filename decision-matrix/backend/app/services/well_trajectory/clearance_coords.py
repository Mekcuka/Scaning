"""Project-wide ENU coordinates for anti-collision clearance (cross-pad pairs)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import _read_float
from app.services.pad_earthwork.properties import (
    DEFAULT_PAD_HEIGHT_M,
    DEFAULT_PAD_REFERENCE_ELEVATION_M,
    PAD_HEIGHT_M,
    PAD_REFERENCE_ELEVATION_M,
)
from app.services.well_trajectory.coord_transform import local_to_lonlat, lonlat_to_local
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_store import read_trajectories_json


def _kb_m(props: dict[str, Any]) -> float:
    ref = _read_float(props, PAD_REFERENCE_ELEVATION_M)
    if ref is None:
        ref = DEFAULT_PAD_REFERENCE_ELEVATION_M
    height = _read_float(props, PAD_HEIGHT_M)
    if height is None:
        height = DEFAULT_PAD_HEIGHT_M
    return ref + height


@dataclass(frozen=True)
class ProjectWellMeta:
    pad_id: UUID
    pad_name: str
    well_index: int
    well_key: str
    name: str
    error_model: str
    azi_reference: str


@dataclass
class ClearanceCollection:
    surveys: list[dict[str, Any]]
    meta: list[ProjectWellMeta]
    project_lon0: float
    project_lat0: float
    skips: list[str]


def _project_anchor(pads: list[InfrastructureObject]) -> tuple[float, float]:
    lons: list[float] = []
    lats: list[float] = []
    for pad in pads:
        trajectories = read_trajectories_json(pad.properties)
        if not trajectories:
            continue
        lons.append(float(pad.longitude))
        lats.append(float(pad.latitude))
    if not lons:
        raise ValueError("No pads with trajectories for project anchor")
    return sum(lons) / len(lons), sum(lats) / len(lats)


def _station_arrays(
    well: dict[str, Any],
    *,
    pad: InfrastructureObject,
    project_lon0: float,
    project_lat0: float,
) -> dict[str, list[float]] | None:
    survey = well.get("survey") or {}
    stations = survey.get("stations") or []
    if not isinstance(stations, list) or len(stations) < 2:
        return None

    pad_lon = float(pad.longitude)
    pad_lat = float(pad.latitude)
    md: list[float] = []
    inc: list[float] = []
    azi: list[float] = []
    n: list[float] = []
    e: list[float] = []
    tvd: list[float] = []

    for st in stations:
        if not isinstance(st, dict):
            continue
        try:
            east_pad = float(st.get("e", 0))
            north_pad = float(st.get("n", 0))
            tvd_m = float(st.get("tvd", 0))
            md.append(float(st.get("md", len(md))))
            inc.append(float(st.get("inc", 0)))
            azi.append(float(st.get("azi", 0)))
        except (TypeError, ValueError):
            continue
        lon, lat = local_to_lonlat(pad_lon, pad_lat, east_pad, north_pad)
        east_proj, north_proj = lonlat_to_local(project_lon0, project_lat0, lon, lat)
        e.append(east_proj)
        n.append(north_proj)
        tvd.append(tvd_m)

    if len(md) < 2:
        return None
    return {"md": md, "inc": inc, "azi": azi, "n": n, "e": e, "tvd": tvd}


def collect_project_wells_for_clearance(
    pads: list[InfrastructureObject],
    *,
    pad_filter: UUID | None = None,
) -> ClearanceCollection:
    """Build planner surveys in unified project ENU."""
    active_pads = [p for p in pads if read_trajectories_json(p.properties)]
    if not active_pads:
        return ClearanceCollection(surveys=[], meta=[], project_lon0=0.0, project_lat0=0.0, skips=["No trajectories"])

    project_lon0, project_lat0 = _project_anchor(active_pads)
    surveys: list[dict[str, Any]] = []
    meta: list[ProjectWellMeta] = []
    skips: list[str] = []

    for pad in active_pads:
        if pad_filter is not None and pad.id != pad_filter:
            continue
        props = pad.properties or {}
        settings = well_trajectory_settings_for_pad(pad)
        trajectories = read_trajectories_json(props)
        for well in trajectories:
            if not isinstance(well, dict):
                continue
            well_index = int(well.get("well_index", len(meta)))
            name = str(well.get("name") or f"Скв-{well_index + 1}")
            arrays = _station_arrays(
                well,
                pad=pad,
                project_lon0=project_lon0,
                project_lat0=project_lat0,
            )
            if arrays is None:
                skips.append(f"{pad.name} / {name}: survey < 2 stations")
                continue
            error_model = str(well.get("error_model") or settings.default_error_model)
            azi_ref = str(well.get("azi_reference") or settings.default_azi_reference)
            well_key = f"{pad.id}:{well_index}"
            meta.append(
                ProjectWellMeta(
                    pad_id=pad.id,
                    pad_name=pad.name or "",
                    well_index=well_index,
                    well_key=well_key,
                    name=name,
                    error_model=error_model,
                    azi_reference=azi_ref,
                )
            )
            surveys.append(
                {
                    "name": name,
                    **arrays,
                    "error_model": error_model,
                    "azi_reference": azi_ref,
                }
            )

    return ClearanceCollection(
        surveys=surveys,
        meta=meta,
        project_lon0=project_lon0,
        project_lat0=project_lat0,
        skips=skips,
    )


def all_pair_indices(count: int) -> list[list[int]]:
    pairs: list[list[int]] = []
    for i in range(count):
        for j in range(i + 1, count):
            pairs.append([i, j])
    return pairs


def intra_pad_pair_indices(meta: list[ProjectWellMeta]) -> list[list[int]]:
    by_pad: dict[UUID, list[int]] = {}
    for idx, m in enumerate(meta):
        by_pad.setdefault(m.pad_id, []).append(idx)
    pairs: list[list[int]] = []
    for indices in by_pad.values():
        for a in range(len(indices)):
            for b in range(a + 1, len(indices)):
                pairs.append([indices[a], indices[b]])
    return pairs
