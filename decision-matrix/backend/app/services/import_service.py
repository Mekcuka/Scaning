"""CSV, GeoJSON, KML import (FR-2.5.3–2.5.4). Barrel re-export (SOLID phase 9)."""

from app.services.file_import import (
    create_pending_import_log,
    detect_import_format,
    import_rows_to_layer,
    parse_csv_rows,
    parse_geojson,
    parse_import_content,
    parse_kml,
    process_import_log,
    run_file_import,
    run_shapefile_import,
    schedule_async_import,
    schedule_import_via_job,
    shapefile_zip_to_geojson_bytes,
)

# Backward compatibility for tests importing private parser names.
_parse_csv_rows = parse_csv_rows
_parse_geojson = parse_geojson
_parse_kml = parse_kml
_shapefile_zip_to_geojson_bytes = shapefile_zip_to_geojson_bytes

__all__ = [
    "create_pending_import_log",
    "detect_import_format",
    "import_rows_to_layer",
    "parse_csv_rows",
    "parse_geojson",
    "parse_import_content",
    "parse_kml",
    "process_import_log",
    "run_file_import",
    "run_shapefile_import",
    "schedule_async_import",
    "schedule_import_via_job",
    "shapefile_zip_to_geojson_bytes",
    "_parse_csv_rows",
    "_parse_geojson",
    "_parse_kml",
    "_shapefile_zip_to_geojson_bytes",
]
