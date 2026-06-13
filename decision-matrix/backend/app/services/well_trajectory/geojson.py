"""GeoJSON builders for well trajectories (3D lines + plan projection + bottomhole points)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import _read_float, read_wells_local
from app.services.pad_earthwork.properties import (
    DEFAULT_PAD_HEIGHT_M,
    DEFAULT_PAD_REFERENCE_ELEVATION_M,
    PAD_HEIGHT_M,
    PAD_REFERENCE_ELEVATION_M,
    PAD_WELL_COUNT,
)
from app.services.well_trajectory.coord_transform import local_to_lonlat, lonlat_to_local
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_store import read_clearance_computed_at, read_trajectories_json


def _kb_m(props: dict[str, Any]) -> float:
    ref = _read_float(props, PAD_REFERENCE_ELEVATION_M)
    if ref is None:
        ref = DEFAULT_PAD_REFERENCE_ELEVATION_M
    height = _read_float(props, PAD_HEIGHT_M)
    if height is None:
        height = DEFAULT_PAD_HEIGHT_M
    return ref + height


def _station_lonlat(
    *,
    anchor_lon: float,
    anchor_lat: float,
    east_m: float,
    north_m: float,
    kb_m: float,
    tvd_m: float,
) -> tuple[float, float, float]:
    lon, lat = local_to_lonlat(anchor_lon, anchor_lat, east_m, north_m)
    # Absolute elevation: KB minus TVD (TVD measured downward from KB).
    z = kb_m - tvd_m
    return lon, lat, z


def _target_plan_coords(well: dict[str, Any]) -> tuple[float, float] | None:
    target = well.get("target")
    if not isinstance(target, dict):
        return None
    plan = target.get("plan")
    if isinstance(plan, dict):
        try:
            return float(plan["east_m"]), float(plan["north_m"])
        except (KeyError, TypeError, ValueError):
            pass
    try:
        lon = float(target["lon"])
        lat = float(target["lat"])
    except (KeyError, TypeError, ValueError):
        return None
    return None  # lon/lat stored; caller uses anchor conversion if plan missing


def build_pad_geojson(obj: InfrastructureObject) -> dict[str, Any]:
    props = obj.properties or {}
    trajectories = read_trajectories_json(props)
    anchor_lon = float(obj.longitude)
    anchor_lat = float(obj.latitude)
    kb = _kb_m(props)
    features: list[dict[str, Any]] = []

    for well in trajectories:
        if not isinstance(well, dict):
            continue
        well_index = well.get("well_index", 0)
        name = well.get("name") or f"Скв-{int(well_index) + 1}"
        survey = well.get("survey") or {}
        stations = survey.get("stations") or []
        if not isinstance(stations, list):
            stations = []

        plan_coords: list[list[float]] = []
        line_coords: list[list[float]] = []
        for st in stations:
            if not isinstance(st, dict):
                continue
            try:
                e = float(st.get("e", 0))
                n = float(st.get("n", 0))
                tvd = float(st.get("tvd", 0))
            except (TypeError, ValueError):
                continue
            lon, lat, z = _station_lonlat(
                anchor_lon=anchor_lon,
                anchor_lat=anchor_lat,
                east_m=e,
                north_m=n,
                kb_m=kb,
                tvd_m=tvd,
            )
            plan_coords.append([lon, lat])
            line_coords.append([lon, lat, z])

        if len(line_coords) >= 2:
            clearance = well.get("clearance") if isinstance(well.get("clearance"), dict) else {}
            min_sf = clearance.get("min_sf")
            traj_props: dict[str, Any] = {
                "kind": "trajectory",
                "well_index": well_index,
                "name": name,
                "infra_object_id": str(obj.id),
                "pad_name": obj.name,
            }
            if min_sf is not None:
                try:
                    traj_props["min_sf"] = float(min_sf)
                except (TypeError, ValueError):
                    pass
            settings = well_trajectory_settings_for_pad(obj)
            traj_props["sf_warning_threshold"] = settings.sf_warning_threshold
            features.append(
                {
                    "type": "Feature",
                    "properties": traj_props,
                    "geometry": {"type": "LineString", "coordinates": line_coords},
                }
            )
        if len(plan_coords) >= 2:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "kind": "trajectory_plan",
                        "well_index": well_index,
                        "name": name,
                        "infra_object_id": str(obj.id),
                        "pad_name": obj.name,
                    },
                    "geometry": {"type": "LineString", "coordinates": plan_coords},
                }
            )

        target = well.get("target")
        if isinstance(target, dict):
            tvd_m = float(target.get("tvd_m", 0))
            plan = target.get("plan") if isinstance(target.get("plan"), dict) else {}
            east_m = plan.get("east_m") if plan else target.get("east_m")
            north_m = plan.get("north_m") if plan else target.get("north_m")
            bh_lon = target.get("lon")
            bh_lat = target.get("lat")
            e_val: float | None = None
            n_val: float | None = None
            if east_m is not None and north_m is not None:
                e_val = float(east_m)
                n_val = float(north_m)
                bh_lon, bh_lat = local_to_lonlat(anchor_lon, anchor_lat, e_val, n_val)
            elif bh_lon is not None and bh_lat is not None:
                e_val, n_val = lonlat_to_local(anchor_lon, anchor_lat, float(bh_lon), float(bh_lat))
            if bh_lon is not None and bh_lat is not None:
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "kind": "bottomhole_target",
                            "well_index": well_index,
                            "name": name,
                            "infra_object_id": str(obj.id),
                            "pad_name": obj.name,
                            "tvd_m": tvd_m,
                            "source": target.get("source"),
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [float(bh_lon), float(bh_lat)],
                        },
                    }
                )
                _, _, z = _station_lonlat(
                    anchor_lon=anchor_lon,
                    anchor_lat=anchor_lat,
                    east_m=e_val or 0.0,
                    north_m=n_val or 0.0,
                    kb_m=kb,
                    tvd_m=tvd_m,
                )
                features.append(
                    {
                        "type": "Feature",
                        "properties": {
                            "kind": "bottomhole_target_3d",
                            "well_index": well_index,
                            "name": name,
                            "infra_object_id": str(obj.id),
                            "tvd_m": tvd_m,
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [float(bh_lon), float(bh_lat), z],
                        },
                    }
                )
                # Dashed plan line from wellhead to bottomhole before full trajectory design
                if len(stations) < 2 and e_val is not None and n_val is not None:
                    wh_lon, wh_lat = local_to_lonlat(anchor_lon, anchor_lat, 0.0, 0.0)
                    if well_index < len(read_wells_local(props)):
                        wloc = read_wells_local(props)[well_index]
                        wh_lon, wh_lat = local_to_lonlat(
                            anchor_lon, anchor_lat, wloc.east_m, wloc.north_m
                        )
                    features.append(
                        {
                            "type": "Feature",
                            "properties": {
                                "kind": "bottomhole_plan_line",
                                "well_index": well_index,
                                "name": name,
                                "infra_object_id": str(obj.id),
                                "dashed": True,
                            },
                            "geometry": {
                                "type": "LineString",
                                "coordinates": [
                                    [wh_lon, wh_lat],
                                    [float(bh_lon), float(bh_lat)],
                                ],
                            },
                        }
                    )

    return {"type": "FeatureCollection", "features": features}


def build_project_geojson(pads: list[InfrastructureObject]) -> dict[str, Any]:
    features: list[dict[str, Any]] = []
    for pad in pads:
        fc = build_pad_geojson(pad)
        features.extend(fc.get("features") or [])
    return {"type": "FeatureCollection", "features": features}


def collect_trajectory_warnings(obj: InfrastructureObject) -> list[str]:
    props = obj.properties or {}
    warnings: list[str] = []
    wells_local = read_wells_local(props)
    well_count_raw = props.get(PAD_WELL_COUNT)
    try:
        well_count = int(well_count_raw) if well_count_raw is not None else len(wells_local)
    except (TypeError, ValueError):
        well_count = len(wells_local)
    if wells_local and well_count != len(wells_local):
        warnings.append(
            f"pad_well_count ({well_count}) != len(pad_wells_local_json) ({len(wells_local)})"
        )
    trajectories = read_trajectories_json(props)
    missing_target = sum(
        1 for w in trajectories if not isinstance(w.get("target"), dict) or not w.get("target")
    )
    if trajectories and missing_target:
        warnings.append(f"{missing_target} of {len(trajectories)} wells have no bottomhole target")
    settings = well_trajectory_settings_for_pad(obj)
    threshold = settings.sf_warning_threshold
    designed = [
        w
        for w in trajectories
        if isinstance(w, dict)
        and isinstance(w.get("survey"), dict)
        and len((w.get("survey") or {}).get("stations") or []) >= 2
    ]
    if designed and not read_clearance_computed_at(props):
        warnings.append("Anti-collision (SF) not computed; run clearance after design")
    for well in trajectories:
        if not isinstance(well, dict):
            continue
        clearance = well.get("clearance")
        if not isinstance(clearance, dict):
            continue
        try:
            min_sf = float(clearance.get("min_sf"))
        except (TypeError, ValueError):
            continue
        if min_sf < threshold:
            idx = well.get("well_index", 0)
            name = well.get("name") or f"Скв-{int(idx) + 1}"
            warnings.append(f"{name}: min SF {min_sf:.2f} < {threshold}")
    return warnings
