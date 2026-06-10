"""Smoke tests for services.file_import package (SOLID phase 9)."""

from __future__ import annotations

import importlib


def test_file_import_modules_import():
    modules = [
        "app.services.file_import.csv_parser",
        "app.services.file_import.geojson_parser",
        "app.services.file_import.kml_parser",
        "app.services.file_import.shapefile",
        "app.services.file_import.persist",
        "app.services.file_import.parse",
        "app.services.file_import.run",
        "app.services.import_service",
    ]
    for name in modules:
        assert importlib.import_module(name) is not None


def test_import_service_barrel_reexports():
    from app.services import import_service

    assert import_service.run_file_import is not None
    assert import_service._parse_csv_rows is import_service.parse_csv_rows
    assert import_service._parse_geojson is import_service.parse_geojson
