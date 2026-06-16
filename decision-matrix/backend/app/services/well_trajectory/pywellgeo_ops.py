"""Business logic for PyWellGeo BFF."""

from __future__ import annotations

from typing import Any

from app.services.well_trajectory.pywellgeo_schemas import (
    PyWellGeoApplyGeometryResponse,
    PyWellGeoComputeResponse,
    PyWellGeoLastResponse,
    PyWellGeoPlotDataResponse,
    PyWellGeoSettings,
    PyWellGeoSyncFromSurveyResponse,
    PyWellGeoTreeRecord,
    PyWellGeoTreesPutRequest,
    PyWellGeoYamlExportResponse,
)
from app.services.well_trajectory.pywellgeo_store import (
    read_computed_at,
    read_settings_json,
    read_trees_json,
    store_computed_at,
    store_settings_json,
    store_trees_json,
    trees_json_for_api,
)
from app.services.well_trajectory.trajectory_store import read_trajectories_json
from app.services.well_trajectory.planner_bridge import run_pywellgeo


def build_last_response(props: dict[str, Any] | None) -> PyWellGeoLastResponse:
    settings_raw = read_settings_json(props)
    settings = PyWellGeoSettings.model_validate(settings_raw)
    return PyWellGeoLastResponse(
        settings=settings,
        trees=trees_json_for_api(props),
        computed_at=read_computed_at(props),
        warnings=[],
    )


def merge_trees_put(
    props: dict[str, Any] | None,
    body: PyWellGeoTreesPutRequest,
) -> dict[str, Any]:
    out = dict(props or {})
    if body.settings is not None:
        out = store_settings_json(out, body.settings.model_dump(mode="json"))
    trees_payload = [t.model_dump(mode="json") for t in body.trees]
    out = store_trees_json(out, trees_payload)
    return out


def sync_from_survey(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    radius_m: float | None,
) -> PyWellGeoSyncFromSurveyResponse:
    trajectories = read_trajectories_json(props)
    if well_index >= len(trajectories):
        raise ValueError(f"well_index {well_index} out of range (have {len(trajectories)} wells)")
    traj = trajectories[well_index]
    survey = traj.get("survey") or {}
    stations = survey.get("stations") or []
    if len(stations) < 2:
        raise ValueError("Survey must have at least two stations; run design first")

    normalized = []
    for s in stations:
        normalized.append(
            {
                "md": float(s.get("md", 0)),
                "inc": float(s.get("inc", 0)),
                "azi": float(s.get("azi", 0)),
                "tvd": float(s.get("tvd", 0)),
                "n": float(s.get("n", 0)),
                "e": float(s.get("e", 0)),
            }
        )

    settings = read_settings_json(props)
    radius = radius_m if radius_m is not None else float(settings.get("default_radius_m", 0.10795))

    result = run_pywellgeo(
        "tree_from_survey",
        {
            "stations": normalized,
            "radius_m": radius,
            "name": traj.get("name") or f"Скв-{well_index + 1}",
        },
    )
    record = PyWellGeoTreeRecord(
        well_index=well_index,
        name=traj.get("name"),
        tree=result["tree"],
        source="welleng_survey",
    )
    return PyWellGeoSyncFromSurveyResponse(tree=record, warnings=[])


def _find_tree(trees: list[dict[str, Any]], well_index: int) -> dict[str, Any]:
    for item in trees:
        if int(item.get("well_index", -1)) == well_index:
            return item
    raise ValueError(f"No PyWellGeo tree for well_index {well_index}")


def _resolve_tree_record(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    tree_override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if tree_override is not None:
        trajectories = read_trajectories_json(props)
        name = trajectories[well_index].get("name") if well_index < len(trajectories) else None
        return {"well_index": well_index, "name": name, "tree": tree_override}
    return _find_tree(read_trees_json(props), well_index)


def compute_tree(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    tsurface_c: float | None,
    tgrad_c_per_m: float | None,
    tree_override: dict[str, Any] | None = None,
) -> PyWellGeoComputeResponse:
    record = _resolve_tree_record(props, well_index=well_index, tree_override=tree_override)
    settings = read_settings_json(props)
    ts = tsurface_c if tsurface_c is not None else float(settings.get("tsurface_c", 10.0))
    tg = tgrad_c_per_m if tgrad_c_per_m is not None else float(settings.get("tgrad_c_per_m", 0.031))

    result = run_pywellgeo(
        "tree_compute",
        {"tree": record["tree"], "tsurface_c": ts, "tgrad_c_per_m": tg},
    )
    updated = dict(record)
    updated["geometry"] = result["geometry"]
    updated["branch_stats"] = result.get("branch_stats") or []
    if result.get("temperature_profile"):
        thermal = run_pywellgeo(
            "thermal_init_soil",
            {"tree": record["tree"], "tsurface_c": ts, "tgrad_c_per_m": tg},
        )
        updated["tree"] = thermal["tree"]

    return PyWellGeoComputeResponse(
        tree=PyWellGeoTreeRecord.model_validate(updated),
        temperature_profile=result.get("temperature_profile") or [],
    )


def plot_data_for_well(
    props: dict[str, Any] | None,
    well_index: int,
    *,
    tree_override: dict[str, Any] | None = None,
) -> PyWellGeoPlotDataResponse:
    record = _resolve_tree_record(props, well_index=well_index, tree_override=tree_override)
    result = run_pywellgeo("tree_plot_data", {"tree": record["tree"]})
    return PyWellGeoPlotDataResponse(segments=result["segments"])


def apply_geometry_to_trajectory(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    tree_override: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], PyWellGeoApplyGeometryResponse]:
    trajectories = read_trajectories_json(props)
    if well_index >= len(trajectories):
        raise ValueError(f"well_index {well_index} out of range")
    record = _resolve_tree_record(props, well_index=well_index, tree_override=tree_override)

    settings = read_settings_json(props)
    result = run_pywellgeo(
        "tree_compute",
        {
            "tree": record["tree"],
            "tsurface_c": settings.get("tsurface_c"),
            "tgrad_c_per_m": settings.get("tgrad_c_per_m"),
        },
    )
    geometry = result["geometry"]
    traj = dict(trajectories[well_index])
    pywellgeo_block = {
        "geometry": geometry,
        "branch_stats": result.get("branch_stats") or [],
    }
    traj["pywellgeo"] = pywellgeo_block
    traj["geometry"] = {**(traj.get("geometry") or {}), **geometry}
    trajectories[well_index] = traj

    out_props = dict(props or {})
    from app.services.well_trajectory.trajectory_store import store_trajectories_json

    out_props = store_trajectories_json(out_props, trajectories)
    out_props = store_computed_at(out_props)

    if tree_override is not None:
        trees = read_trees_json(out_props)
        updated_record = dict(record)
        updated_record["geometry"] = geometry
        updated_record["branch_stats"] = result.get("branch_stats") or []
        next_trees = [t for t in trees if int(t.get("well_index", -1)) != well_index]
        next_trees.append(updated_record)
        next_trees.sort(key=lambda t: int(t.get("well_index", 0)))
        out_props = store_trees_json(out_props, next_trees)

    return out_props, PyWellGeoApplyGeometryResponse(well_index=well_index, geometry=geometry)


def import_yaml_to_tree(
    props: dict[str, Any] | None,
    *,
    content: str,
    format: str,
    well_index: int,
    well_key: str | None,
    radius_m: float | None,
) -> PyWellGeoTreeRecord:
    settings = read_settings_json(props)
    radius = radius_m if radius_m is not None else float(settings.get("default_radius_m", 0.10795))
    result = run_pywellgeo(
        "tree_from_yaml",
        {
            "content": content,
            "format": format,
            "well_key": well_key,
            "radius_m": radius,
        },
    )
    trajectories = read_trajectories_json(props)
    name = None
    if well_index < len(trajectories):
        name = trajectories[well_index].get("name")
    return PyWellGeoTreeRecord(
        well_index=well_index,
        name=name,
        tree=result["tree"],
        source=f"yaml:{result.get('format_detected', format)}",
    )


def export_yaml_from_tree(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    format: str,
    well_name: str,
    tree_override: dict[str, Any] | None = None,
) -> PyWellGeoYamlExportResponse:
    record = _resolve_tree_record(props, well_index=well_index, tree_override=tree_override)
    result = run_pywellgeo(
        "tree_export_yaml",
        {"tree": record["tree"], "format": format, "well_name": well_name},
    )
    return PyWellGeoYamlExportResponse(content=result["content"], format=result["format"])


def add_branch_to_tree(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    tree: dict[str, Any],
    xyz: list[list[float]],
    name: str,
    color: str,
    radius_m: float | None,
) -> dict[str, Any]:
    settings = read_settings_json(props)
    radius = radius_m if radius_m is not None else float(settings.get("default_radius_m", 0.10795))
    result = run_pywellgeo(
        "tree_add_branch",
        {
            "tree": tree,
            "xyz": xyz,
            "name": name,
            "color": color,
            "radius_m": radius,
        },
    )
    trajectories = read_trajectories_json(props)
    record_name = trajectories[well_index].get("name") if well_index < len(trajectories) else None
    return {
        "well_index": well_index,
        "name": record_name,
        "tree": result["tree"],
        "source": "lateral",
    }


def coarsen_tree(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    tree: dict[str, Any],
    segment_length_m: float | None,
) -> tuple[PyWellGeoTreeRecord, int, int]:
    settings = read_settings_json(props)
    seg = segment_length_m if segment_length_m is not None else float(settings.get("coarsen_segment_length_m", 75.0))
    result = run_pywellgeo(
        "tree_coarsen",
        {"tree": tree, "segment_length_m": seg},
    )
    trajectories = read_trajectories_json(props)
    record_name = trajectories[well_index].get("name") if well_index < len(trajectories) else None
    record = PyWellGeoTreeRecord(
        well_index=well_index,
        name=record_name,
        tree=result["tree"],
        source="coarsened",
    )
    return record, int(result["node_count_before"]), int(result["node_count_after"])


def split_tree_at_z(
    props: dict[str, Any] | None,
    *,
    well_index: int,
    tree: dict[str, Any],
    z_m: float,
) -> PyWellGeoTreeRecord:
    result = run_pywellgeo("tree_split_at_z", {"tree": tree, "z_m": z_m})
    trajectories = read_trajectories_json(props)
    record_name = trajectories[well_index].get("name") if well_index < len(trajectories) else None
    return PyWellGeoTreeRecord(
        well_index=well_index,
        name=record_name,
        tree=result["tree"],
        source="split",
    )
