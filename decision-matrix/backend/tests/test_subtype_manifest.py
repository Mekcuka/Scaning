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
    GKS_CLUSTER_SUBTYPES,
    GTES_CLUSTER_SUBTYPES,
    LEGACY_SUBTYPE_ALIASES,
    LINEAR_SUBTYPES,
    NODE_CLUSTER_SUBTYPES,
    PAD_CLUSTER_SUBTYPES,
    POINT_MAP_SUBTYPES,
    load_infrastructure_subtypes_manifest,
)

_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "shared" / "infrastructure_subtypes.json"


def test_manifest_file_exists_and_parses():
    assert _MANIFEST_PATH.is_file()
    data = load_infrastructure_subtypes_manifest()
    assert data["version"] == 2


def test_manifest_linear_all_matches_geo_line_subtypes():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert set(LINEAR_SUBTYPES) == set(raw["linear"]["all"])
    assert set(geo_constants.LINE_SUBTYPES) == set(raw["linear"]["all"])


def test_manifest_point_map_matches_geo_point_subtypes():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert POINT_MAP_SUBTYPES == tuple(raw["point"]["map"])
    assert set(geo_constants.POINT_SUBTYPES) == set(raw["point"]["map"])


def test_manifest_clusters_match_geo_constants():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert GKS_CLUSTER_SUBTYPES == frozenset(raw["clusters"]["gks"])
    assert NODE_CLUSTER_SUBTYPES == frozenset(raw["clusters"]["node"])
    assert PAD_CLUSTER_SUBTYPES == frozenset(raw["clusters"]["pad"])
    assert GTES_CLUSTER_SUBTYPES == frozenset(raw["clusters"]["gtes"])


def test_manifest_legacy_aliases_match_geo_constants():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert LEGACY_SUBTYPE_ALIASES == raw["legacy_aliases"]
    assert geo_constants.normalize_infra_subtype("pad") == "oil_pad"
    assert geo_constants.normalize_infra_subtype("delivery_acceptance_point") == "refinery"


def test_manifest_analysis_lists_match_cost_rates():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert ANALYSIS_LINEAR_SUBTYPES == tuple(raw["linear"]["analysis_internal"])
    assert EXTERNAL_LINEAR_SUBTYPES == tuple(raw["linear"]["analysis_external"])
    assert EXTERNAL_POINT_SUBTYPES == tuple(raw["point"]["analysis_external"])
    assert set(geo_constants.EXTERNAL_POINT_SUBTYPES) == set(raw["point"]["analysis_external"])


def test_analysis_external_linear_covers_internal():
    assert set(ANALYSIS_LINEAR_SUBTYPES).issubset(set(EXTERNAL_LINEAR_SUBTYPES))


def test_analysis_external_points_are_on_map():
    assert set(EXTERNAL_POINT_SUBTYPES).issubset(set(POINT_MAP_SUBTYPES))
