"""GeoJSON import feature parser."""

from __future__ import annotations

import json

from app.geo.geometry_utils import build_infra_geometry
from app.geo.validation import category_for_subtype, validate_subtype_geometry


def coords_2d(coords: list) -> list[list[float]]:
    return [[float(c[0]), float(c[1])] for c in coords]


def parse_geojson(content: str) -> tuple[list[dict], list[str]]:
    from app.geo.render_3d_properties import feature_properties_for_import, z_from_geojson_coordinates

    errors: list[str] = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return [], [str(e)]

    features = []
    if data.get("type") == "FeatureCollection":
        features = data.get("features", [])
    elif data.get("type") == "Feature":
        features = [data]
    else:
        return [], ["GeoJSON must be FeatureCollection or Feature"]

    rows: list[dict] = []
    for i, feat in enumerate(features, start=1):
        props = feat.get("properties") or {}
        subtype = (props.get("type") or props.get("subtype") or "").strip().lower()
        name = (props.get("name") or f"Feature {i}").strip()
        geom = feat.get("geometry") or {}
        gtype = geom.get("type", "")
        coords = geom.get("coordinates")
        if not subtype:
            errors.append(f"Feature {i}: missing type/subtype in properties")
            continue
        try:
            if gtype == "Point" and coords:
                lon, lat = float(coords[0]), float(coords[1])
                validate_subtype_geometry(subtype, coordinate_count=1)
                wkt = build_infra_geometry(subtype, lon, lat)
                geom_z = z_from_geojson_coordinates(gtype, coords)
                rows.append(
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": None,
                        "end_lat": None,
                        "geometry": wkt,
                        "category": category_for_subtype(subtype),
                        "properties": feature_properties_for_import(props, geometry_z=geom_z),
                    }
                )
            elif gtype == "LineString" and coords and len(coords) >= 2:
                coords_2d_list = coords_2d(coords)
                validate_subtype_geometry(subtype, coordinate_count=len(coords_2d_list))
                lon, lat = float(coords_2d_list[0][0]), float(coords_2d_list[0][1])
                end_lon, end_lat = float(coords_2d_list[-1][0]), float(coords_2d_list[-1][1])
                wkt = build_infra_geometry(subtype, lon, lat, coordinates=coords_2d_list)
                geom_z = z_from_geojson_coordinates(gtype, coords)
                rows.append(
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": end_lon,
                        "end_lat": end_lat,
                        "coordinates": coords_2d_list,
                        "geometry": wkt,
                        "category": category_for_subtype(subtype),
                        "properties": feature_properties_for_import(props, geometry_z=geom_z),
                    }
                )
            else:
                errors.append(f"Feature {i}: unsupported geometry {gtype} for subtype {subtype}")
        except ValueError as e:
            errors.append(f"Feature {i}: {e}")
    return rows, errors
