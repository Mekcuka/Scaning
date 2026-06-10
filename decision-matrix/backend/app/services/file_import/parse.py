"""Import format detection and dispatch to parsers."""

from __future__ import annotations

import json

from app.services.file_import.csv_parser import parse_csv_rows
from app.services.file_import.geojson_parser import parse_geojson
from app.services.file_import.kml_parser import parse_kml
from app.services.spark_import import is_spark_project_export, parse_spark_project


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
        return parse_csv_rows(content)
    if format == "kml":
        return parse_kml(content)
    if format == "spark":
        return parse_spark_project(content)
    if format == "geojson":
        try:
            data = json.loads(content)
            if is_spark_project_export(data):
                return parse_spark_project(content)
        except json.JSONDecodeError:
            pass
        return parse_geojson(content)
    return parse_geojson(content)
