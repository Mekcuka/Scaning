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

from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage
from app.geo.validation import category_for_subtype, validate_subtype_geometry
from app.models import ImportLog, InfrastructureLayer, InfrastructureObject
from app.services.line_endpoint_rules import LineEndpointRuleError, snap_line_endpoints_to_point_objects
from app.services.spark_import import is_spark_project_export, parse_spark_project


def _coords_2d(coords: list) -> list[list[float]]:
    return [[float(c[0]), float(c[1])] for c in coords]


def _csv_import_properties(row: dict) -> dict:
    from app.geo.render_3d_properties import (
        RENDER_3D_BASE_KEY,
        RENDER_3D_HEIGHT_KEY,
        RENDER_3D_VISIBLE_KEY,
    )

    props: dict = {}
    for key in (
        RENDER_3D_HEIGHT_KEY,
        RENDER_3D_BASE_KEY,
        RENDER_3D_VISIBLE_KEY,
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
                        "properties": _csv_import_properties(row),
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
                        "properties": _csv_import_properties(row),
                    }
                )
            else:
                errors.append(f"Row {i}: missing coordinates for subtype {subtype}")
        except (ValueError, KeyError) as e:
            errors.append(f"Row {i}: {e}")
    return rows, errors


def _parse_geojson(content: str) -> tuple[list[dict], list[str]]:
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
                coords_2d = _coords_2d(coords)
                validate_subtype_geometry(subtype, coordinate_count=len(coords_2d))
                lon, lat = float(coords_2d[0][0]), float(coords_2d[0][1])
                end_lon, end_lat = float(coords_2d[-1][0]), float(coords_2d[-1][1])
                wkt = build_infra_geometry(subtype, lon, lat, coordinates=coords_2d)
                geom_z = z_from_geojson_coordinates(gtype, coords)
                rows.append(
                    {
                        "name": name,
                        "subtype": subtype,
                        "lon": lon,
                        "lat": lat,
                        "end_lon": end_lon,
                        "end_lat": end_lat,
                        "coordinates": coords_2d,
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


async def import_rows_to_layer(
    db: AsyncSession,
    layer: InfrastructureLayer,
    rows: list[dict],
    *,
    build_network: bool = False,
    skip_line_endpoint_validation: bool = False,
) -> tuple[int, list[str]]:
    count = 0
    errors: list[str] = []
    for idx, row in enumerate(rows, start=1):
        if (
            not skip_line_endpoint_validation
            and row.get("end_lon") is not None
            and row.get("end_lat") is not None
        ):
            try:
                subtype = str(row["subtype"])
                lon, lat, end_lon, end_lat, line_coords = await snap_line_endpoints_to_point_objects(
                    db,
                    project_id=layer.project_id,
                    line_subtype=subtype,
                    lon=float(row["lon"]),
                    lat=float(row["lat"]),
                    end_lon=float(row["end_lon"]),
                    end_lat=float(row["end_lat"]),
                    coordinates=row.get("coordinates"),
                )
                row["lon"] = lon
                row["lat"] = lat
                row["end_lon"] = end_lon
                row["end_lat"] = end_lat
                if line_coords:
                    row["coordinates"] = line_coords
                row["geometry"] = build_infra_geometry(
                    subtype,
                    lon,
                    lat,
                    end_lon=end_lon,
                    end_lat=end_lat,
                    coordinates=line_coords,
                )
            except LineEndpointRuleError as e:
                errors.append(f"Row {idx} ({row['name']}): {e}")
                continue
        from app.geo.entry_date import apply_default_entry_date
        from app.geo.render_3d_properties import apply_default_render_3d, merge_geojson_render_3d
        from app.geo.sand_properties import apply_default_sand_volumes

        raw_props = merge_geojson_render_3d(dict(row.get("properties") or {}))
        props: dict = apply_default_entry_date(
            str(row["subtype"]),
            apply_default_render_3d(
                str(row["subtype"]),
                apply_default_sand_volumes(str(row["subtype"]), raw_props),
            ),
        )
        line_coords = line_coordinates_for_storage(
            lon=float(row["lon"]),
            lat=float(row["lat"]),
            end_lon=row.get("end_lon"),
            end_lat=row.get("end_lat"),
            coordinates=row.get("coordinates"),
        )
        if line_coords:
            props["coordinates"] = line_coords
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
                properties=props,
            )
        )
        count += 1
    if build_network and count:
        from app.services.graph_builder import build_network_from_lines

        await build_network_from_lines(db, layer.project_id)
    return count, errors


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
                            "coordinates": coords,
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


def detect_import_format(content: str, filename: str = "") -> str:
    """Choose parser: csv, kml, spark, or geojson."""
    lower = filename.lower()
    if lower.endswith(".csv"):
        return "csv"
    if lower.endswith((".kml", ".kmz")):
        return "kml"
    try:
        data = json.loads(content)
        if is_spark_project_export(data):
            return "spark"
    except json.JSONDecodeError:
        pass
    return "geojson"


def parse_import_content(content: str, format: str) -> tuple[list[dict], list[str]]:
    if format == "csv":
        return _parse_csv_rows(content)
    if format == "kml":
        return _parse_kml(content)
    if format == "spark":
        return parse_spark_project(content)
    if format == "geojson":
        try:
            data = json.loads(content)
            if is_spark_project_export(data):
                return parse_spark_project(content)
        except json.JSONDecodeError:
            pass
        return _parse_geojson(content)
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
    import_errors: list[str] = []
    if rows:
        imported, import_errors = await import_rows_to_layer(
            db,
            layer,
            rows,
            build_network=True,
            skip_line_endpoint_validation=(format == "spark"),
        )
    if import_errors:
        log.errors = [*errors, *import_errors]
    log.records_imported = imported
    log.status = "completed" if not log.errors else ("completed" if imported else "failed")
    if log.errors and imported:
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
        import_errors: list[str] = []
        if rows:
            imported, import_errors = await import_rows_to_layer(
                db,
                layer,
                rows,
                build_network=True,
                skip_line_endpoint_validation=(format == "spark"),
            )
        if import_errors:
            log.errors = [*errors, *import_errors]
        log.records_imported = imported
        log.status = "completed" if imported or not log.errors else "failed"
        if log.errors and imported:
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
    imported = 0
    import_errors: list[str] = []
    if rows:
        imported, import_errors = await import_rows_to_layer(db, layer, rows)
    if import_errors:
        log.errors = [*errors, *import_errors]
    log.records_imported = imported
    log.status = "completed" if imported else "failed"
    await db.flush()
    return log
