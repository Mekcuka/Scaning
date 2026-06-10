"""CSV import row parser."""

from __future__ import annotations

import csv
import io

from app.geo.geometry_utils import build_infra_geometry
from app.geo.validation import category_for_subtype, validate_subtype_geometry


def csv_import_properties(row: dict) -> dict:
    from app.geo.render_3d_properties import (
        RENDER_3D_BASE_KEY,
        RENDER_3D_HEIGHT_KEY,
        RENDER_3D_SCALE_KEY,
        RENDER_3D_VISIBLE_KEY,
    )

    props: dict = {}
    for key in (
        RENDER_3D_HEIGHT_KEY,
        RENDER_3D_BASE_KEY,
        RENDER_3D_VISIBLE_KEY,
        RENDER_3D_SCALE_KEY,
        "height_m",
        "elevation_m",
    ):
        if key not in row:
            continue
        raw = row[key]
        if raw is None or str(raw).strip() == "":
            continue
        if key == RENDER_3D_VISIBLE_KEY:
            props[key] = str(raw).strip().lower() not in ("false", "0", "no")
        else:
            props[key] = raw
    return props


def parse_csv_rows(content: str) -> tuple[list[dict], list[str]]:
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames:
        return [], ["CSV has no header row"]
    rows: list[dict] = []
    errors: list[str] = []
    for i, row in enumerate(reader, start=2):
        subtype = (row.get("type") or row.get("subtype") or "").strip().lower()
        name = (row.get("name") or f"Object {i}").strip()
        if not subtype:
            errors.append(f"Row {i}: missing type/subtype")
            continue
        try:
            if row.get("start_lat") and row.get("start_lon"):
                validate_subtype_geometry(subtype, has_line_endpoints=True)
                lon = float(row["start_lon"])
                lat = float(row["start_lat"])
                end_lon = float(row["end_lon"])
                end_lat = float(row["end_lat"])
                geom = build_infra_geometry(subtype, lon, lat, end_lon=end_lon, end_lat=end_lat)
                rows.append(
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": end_lon,
                        "end_lat": end_lat,
                        "geometry": geom,
                        "category": category_for_subtype(subtype),
                        "properties": csv_import_properties(row),
                    }
                )
            elif row.get("lat") and row.get("lon"):
                validate_subtype_geometry(subtype, coordinate_count=1)
                lon = float(row["lon"])
                lat = float(row["lat"])
                geom = build_infra_geometry(subtype, lon, lat)
                rows.append(
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": None,
                        "end_lat": None,
                        "geometry": geom,
                        "category": category_for_subtype(subtype),
                        "properties": csv_import_properties(row),
                    }
                )
            else:
                errors.append(f"Row {i}: missing coordinates for subtype {subtype}")
        except (ValueError, KeyError) as e:
            errors.append(f"Row {i}: {e}")
    return rows, errors
