"""Tests for shared infrastructure_subtypes.json manifest."""

import json
from pathlib import Path

from app.geo import constants as geo_constants
from app.services.cost_rates import (
    ANALYSIS_LINEAR_SUBTYPES,
    EXTERNAL_LINEAR_SUBTYPES,
    EXTERNAL_POINT_SUBTYPES,
)
from app.subtype_manifest import (
    LINEAR_SUBTYPES,
    load_infrastructure_subtypes_manifest,
)

_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "shared" / "infrastructure_subtypes.json"


def test_manifest_file_exists_and_parses():
    assert _MANIFEST_PATH.is_file()
    data = load_infrastructure_subtypes_manifest()
    assert data["version"] == 1


def test_manifest_linear_all_matches_geo_line_subtypes():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert set(LINEAR_SUBTYPES) == set(raw["linear"]["all"])
    assert set(geo_constants.LINE_SUBTYPES) == set(raw["linear"]["all"])


def test_manifest_analysis_lists_match_cost_rates():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert ANALYSIS_LINEAR_SUBTYPES == tuple(raw["linear"]["analysis_internal"])
    assert EXTERNAL_LINEAR_SUBTYPES == tuple(raw["linear"]["analysis_external"])
    assert EXTERNAL_POINT_SUBTYPES == tuple(raw["point"]["analysis_external"])
    assert set(geo_constants.EXTERNAL_POINT_SUBTYPES) == set(raw["point"]["analysis_external"])


def test_analysis_external_linear_covers_internal():
    assert set(ANALYSIS_LINEAR_SUBTYPES).issubset(set(EXTERNAL_LINEAR_SUBTYPES))
