"""PyWellGeo service facade over the library API."""

from __future__ import annotations

from typing import Any

import numpy as np
import yaml

from well_trajectory.pywellgeo_schemas import (
    AzimDipConvertRequest,
    AzimDipConvertResponse,
    BranchStat,
    CoordinateTransformRequest,
    CoordinateTransformResponse,
    Dc1dBuildRequest,
    Dc1dBuildResponse,
    Dc1dWellTree,
    PlotSegment,
    PyWellGeoTreeNode,
    ThermalInitSoilRequest,
    ThermalInitSoilResponse,
    TreeAddBranchRequest,
    TreeAddBranchResponse,
    TreeCoarsenRequest,
    TreeCoarsenResponse,
    TreeComputeRequest,
    TreeComputeResponse,
    TreeExportYamlRequest,
    TreeExportYamlResponse,
    TreeFromSurveyRequest,
    TreeFromSurveyResponse,
    TreeFromYamlRequest,
    TreeFromYamlResponse,
    TreePlotDataRequest,
    TreePlotDataResponse,
    TreeSplitAtZRequest,
    TreeSplitAtZResponse,
    WaterPropertiesRequest,
    WaterPropertiesResponse,
)
from well_trajectory.schemas import SurveyGeometry, SurveyStation
from well_trajectory.pywellgeo_tree_io import (
    branch_stats,
    collect_lateral_xyz_map,
    collect_main_bore_xyz,
    collect_plot_segments,
    collect_temperature_profile,
    count_tree_nodes,
    last_node_ahd,
    tree_from_dict,
    tree_node_to_dict,
    walk_nodes,
)


class PyWellGeoNotAvailableError(RuntimeError):
    """Raised when pywellgeo is not installed."""


def _well_tree_class() -> Any:
    try:
        from pywellgeo.well_tree.well_tree_tno import WellTreeTNO
    except ImportError as exc:
        raise PyWellGeoNotAvailableError(
            "pywellgeo is not installed; pip install pywellgeo pythermonomics"
        ) from exc
    return WellTreeTNO


def tree_from_survey(request: TreeFromSurveyRequest) -> TreeFromSurveyResponse:
    stations = request.stations
    if len(stations) < 2:
        raise ValueError("At least two survey stations are required")
    WellTreeTNO = _well_tree_class()
    x = np.array([s.e for s in stations], dtype=np.float64)
    y = np.array([s.n for s in stations], dtype=np.float64)
    z = np.array([-s.tvd for s in stations], dtype=np.float64)
    tree = WellTreeTNO.from_xyz(x, y, z, radius=request.radius_m, sname=request.name)
    tree.init_ahd()
    return TreeFromSurveyResponse(tree=tree_node_to_dict(tree))


def _import_tree_from_well_trajectories(tw: dict[str, Any], well_key: str, radius: float) -> tuple[Any, list[str]]:
    WellTreeTNO = _well_tree_class()
    if well_key not in tw:
        raise ValueError(f"Well key '{well_key}' not found in well_trajectories")
    well_data = tw[well_key]
    main = well_data.get("main_wellbore") or well_data.get("main") or {}
    main_xyz = main.get("xyz")
    if main_xyz is None:
        raise ValueError("main_wellbore.xyz missing in YAML")
    main_arr = np.asarray(main_xyz, dtype=np.float64)
    if main_arr.ndim != 2 or main_arr.shape[1] != 3:
        raise ValueError("main_wellbore xyz must be N×3")
    tree = WellTreeTNO.from_xyz(
        main_arr[:, 0],
        main_arr[:, 1],
        -main_arr[:, 2],
        radius=radius,
        sname="main",
    )
    branch_keys: list[str] = []
    for branch_key, branch in well_data.items():
        if branch_key in ("main_wellbore", "main"):
            continue
        if not isinstance(branch, dict) or "xyz" not in branch:
            continue
        b_arr = np.asarray(branch["xyz"], dtype=np.float64)
        if b_arr.ndim != 2 or b_arr.shape[1] != 3:
            raise ValueError(f"Branch '{branch_key}' xyz must be N×3")
        tree.add_xyz(
            b_arr[:, 0],
            b_arr[:, 1],
            -b_arr[:, 2],
            sbranch=branch_key,
            color="orange",
            radius=radius,
        )
        branch_keys.append(branch_key)
    tree.init_ahd()
    return tree, branch_keys


def _extract_xyz_from_yaml(data: dict[str, Any], well_key: str | None) -> tuple[np.ndarray, np.ndarray, np.ndarray, str]:
    fmt = "UNKNOWN"

    if "k" in data and "H" in data and "L" in data:
        fmt = "DC1D"
        dc1d_resp = dc1d_build(Dc1dBuildRequest.model_validate(data))
        if not dc1d_resp.wells:
            raise ValueError("DC1D config produced no wells")
        well = dc1d_resp.wells[0]
        nodes = walk_nodes(tree_from_dict(well.tree))
        x = np.array([n.x[0] for n in nodes], dtype=np.float64)
        y = np.array([n.x[1] for n in nodes], dtype=np.float64)
        z = np.array([n.x[2] for n in nodes], dtype=np.float64)
        return x, y, z, fmt

    if "well_trajectories" in data:
        fmt = "XYZGENERIC"
        tw = data["well_trajectories"]
        key = well_key or next(iter(tw.keys()))
        if key not in tw:
            raise ValueError(f"Well key '{key}' not found in well_trajectories")
        main = tw[key].get("main_wellbore") or tw[key].get("main") or {}
        xyz = main.get("xyz")
        if xyz is None:
            raise ValueError("main_wellbore.xyz missing in YAML")
        arr = np.asarray(xyz, dtype=np.float64)
        if arr.ndim != 2 or arr.shape[1] != 3:
            raise ValueError("xyz must be N×3 array")
        x, y, z = arr[:, 0], arr[:, 1], -arr[:, 2]
        return x, y, z, fmt

    if "main_wellbore" in data:
        fmt = "DETAILEDTNO"
        xyz = data["main_wellbore"].get("xyz")
        if xyz is None:
            raise ValueError("main_wellbore.xyz missing")
        arr = np.asarray(xyz, dtype=np.float64)
        x, y, z = arr[:, 0], arr[:, 1], -arr[:, 2]
        return x, y, z, fmt

    raise ValueError("Unsupported YAML structure; expected well_trajectories, main_wellbore, or DC1D params")


def tree_from_yaml(request: TreeFromYamlRequest) -> TreeFromYamlResponse:
    try:
        data = yaml.safe_load(request.content)
    except yaml.YAMLError as exc:
        raise ValueError(f"YAML parse error: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError("YAML root must be a mapping")

    warnings: list[str] = []
    fmt_detected = request.format

    if request.format == "AUTO":
        if "k" in data:
            fmt_detected = "DC1D"
        elif "well_trajectories" in data:
            fmt_detected = "XYZGENERIC"
        elif "main_wellbore" in data:
            fmt_detected = "DETAILEDTNO"
        else:
            raise ValueError("Could not detect YAML format")

    if fmt_detected == "XYZGENERIC" and "well_trajectories" in data:
        tw = data["well_trajectories"]
        key = request.well_key or next(iter(tw.keys()))
        tree, branch_keys = _import_tree_from_well_trajectories(tw, key, request.radius_m)
        if branch_keys:
            warnings.append(f"Imported lateral branches: {', '.join(branch_keys)}")
        return TreeFromYamlResponse(
            tree=tree_node_to_dict(tree),
            format_detected=fmt_detected,
            warnings=warnings,
        )

    x, y, z, detected = _extract_xyz_from_yaml(data, request.well_key)
    if request.format == "AUTO":
        fmt_detected = detected

    WellTreeTNO = _well_tree_class()
    tree = WellTreeTNO.from_xyz(x, y, z, radius=request.radius_m)
    tree.init_ahd()
    return TreeFromYamlResponse(
        tree=tree_node_to_dict(tree),
        format_detected=fmt_detected,
        warnings=warnings,
    )


def tree_export_yaml(request: TreeExportYamlRequest) -> TreeExportYamlResponse:
    root = tree_from_dict(request.tree)
    main_xyz = collect_main_bore_xyz(root)
    laterals = collect_lateral_xyz_map(root)
    tvd_vals = [pt[2] for pt in main_xyz]
    tvd_max = float(max(tvd_vals)) if tvd_vals else 0.0

    if request.format == "DETAILEDTNO":
        payload: dict[str, Any] = {
            "main_wellbore": {"xyz": main_xyz},
            "well_name": request.well_name,
        }
        for name, xyz in laterals.items():
            payload[name] = {"xyz": xyz}
    else:
        well_payload: dict[str, Any] = {"main_wellbore": {"xyz": main_xyz}}
        for name, xyz in laterals.items():
            well_payload[name] = {"xyz": xyz}
        payload = {
            "well_trajectories": {request.well_name: well_payload},
            "reservoir": {
                "basic": {
                    "top_reservoir_depth_TVD": tvd_max,
                    "bottom_reservoir_depth_TVD": tvd_max,
                }
            },
        }

    content = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
    return TreeExportYamlResponse(content=content, format=request.format)


def tree_add_branch(request: TreeAddBranchRequest) -> TreeAddBranchResponse:
    tree = tree_from_dict(request.tree)
    xyz = np.asarray(request.xyz, dtype=np.float64)
    if xyz.ndim != 2 or xyz.shape[1] != 3:
        raise ValueError("xyz must be N×3 array")
    if len(xyz) < 2:
        raise ValueError("At least two xyz points required for a lateral")
    radius = request.radius_m if request.radius_m is not None else float(getattr(tree, "radius", 0.10795))
    tree.add_xyz(
        xyz[:, 0],
        xyz[:, 1],
        xyz[:, 2],
        sbranch=request.name,
        color=request.color,
        radius=radius,
    )
    tree.init_ahd()
    return TreeAddBranchResponse(tree=tree_node_to_dict(tree))


def tree_coarsen(request: TreeCoarsenRequest) -> TreeCoarsenResponse:
    tree = tree_from_dict(request.tree)
    before = count_tree_nodes(tree)
    tree.coarsen(segmentlength=request.segment_length_m, perforated=request.perforated)
    tree.init_ahd()
    after = count_tree_nodes(tree)
    return TreeCoarsenResponse(
        tree=tree_node_to_dict(tree),
        node_count_before=before,
        node_count_after=after,
    )


def tree_split_at_z(request: TreeSplitAtZRequest) -> TreeSplitAtZResponse:
    tree = tree_from_dict(request.tree)
    tree.splitz(request.z_m)
    tree.init_ahd()
    return TreeSplitAtZResponse(tree=tree_node_to_dict(tree))


def tree_compute(request: TreeComputeRequest) -> TreeComputeResponse:
    tree = tree_from_dict(request.tree)
    tree.init_ahd()
    profile: list[dict[str, float]] = []
    if request.tsurface_c is not None and request.tgrad_c_per_m is not None:
        tree.init_temperaturesoil(request.tsurface_c, request.tgrad_c_per_m)
        profile = collect_temperature_profile(tree)

    length_m = last_node_ahd(tree)
    depths = [-float(n.x[2]) for n in walk_nodes(tree)]
    tvd_max = max(depths) if depths else 0.0
    md_max = length_m

    stats = [BranchStat.model_validate(s) for s in branch_stats(tree)]
    return TreeComputeResponse(
        geometry=SurveyGeometry(length_m=length_m, md_max=md_max, tvd_max=tvd_max),
        branch_stats=stats,
        md_max=md_max,
        tvd_max=tvd_max,
        temperature_profile=profile,
    )


def tree_plot_data(request: TreePlotDataRequest) -> TreePlotDataResponse:
    tree = tree_from_dict(request.tree)
    segments = [PlotSegment.model_validate(s) for s in collect_plot_segments(tree)]
    return TreePlotDataResponse(segments=segments)


def azim_dip_convert(request: AzimDipConvertRequest) -> AzimDipConvertResponse:
    from pywellgeo.transformations.azim_dip import AzimDip

    if request.mode == "vector_to_azim_dip":
        if not request.vector or len(request.vector) != 3:
            raise ValueError("vector [x,y,z] required")
        ad = AzimDip.from_vector(np.asarray(request.vector, dtype=np.float64))
        return AzimDipConvertResponse(azim_deg=float(ad.azim), dip_deg=float(ad.dip))

    if request.mode == "azim_dip_to_vector":
        if request.azim_deg is None or request.dip_deg is None:
            raise ValueError("azim_deg and dip_deg required")
        ad = AzimDip(request.azim_deg, request.dip_deg)
        vec = ad.azimdip2Vector()
        return AzimDipConvertResponse(
            azim_deg=float(ad.azim),
            dip_deg=float(ad.dip),
            vector=[float(vec[0]), float(vec[1]), float(vec[2])],
        )

    if request.mode == "azim_dip_to_normal":
        if request.azim_deg is None or request.dip_deg is None:
            raise ValueError("azim_deg and dip_deg required")
        ad = AzimDip(request.azim_deg, request.dip_deg)
        normal = ad.azimdip2normal()
        return AzimDipConvertResponse(
            azim_deg=float(ad.azim),
            dip_deg=float(ad.dip),
            normal=[float(normal[0]), float(normal[1]), float(normal[2])],
        )

    raise ValueError(f"Unknown mode: {request.mode}")


def thermal_init_soil(request: ThermalInitSoilRequest) -> ThermalInitSoilResponse:
    tree = tree_from_dict(request.tree)
    tree.init_ahd()
    tree.init_temperaturesoil(request.tsurface_c, request.tgrad_c_per_m)
    profile = collect_temperature_profile(tree)
    return ThermalInitSoilResponse(tree=tree_node_to_dict(tree), profile=profile)


def water_properties(request: WaterPropertiesRequest) -> WaterPropertiesResponse:
    import pywellgeo.well_data.water_properties as wp

    salinity = request.salinity_ppm * 1e-6
    values: dict[str, float] = {}
    units: dict[str, str] = {}

    pressure = request.pressure_pa
    if pressure is None and request.depth_m is not None:
        pressure = float(wp.getWellPres(request.depth_m, request.temperature_c, salinity))

    for prop in request.properties:
        if prop == "viscosity":
            if pressure is not None:
                values["viscosity"] = float(wp.viscosityKestin(pressure, request.temperature_c, salinity))
            else:
                values["viscosity"] = float(wp.viscosity(request.temperature_c, salinity))
            units["viscosity"] = "Pa·s"
        elif prop == "density":
            if pressure is None:
                raise ValueError("pressure_pa or depth_m required for density")
            values["density"] = float(wp.density(pressure, request.temperature_c, salinity))
            units["density"] = "kg/m³"
        elif prop == "heatcapacity":
            values["heatcapacity"] = float(wp.heatcapacity(request.temperature_c, salinity))
            units["heatcapacity"] = "J/(kg·K)"
        elif prop == "well_pressure":
            if request.depth_m is None:
                raise ValueError("depth_m required for well_pressure")
            values["well_pressure"] = float(wp.getWellPres(request.depth_m, request.temperature_c, salinity))
            units["well_pressure"] = "Pa"

    return WaterPropertiesResponse(values=values, units=units)


def dc1d_build(request: Dc1dBuildRequest) -> Dc1dBuildResponse:
    from pywellgeo.well_data.dc1dwell import Dc1dwell

    use_tgrad = request.temp[1] == -1
    dc1d = Dc1dwell(
        int(request.k),
        int(request.H),
        int(request.L),
        [int(v) for v in request.tvd],
        list(request.temp),
        [int(v) for v in request.salinity],
        list(request.skin),
        [int(v) for v in request.ahd],
        list(request.rw),
        request.roughness,
        request.tgrad,
        request.tsurface,
        use_tgrad,
        useheatloss=request.useheatloss,
    )

    WellTreeTNO = _well_tree_class()
    kop = dc1d.getPseudoKop()
    stepout = dc1d.L * 0.5
    wells: list[Dc1dWellTree] = []

    for i, wname in enumerate(("PRD1", "INJ1")):
        tvdtopres = dc1d.tvd[i]
        sign = 1 if i == 0 else -1
        wxyz = [
            [0, 0, 0],
            [0, 0, kop],
            [stepout * sign, 0, tvdtopres],
            [stepout * sign, 0, tvdtopres + dc1d.H],
        ]
        xyz = np.asarray(wxyz, dtype=np.float64).transpose()
        tree = WellTreeTNO.from_xyz(xyz[0], xyz[1], -xyz[2], radius=dc1d.rw[i])
        tree.init_ahd()
        wells.append(Dc1dWellTree(name=wname, tree=tree_node_to_dict(tree)))

    return Dc1dBuildResponse(wells=wells, params=dc1d.get_params())


def coordinate_transform(request: CoordinateTransformRequest) -> CoordinateTransformResponse:
    from pywellgeo.transformations.azim_dip import AzimDip
    from pywellgeo.transformations.coordinate_transformation import CoordinateTransformation

    plane = AzimDip(request.plane_azim_deg, request.plane_dip_deg)
    origin = np.asarray(request.origin, dtype=np.float64)
    ct = CoordinateTransformation(plane, origin=origin, pitch=request.pitch_deg)

    out: list[list[float]] = []
    for pt in request.points:
        if len(pt) != 3:
            raise ValueError("Each point must have 3 coordinates")
        vec = np.asarray(pt, dtype=np.float64)
        if request.direction == "global_to_local":
            transformed = ct.transform2local(vec)
        else:
            transformed = ct.transform2global(vec)
        out.append([float(transformed[0]), float(transformed[1]), float(transformed[2])])

    return CoordinateTransformResponse(points=out)


def enrich_survey_geometry(stations: list[SurveyStation]) -> SurveyGeometry:
    """Backward-compatible geometry from survey stations."""
    if len(stations) < 2:
        md_max = stations[0].md if stations else 0.0
        tvd_max = stations[0].tvd if stations else 0.0
        return SurveyGeometry(length_m=0.0, md_max=md_max, tvd_max=tvd_max)

    WellTreeTNO = _well_tree_class()
    x = np.array([s.e for s in stations], dtype=np.float64)
    y = np.array([s.n for s in stations], dtype=np.float64)
    z = np.array([-s.tvd for s in stations], dtype=np.float64)
    tree = WellTreeTNO.from_xyz(x, y, z)
    tree.init_ahd()
    length_m = last_node_ahd(tree)
    md_max = max(s.md for s in stations)
    tvd_max = max(s.tvd for s in stations)
    return SurveyGeometry(length_m=length_m, md_max=md_max, tvd_max=tvd_max)
