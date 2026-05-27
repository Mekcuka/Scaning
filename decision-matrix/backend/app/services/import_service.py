"""CSV, GeoJSON, KML import (FR-2.5.3–2.5.4)."""

import asyncio
import csv
import io
import json
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session

from app.geo.geometry_utils import build_infra_geometry
from app.geo.validation import category_for_subtype, validate_subtype_geometry
from app.models import ImportLog, InfrastructureLayer, InfrastructureObject


def _parse_csv_rows(content: str) -> tuple[list[dict], list[str]]:
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
                    }
                )
            else:
                errors.append(f"Row {i}: missing coordinates for subtype {subtype}")
        except (ValueError, KeyError) as e:
            errors.append(f"Row {i}: {e}")
    return rows, errors


def _parse_geojson(content: str) -> tuple[list[dict], list[str]]:
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
                    }
                )
            elif gtype == "LineString" and coords and len(coords) >= 2:
                validate_subtype_geometry(subtype, coordinate_count=len(coords))
                lon, lat = float(coords[0][0]), float(coords[0][1])
                end_lon, end_lat = float(coords[-1][0]), float(coords[-1][1])
                wkt = build_infra_geometry(subtype, lon, lat, coordinates=coords)
                rows.append(
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": end_lon,
                        "end_lat": end_lat,
                        "geometry": wkt,
                        "category": category_for_subtype(subtype),
                    }
                )
            else:
                errors.append(f"Feature {i}: unsupported geometry {gtype} for subtype {subtype}")
        except ValueError as e:
            errors.append(f"Feature {i}: {e}")
    return rows, errors


async def import_rows_to_layer(
    db: AsyncSession,
    layer: InfrastructureLayer,
    rows: list[dict],
    *,
    build_network: bool = False,
) -> int:
    count = 0
    for row in rows:
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name=row["name"],
                subtype=row["subtype"],
                category=row["category"],
                geometry=row["geometry"],
                longitude=row["lon"],
                latitude=row["lat"],
                end_longitude=row.get("end_lon"),
                end_latitude=row.get("end_lat"),
                properties={},
            )
        )
        count += 1
    if build_network and count:
        from app.services.graph_builder import build_network_from_lines

        await build_network_from_lines(db, layer.project_id)
    return count


def _parse_kml(content: str) -> tuple[list[dict], list[str]]:
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
                            "geometry": build_infra_geometry(subtype, lon, lat, coordinates=coords),
                            "category": category_for_subtype(subtype),
                        }
                    )
                except ValueError as e:
                    errors.append(f"Placemark {i}: {e}")
    return rows, errors


def _shapefile_zip_to_geojson_bytes(data: bytes) -> tuple[str | None, str | None]:
    with tempfile.TemporaryDirectory() as tmp:
        zpath = Path(tmp) / "upload.zip"
        zpath.write_bytes(data)
        with zipfile.ZipFile(zpath) as zf:
            zf.extractall(tmp)
        shp = next(Path(tmp).rglob("*.shp"), None)
        if not shp:
            return None, "No .shp file in archive"
        out = Path(tmp) / "out.geojson"
        try:
            subprocess.run(
                ["ogr2ogr", "-f", "GeoJSON", str(out), str(shp)],
                check=True,
                capture_output=True,
                timeout=120,
            )
        except (FileNotFoundError, subprocess.CalledProcessError) as e:
            return None, f"ogr2ogr failed: {e}"
        if not out.exists():
            return None, "ogr2ogr produced no output"
        return out.read_text(encoding="utf-8"), None


def parse_import_content(content: str, format: str) -> tuple[list[dict], list[str]]:
    if format == "csv":
        return _parse_csv_rows(content)
    if format == "kml":
        return _parse_kml(content)
    return _parse_geojson(content)


async def run_file_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    source_type: str,
    file_name: str,
    content: str,
    format: str,
) -> ImportLog:
    rows, errors = parse_import_content(content, format)

    log = ImportLog(
        user_id=user_id,
        project_id=project_id,
        source_type=source_type,
        file_name=file_name,
        status="processing",
        records_total=len(rows) + len(errors),
        records_imported=0,
        errors=errors,
    )
    db.add(log)
    await db.flush()

    imported = 0
    if rows:
        imported = await import_rows_to_layer(db, layer, rows, build_network=True)
    log.records_imported = imported
    log.status = "completed" if not errors else ("completed" if imported else "failed")
    if errors and imported:
        log.status = "completed"
    await db.flush()
    return log


async def create_pending_import_log(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    source_type: str,
    file_name: str,
) -> ImportLog:
    log = ImportLog(
        user_id=user_id,
        project_id=project_id,
        source_type=source_type,
        file_name=file_name,
        status="pending",
        records_total=0,
        records_imported=0,
        errors=[],
    )
    db.add(log)
    await db.flush()
    return log


async def process_import_log(
    log_id: UUID,
    *,
    layer_id: UUID,
    content: str,
    format: str,
) -> None:
    async with async_session() as db:
        log = await db.get(ImportLog, log_id)
        if not log:
            return
        layer = await db.get(InfrastructureLayer, layer_id)
        if not layer:
            log.status = "failed"
            log.errors = ["Layer not found"]
            await db.commit()
            return
        log.status = "running"
        await db.commit()

        rows, errors = parse_import_content(content, format)

        log.records_total = len(rows) + len(errors)
        log.errors = errors
        imported = 0
        if rows:
            imported = await import_rows_to_layer(db, layer, rows, build_network=True)
        log.records_imported = imported
        log.status = "completed" if imported or not errors else "failed"
        if errors and imported:
            log.status = "completed"
        await db.commit()


def schedule_async_import(log_id: UUID, *, layer_id: UUID, content: str, format: str) -> None:
    asyncio.create_task(process_import_log(log_id, layer_id=layer_id, content=content, format=format))


async def run_shapefile_import(
    db: AsyncSession,
    *,
    user_id: UUID,
    project_id: UUID,
    layer: InfrastructureLayer,
    file_name: str,
    zip_bytes: bytes,
) -> ImportLog:
    geojson, err = _shapefile_zip_to_geojson_bytes(zip_bytes)
    log = ImportLog(
        user_id=user_id,
        project_id=project_id,
        source_type="shapefile_import",
        file_name=file_name,
        status="processing",
        records_total=0,
        records_imported=0,
        errors=[err] if err else [],
    )
    db.add(log)
    await db.flush()
    if err or not geojson:
        log.status = "failed"
        await db.flush()
        return log
    rows, errors = _parse_geojson(geojson)
    log.errors = errors
    log.records_total = len(rows) + len(errors)
    imported = await import_rows_to_layer(db, layer, rows) if rows else 0
    log.records_imported = imported
    log.status = "completed" if imported else "failed"
    await db.flush()
    return log
