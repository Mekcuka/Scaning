"""Build GeoJSON preview layer for pad placement variants."""

from __future__ import annotations

from app.services.pad_placement.schemas import PadCandidateOut, PadPlacementGeoJsonResponse, PlacementVariantOut
from app.services.well_trajectory.coord_transform import local_to_lonlat


def build_variant_geojson(variant: PlacementVariantOut) -> PadPlacementGeoJsonResponse:
    features: list[dict] = []
    for pad in variant.pads:
        features.extend(_pad_features(pad))
    return PadPlacementGeoJsonResponse(features=features)


def _pad_features(pad: PadCandidateOut) -> list[dict]:
    out: list[dict] = []
    clon, clat = pad.center_longitude, pad.center_latitude

    if pad.sketch and pad.sketch.get("kind") == "plan_rectangle":
        ring = _rectangle_ring(clon, clat, pad)
        if ring:
            out.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "Polygon", "coordinates": [ring]},
                    "properties": {
                        "kind": "pad_footprint_preview",
                        "candidate_id": pad.candidate_id,
                    },
                }
            )

    for i, wh in enumerate(pad.wells_local):
        wh_lon, wh_lat = local_to_lonlat(clon, clat, wh["east_m"], wh["north_m"])
        out.append(
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [wh_lon, wh_lat]},
                "properties": {
                    "kind": "wellhead_preview",
                    "candidate_id": pad.candidate_id,
                    "well_index": i,
                },
            }
        )

    for well in pad.trajectories:
        coords = _trajectory_plan_coords(clon, clat, well)
        if len(coords) >= 2:
            out.append(
                {
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": {
                        "kind": "trajectory_plan_preview",
                        "candidate_id": pad.candidate_id,
                        "well_index": well.get("well_index"),
                    },
                }
            )
        target = well.get("target") if isinstance(well, dict) else None
        if isinstance(target, dict):
            lon = target.get("lon")
            lat = target.get("lat")
            if lon is not None and lat is not None:
                out.append(
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [lon, lat]},
                        "properties": {
                            "kind": "bottomhole_td_preview",
                            "candidate_id": pad.candidate_id,
                            "well_index": well.get("well_index"),
                        },
                    }
                )
    return out


def _rectangle_ring(clon: float, clat: float, pad: PadCandidateOut) -> list[list[float]]:
    length_m = pad.length_m or 120.0
    width_m = pad.width_m or 80.0
    half_l = length_m / 2.0
    half_w = width_m / 2.0
    corners = [
        (-half_w, -half_l),
        (half_w, -half_l),
        (half_w, half_l),
        (-half_w, half_l),
        (-half_w, -half_l),
    ]
    return [list(local_to_lonlat(clon, clat, e, n)) for e, n in corners]


def _trajectory_plan_coords(clon: float, clat: float, well: dict) -> list[list[float]]:
    survey = well.get("survey") or {}
    stations = survey.get("stations") or []
    coords: list[list[float]] = []
    for st in stations:
        if not isinstance(st, dict):
            continue
        e = st.get("e")
        n = st.get("n")
        if e is None or n is None:
            continue
        lon, lat = local_to_lonlat(clon, clat, float(e), float(n))
        coords.append([lon, lat])
    return coords
