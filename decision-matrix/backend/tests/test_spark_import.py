"""Tests for Iskra (Искра) project JSON import."""

import json

import pytest

pytest.importorskip("pyproj")

from app.services.spark_import import is_spark_project_export, parse_spark_project


MINIMAL_SPARK = {
    "version": 1,
    "type": "project",
    "data": {
        "projection": {"name": "crs:32643"},
        "objects": [
            {
                "id": 1,
                "name": "Node1",
                "type": "ProductionJoint",
                "properties": {"x": 476523.15, "y": 6784614.26},
            },
            {
                "id": 2,
                "name": "Pipe1",
                "type": "GasLine",
                "properties": {
                    "geometry": {
                        "type": "LineString",
                        "coordinates": [
                            [476523.0, 6784614.0],
                            [476600.0, 6784700.0],
                        ],
                    }
                },
            },
        ],
    },
}


def test_is_spark_project_export():
    assert is_spark_project_export(MINIMAL_SPARK)
    assert not is_spark_project_export({"type": "FeatureCollection", "features": []})


def test_parse_spark_project_minimal():
    rows, messages = parse_spark_project(json.dumps(MINIMAL_SPARK))
    assert len(rows) == 2
    assert messages == []
    assert rows[0]["subtype"] == "node"
    assert rows[1]["subtype"] == "gas_pipeline"
    assert -90 <= rows[0]["lat"] <= 90
    assert -180 <= rows[0]["lon"] <= 180
    assert rows[0]["lon"] < 500  # not raw UTM easting


def test_parse_spark_additional_and_offplot_types():
    spark = {
        "version": 1,
        "type": "project",
        "data": {
            "projection": {"name": "crs:32643"},
            "objects": [
                {
                    "id": 10,
                    "name": "доп_ЛО_1",
                    "type": "AdditionalLine",
                    "properties": {
                        "geometry": {
                            "type": "LineString",
                            "coordinates": [
                                [476523.0, 6784614.0],
                                [476600.0, 6784700.0],
                            ],
                        }
                    },
                },
                {
                    "id": 11,
                    "name": "доп_ПО_1",
                    "type": "AdditionalFacility",
                    "properties": {
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [476500.0, 6784600.0],
                                [476550.0, 6784600.0],
                                [476550.0, 6784650.0],
                                [476500.0, 6784650.0],
                            ],
                        }
                    },
                },
                {
                    "id": 12,
                    "name": "ВО_1",
                    "type": "Offplot",
                    "properties": {
                        "geometry": {
                            "type": "Polygon",
                            "coordinates": [
                                [476510.0, 6784610.0],
                                [476520.0, 6784610.0],
                                [476520.0, 6784620.0],
                                [476510.0, 6784620.0],
                            ],
                        }
                    },
                },
            ],
        },
    }
    rows, messages = parse_spark_project(json.dumps(spark))
    assert messages == []
    by_subtype = {r["subtype"]: r for r in rows}
    assert by_subtype["additional_line"]["name"] == "доп_ЛО_1"
    assert by_subtype["additional_line"]["end_lon"] is not None
    assert by_subtype["additional_facility"]["name"] == "доп_ПО_1"
    assert by_subtype["additional_facility"]["end_lon"] is None
    assert by_subtype["offplot"]["name"] == "ВО_1"
    assert by_subtype["offplot"]["end_lon"] is None
