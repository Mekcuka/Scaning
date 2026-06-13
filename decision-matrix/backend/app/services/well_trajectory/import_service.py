"""Orchestrate well survey import into pad trajectories JSON."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import HTTPException

from app.core.config import settings
from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import read_nds_deg, read_wells_local
from app.services.well_trajectory.coord_transform import local_to_lonlat
from pad_earthwork.well_layout import nds_deg_to_math_rotation_deg, rotate_point
from app.services.well_trajectory.planner_bridge import planner_schemas
from app.services.well_trajectory.service import assert_pad_object, generate_trajectories_from_layout
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import read_trajectories_json


ImportFormat = Literal["csv", "wbp"]


@dataclass
class ImportOptions:
    step_m: float | None = None
    interpolate: bool = True
    match_mode: Literal["name", "order"] = "name"


@dataclass
class ImportPreviewWell:
    name: str
    station_count: int
    matched_index: int | None
    warnings: list[str]


@dataclass
class ImportPreviewResult:
    wells: list[ImportPreviewWell]
    errors: list[str]
    well_count: int
    warnings: list[str]


@dataclass
class ImportCommitResult:
    trajectories: list[dict[str, Any]]
    computed_at: str
    warnings: list[str]
    imported_count: int


def import_async_threshold() -> int:
    return max(1, int(settings.WELL_TRAJECTORY_IMPORT_ASYNC_THRESHOLD))


def _normalize_name(value: str | None) -> str:
    return (value or "").strip().casefold()


def _parse_file(format: ImportFormat, content: bytes | str) -> Any:
    adapter = get_well_trajectory_adapter()
    if format == "csv":
        text = content.decode("utf-8", errors="replace") if isinstance(content, bytes) else content
        return adapter.import_csv(text)
    if format == "wbp":
        raw = content if isinstance(content, bytes) else content.encode("utf-8")
        return adapter.import_wbp(raw)
    raise HTTPException(status_code=400, detail=f"Unsupported import format: {format}")


def _ensure_trajectory_base(obj: InfrastructureObject) -> list[dict[str, Any]]:
    trajectories = read_trajectories_json(obj.properties)
    if trajectories:
        return trajectories
    wells_local = read_wells_local(obj.properties or {})
    if not wells_local:
        return trajectories
    generated = generate_trajectories_from_layout(obj)
    return generated.trajectories


def _match_index(
    imported_name: str,
    trajectories: list[dict[str, Any]],
    *,
    file_index: int,
    match_mode: str,
    warnings: list[str],
) -> int | None:
    if match_mode == "name":
        target = _normalize_name(imported_name)
        for idx, traj in enumerate(trajectories):
            if _normalize_name(str(traj.get("name") or "")) == target:
                return idx
    if file_index < len(trajectories):
        if match_mode == "name":
            warnings.append(
                f"Well '{imported_name}' matched by order to index {file_index} "
                f"({trajectories[file_index].get('name')})"
            )
        return file_index
    warnings.append(f"Well '{imported_name}' has no slot on pad (index {file_index})")
    return None


def _wellhead_start_ne(well: dict[str, Any], obj: InfrastructureObject) -> tuple[float, float]:
    survey = well.get("survey") if isinstance(well.get("survey"), dict) else {}
    stations = survey.get("stations") if isinstance(survey.get("stations"), list) else []
    if stations and isinstance(stations[0], dict):
        return float(stations[0].get("n", 0.0)), float(stations[0].get("e", 0.0))

    wellhead = well.get("wellhead") if isinstance(well.get("wellhead"), dict) else {}
    east_m = float(wellhead.get("east_m", 0.0))
    north_m = float(wellhead.get("north_m", 0.0))
    rotation = nds_deg_to_math_rotation_deg(read_nds_deg(obj.properties or {}))
    east_rot, north_rot = rotate_point(east_m, north_m, rotation)
    return north_rot, east_rot


def _offset_stations_to_wellhead(
    obj: InfrastructureObject,
    well: dict[str, Any],
    stations: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    if not stations:
        return stations
    start_n, start_e = _wellhead_start_ne(well, obj)
    base_n = float(stations[0].get("n", 0.0))
    base_e = float(stations[0].get("e", 0.0))
    delta_n = start_n - base_n
    delta_e = start_e - base_e
    if abs(delta_n) < 1e-6 and abs(delta_e) < 1e-6:
        return stations
    out: list[dict[str, Any]] = []
    for station in stations:
        item = dict(station)
        item["n"] = float(item.get("n", 0.0)) + delta_n
        item["e"] = float(item.get("e", 0.0)) + delta_e
        out.append(item)
    return out


def _target_from_last_station(
    obj: InfrastructureObject,
    station: dict[str, Any],
) -> dict[str, Any]:
    north_m = float(station.get("n", 0.0))
    east_m = float(station.get("e", 0.0))
    lon, lat = local_to_lonlat(float(obj.longitude), float(obj.latitude), east_m, north_m)
    return {
        "source": "import",
        "plan": {"east_m": east_m, "north_m": north_m},
        "lon": lon,
        "lat": lat,
        "tvd_m": float(station.get("tvd", 0.0)),
        "inc": float(station.get("inc", 0.0)),
        "azi": float(station.get("azi", read_nds_deg(obj.properties or {}))),
    }


def _interpolate_stations(
    obj: InfrastructureObject,
    well: dict[str, Any],
    stations: list[dict[str, Any]],
    *,
    step_m: float,
) -> tuple[list[dict[str, Any]], dict[str, Any] | None]:
    if len(stations) < 2:
        return stations, None
    schemas = planner_schemas()
    azi_ref = well.get("azi_reference") or well_trajectory_settings_for_pad(obj).default_azi_reference
    stations_in = [schemas.SurveyStation.model_validate(item) for item in stations]
    adapter = get_well_trajectory_adapter()
    result = adapter.interpolate_survey(
        schemas.SurveyInterpolateRequest(
            stations=stations_in,
            step_m=step_m,
            azi_reference=azi_ref,
        )
    )
    out = [s.model_dump(mode="json") for s in result.stations]
    return out, result.geometry.model_dump(mode="json")


def preview_import(
    obj: InfrastructureObject,
    *,
    format: ImportFormat,
    content: bytes | str,
    options: ImportOptions | None = None,
) -> ImportPreviewResult:
    assert_pad_object(obj)
    options = options or ImportOptions()
    parsed = _parse_file(format, content)
    if parsed.errors and not parsed.wells:
        raise HTTPException(status_code=400, detail={"errors": parsed.errors})

    trajectories = _ensure_trajectory_base(obj)
    warnings: list[str] = list(parsed.errors)
    preview_wells: list[ImportPreviewWell] = []

    for file_index, imported in enumerate(parsed.wells):
        row_warnings = list(imported.warnings)
        matched = _match_index(
            imported.name,
            trajectories,
            file_index=file_index,
            match_mode=options.match_mode,
            warnings=row_warnings,
        )
        preview_wells.append(
            ImportPreviewWell(
                name=imported.name,
                station_count=len(imported.stations),
                matched_index=matched,
                warnings=row_warnings,
            )
        )
        warnings.extend(row_warnings)

    return ImportPreviewResult(
        wells=preview_wells,
        errors=list(parsed.errors),
        well_count=len(parsed.wells),
        warnings=warnings,
    )


def commit_import(
    obj: InfrastructureObject,
    *,
    format: ImportFormat,
    content: bytes | str,
    options: ImportOptions | None = None,
) -> ImportCommitResult:
    assert_pad_object(obj)
    options = options or ImportOptions()
    parsed = _parse_file(format, content)
    if parsed.errors and not parsed.wells:
        raise HTTPException(status_code=400, detail={"errors": parsed.errors})

    trajectories = _ensure_trajectory_base(obj)
    if not trajectories:
        raise HTTPException(
            status_code=400,
            detail="Pad has no well layout; configure pad wells before importing surveys",
        )

    settings = well_trajectory_settings_for_pad(obj)
    step_m = options.step_m if options.step_m is not None else settings.step_m
    warnings: list[str] = list(parsed.errors)
    imported_count = 0
    touched_indices: set[int] = set()

    for file_index, imported in enumerate(parsed.wells):
        idx = _match_index(
            imported.name,
            trajectories,
            file_index=file_index,
            match_mode=options.match_mode,
            warnings=warnings,
        )
        if idx is None:
            continue

        well = dict(trajectories[idx])
        stations = [s.model_dump(mode="json") for s in imported.stations]
        stations = _offset_stations_to_wellhead(obj, well, stations)

        geometry = imported.geometry.model_dump(mode="json") if imported.geometry else None
        if options.interpolate and len(stations) >= 2:
            stations, geometry = _interpolate_stations(obj, well, stations, step_m=step_m)

        well["name"] = imported.name
        well["azi_reference"] = imported.azi_reference
        well["survey"] = {"source": "imported", "stations": stations}
        if geometry is not None:
            well["geometry"] = geometry
        well["target"] = _target_from_last_station(obj, stations[-1])
        well.pop("clearance", None)

        trajectories[idx] = well
        touched_indices.add(idx)
        imported_count += 1
        warnings.extend(imported.warnings)

    if imported_count == 0:
        raise HTTPException(status_code=400, detail={"errors": warnings or ["No wells imported"]})

    computed_at = datetime.now(UTC).isoformat()
    return ImportCommitResult(
        trajectories=trajectories,
        computed_at=computed_at,
        warnings=warnings,
        imported_count=imported_count,
    )
