"""KML placemark import parser."""

from __future__ import annotations

import xml.etree.ElementTree as ET

from app.geo.geometry_utils import build_infra_geometry
from app.geo.validation import category_for_subtype, validate_subtype_geometry


def parse_kml(content: str) -> tuple[list[dict], list[str]]:
    errors: list[str] = []
    rows: list[dict] = []
    try:
        root = ET.fromstring(content)
    except ET.ParseError as e:
        return [], [str(e)]
    ns = {"k": "http://www.opengis.net/kml/2.2"}
    placemarks = root.findall(".//k:Placemark", ns) or root.findall(".//{*}Placemark")
    for i, pm in enumerate(placemarks, start=1):
        name_el = pm.find("k:name", ns) or pm.find("{*}name")
        name = (name_el.text or f"Placemark {i}").strip() if name_el is not None else f"Placemark {i}"
        desc_el = pm.find("k:description", ns) or pm.find("{*}description")
        desc = (desc_el.text or "").strip() if desc_el is not None else ""
        subtype = "gas_processing"
        if desc and "type:" in desc.lower():
            subtype = desc.split("type:", 1)[-1].strip().split()[0].lower()
        point = pm.find(".//k:Point/k:coordinates", ns) or pm.find(".//{*}Point/{*}coordinates")
        if point is not None and point.text:
            parts = point.text.strip().split(",")
            if len(parts) >= 2:
                lon, lat = float(parts[0]), float(parts[1])
                try:
                    validate_subtype_geometry(subtype, coordinate_count=1)
                    rows.append(
                        {
                            "name": name,
                            "subtype": subtype,
                            "lon": lon,
                            "lat": lat,
                            "end_lon": None,
                            "end_lat": None,
                            "geometry": build_infra_geometry(subtype, lon, lat),
                            "category": category_for_subtype(subtype),
                        }
                    )
                except ValueError as e:
                    errors.append(f"Placemark {i}: {e}")
            continue
        line = pm.find(".//k:LineString/k:coordinates", ns) or pm.find(".//{*}LineString/{*}coordinates")
        if line is not None and line.text:
            coords_raw = [c.strip() for c in line.text.strip().split() if c.strip()]
            coords: list[list[float]] = []
            for chunk in coords_raw:
                p = chunk.split(",")
                if len(p) >= 2:
                    coords.append([float(p[0]), float(p[1])])
            if len(coords) >= 2:
                subtype = subtype if subtype != "gas_processing" else "autoroad"
                try:
                    validate_subtype_geometry(subtype, coordinate_count=len(coords))
                    lon, lat = coords[0][0], coords[0][1]
                    end_lon, end_lat = coords[-1][0], coords[-1][1]
                    rows.append(
                        {
                            "name": name,
                            "subtype": subtype,
                            "lon": lon,
                            "lat": lat,
                            "end_lon": end_lon,
                            "end_lat": end_lat,
                            "coordinates": coords,
                            "geometry": build_infra_geometry(subtype, lon, lat, coordinates=coords),
                            "category": category_for_subtype(subtype),
                        }
                    )
                except ValueError as e:
                    errors.append(f"Placemark {i}: {e}")
    return rows, errors
