"""Parse Iskra (Искра) project export JSON for map import."""

from __future__ import annotations

import json
import re
from typing import Any

from app.geo.constants import LINE_SUBTYPES, POINT_SUBTYPES
from app.geo.geometry_utils import build_infra_geometry
from app.geo.spark_mapping import SPARK_SKIP_REASON, SPARK_TYPE_TO_SUBTYPE
from app.geo.validation import category_for_subtype, validate_subtype_geometry

_CRS_RE = re.compile(r"(?:crs:)?(\d+)", re.I)


def is_spark_project_export(data: Any) -> bool:
    return (
        isinstance(data, dict)
        and data.get("type") == "project"
        and isinstance(data.get("data"), dict)
        and isinstance(data["data"].get("objects"), list)
    )


def parse_epsg_from_projection(projection: dict | None) -> int:
    if not projection:
        return 32643
    name = str(projection.get("name") or "")
    m = _CRS_RE.search(name)
    if m:
        return int(m.group(1))
    desc = str(projection.get("description") or "")
    m = re.search(r"\+zone=(\d+)", desc)
    if m:
        zone = int(m.group(1))
        return 32600 + zone if zone < 60 else zone
    return 32643


def _get_transformer(src_epsg: int):
    try:
        from pyproj import Transformer
    except ImportError as e:
        raise ImportError(
            "pyproj is required for Iskra export import (EPSG reprojection); add pyproj to backend requirements"
        ) from e

    return Transformer.from_crs(f"EPSG:{src_epsg}", "EPSG:4326", always_xy=True)


def transform_xy(transformer, x: float, y: float) -> tuple[float, float]:
    lon, lat = transformer.transform(x, y)
    return float(lon), float(lat)


def _ring_points(coords: list) -> list[tuple[float, float]]:
    """Normalize Iskra/GeoJSON polygon ring to list of (x, y) in source CRS."""
    if not coords:
        return []
    first = coords[0]
    if isinstance(first, (int, float)):
        return []
    if isinstance(first[0], (int, float)):
        return [(float(p[0]), float(p[1])) for p in coords if len(p) >= 2]
    if first and isinstance(first[0], (int, float)):
        return [(float(p[0]), float(p[1])) for p in first if len(p) >= 2]
    return []


def _centroid_xy(points: list[tuple[float, float]]) -> tuple[float, float] | None:
    if not points:
        return None
    sx = sum(p[0] for p in points)
    sy = sum(p[1] for p in points)
    n = len(points)
    return sx / n, sy / n


def _parse_spark_object(
    obj: dict,
    *,
    transformer,
    index: int,
) -> tuple[dict | None, str | None]:
    spark_type = obj.get("type") or ""
    name = (obj.get("name") or f"Object {index}").strip()
    subtype = SPARK_TYPE_TO_SUBTYPE.get(spark_type)

    if subtype is None:
        if spark_type in SPARK_TYPE_TO_SUBTYPE:
            reason = SPARK_SKIP_REASON.get(spark_type, "not mapped for map MVP")
            return None, f"{name} ({spark_type}): skipped — {reason}"
        return None, f"{name}: неизвестный тип Искра {spark_type!r}"

    props = obj.get("properties") or {}
    geom = props.get("geometry") or {}
    gtype = geom.get("type", "")
    raw_coords = geom.get("coordinates")

    extra_props: dict[str, Any] = {
        "spark_id": obj.get("id"),
        "spark_type": spark_type,
        "spark_network": obj.get("network"),
    }
    if subtype in ("oil_pad", "gas_pad"):
        extra_props["spark_pad_type"] = spark_type

    try:
        if gtype == "LineString" and raw_coords and len(raw_coords) >= 2:
            utm_coords = [(float(c[0]), float(c[1])) for c in raw_coords if len(c) >= 2]
            if len(utm_coords) < 2:
                return None, f"{name}: invalid LineString coordinates"
            wgs = [list(transform_xy(transformer, x, y)) for x, y in utm_coords]
            validate_subtype_geometry(subtype, coordinate_count=len(wgs))
            lon, lat = wgs[0][0], wgs[0][1]
            end_lon, end_lat = wgs[-1][0], wgs[-1][1]
            return (
                {
                    "name": name,
                    "subtype": subtype,
                    "lon": lon,
                    "lat": lat,
                    "end_lon": end_lon,
                    "end_lat": end_lat,
                    "coordinates": wgs,
                    "geometry": build_infra_geometry(subtype, lon, lat, coordinates=wgs),
                    "category": category_for_subtype(subtype),
                    "properties": extra_props,
                },
                None,
            )

        if gtype == "Polygon" and raw_coords and subtype in POINT_SUBTYPES:
            ring = _ring_points(raw_coords)
            centroid = _centroid_xy(ring)
            if not centroid:
                return None, f"{name}: empty Polygon"
            lon, lat = transform_xy(transformer, centroid[0], centroid[1])
            validate_subtype_geometry(subtype, coordinate_count=1)
            extra_props["import_note"] = "polygon_centroid"
            return (
                {
                    "name": name,
                    "subtype": subtype,
                    "lon": lon,
                    "lat": lat,
                    "end_lon": None,
                    "end_lat": None,
                    "geometry": build_infra_geometry(subtype, lon, lat),
                    "category": category_for_subtype(subtype),
                    "properties": extra_props,
                },
                None,
            )

        x = props.get("x")
        y = props.get("y")
        if x is not None and y is not None and float(x) != 0.0 and float(y) != 0.0:
            lon, lat = transform_xy(transformer, float(x), float(y))
            if subtype in POINT_SUBTYPES:
                validate_subtype_geometry(subtype, coordinate_count=1)
                return (
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": None,
                        "end_lat": None,
                        "geometry": build_infra_geometry(subtype, lon, lat),
                        "category": category_for_subtype(subtype),
                        "properties": extra_props,
                    },
                    None,
                )
            if subtype in LINE_SUBTYPES:
                return None, f"{name}: line type {spark_type} without geometry"

        if gtype == "Polygon" and subtype in LINE_SUBTYPES:
            return None, f"{name}: Polygon not supported for line subtype {subtype}"

        return None, f"{name} ({spark_type}): no usable geometry"
    except ValueError as e:
        return None, f"{name}: {e}"


def parse_spark_project(content: str) -> tuple[list[dict], list[str]]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        return [], [str(e)]

    if not is_spark_project_export(data):
        return [], ["Не экспорт проекта Искра (ожидается type=project и data.objects)"]

    project_data = data["data"]
    src_epsg = parse_epsg_from_projection(project_data.get("projection"))
    try:
        transformer = _get_transformer(src_epsg)
    except Exception as e:
        return [], [f"CRS transform EPSG:{src_epsg} -> EPSG:4326 failed: {e}"]

    rows: list[dict] = []
    messages: list[str] = []
    for i, obj in enumerate(project_data.get("objects") or [], start=1):
        if not isinstance(obj, dict):
            messages.append(f"Object {i}: invalid entry")
            continue
        row, msg = _parse_spark_object(obj, transformer=transformer, index=i)
        if row:
            rows.append(row)
        elif msg:
            messages.append(msg)

    def _sort_key(row: dict) -> tuple[int, str]:
        is_line = 1 if row.get("end_lon") is not None else 0
        return (is_line, row.get("name", ""))

    rows.sort(key=_sort_key)
    return rows, messages
