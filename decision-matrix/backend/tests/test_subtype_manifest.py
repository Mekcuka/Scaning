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
    BOTTOMHOLE_CLUSTER_SUBTYPES,
    EARTHWORK_SUBTYPES,
    EXCLUSIVE_POINT_SUBTYPES,
    FACILITY_POINT_SUBTYPES,
    GKS_CLUSTER_SUBTYPES,
    GTES_CLUSTER_SUBTYPES,
    IE_DERIVED_POINT_SUBTYPES,
    IMMUTABLE_POINT_SUBTYPES,
    IMPORT_ONLY_POINT_SUBTYPES,
    LEGACY_SUBTYPE_ALIASES,
    LINEAR_SUBTYPES,
    NODE_CLUSTER_SUBTYPES,
    NODE_DERIVED_POINT_SUBTYPES,
    PAD_CLUSTER_SUBTYPES,
    PAD_DERIVED_POINT_SUBTYPES,
    POINT_MAP_SUBTYPES,
    SPARK_EXCLUSIVE_POINT_SUBTYPES,
    SUBTYPE_CATEGORY,
    SUBTYPE_LABELS,
    load_infrastructure_subtypes_manifest,
)

_MANIFEST_PATH = Path(__file__).resolve().parents[2] / "shared" / "infrastructure_subtypes.json"


def test_manifest_path_resolves_in_monorepo_and_backend_shared():
    from app.subtype_manifest import _MANIFEST_PATH, _BACKEND_ROOT

    assert _MANIFEST_PATH.is_file()
    assert _MANIFEST_PATH.name == "infrastructure_subtypes.json"
    docker_layout = _BACKEND_ROOT / "shared" / "infrastructure_subtypes.json"
    monorepo_layout = _BACKEND_ROOT.parent / "shared" / "infrastructure_subtypes.json"
    assert _MANIFEST_PATH in {docker_layout, monorepo_layout}
    assert _MANIFEST_PATH.is_file()
    data = load_infrastructure_subtypes_manifest()
    assert data["version"] == 4


def test_manifest_linear_all_matches_geo_line_subtypes():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert set(LINEAR_SUBTYPES) == set(raw["linear"]["all"])
    assert set(geo_constants.LINE_SUBTYPES) == set(raw["linear"]["all"])


def test_manifest_point_map_matches_geo_point_subtypes():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    assert POINT_MAP_SUBTYPES == tuple(raw["point"]["map"])
    assert set(geo_constants.POINT_SUBTYPES) == set(raw["point"]["map"])


def test_earthwork_subtypes_exclude_node_and_bottomholes():
    assert EARTHWORK_SUBTYPES == frozenset(POINT_MAP_SUBTYPES) - frozenset({"node"}) - BOTTOMHOLE_CLUSTER_SUBTYPES
    assert "oil_pad" in EARTHWORK_SUBTYPES
    assert "substation" in EARTHWORK_SUBTYPES
    assert "sand_quarry" in EARTHWORK_SUBTYPES
    assert "node" not in EARTHWORK_SUBTYPES
    assert "well_bottomhole_nnb" not in EARTHWORK_SUBTYPES
    assert "well_bottomhole_gs_heel" not in EARTHWORK_SUBTYPES
    assert "well_bottomhole_gs_toe" not in EARTHWORK_SUBTYPES


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


def test_manifest_point_policies_match_geo_constants():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    policies = raw["point_policies"]
    assert IMMUTABLE_POINT_SUBTYPES == frozenset(policies["immutable"])
    assert EXCLUSIVE_POINT_SUBTYPES == frozenset(policies["exclusive"])
    assert FACILITY_POINT_SUBTYPES == frozenset(policies["facility"])
    assert IMPORT_ONLY_POINT_SUBTYPES == frozenset(policies["import_only"])
    assert IE_DERIVED_POINT_SUBTYPES == frozenset(policies["ie_derived"])
    assert NODE_DERIVED_POINT_SUBTYPES == frozenset(policies["node_derived"])
    assert PAD_DERIVED_POINT_SUBTYPES == frozenset(policies["pad_derived"])
    assert SPARK_EXCLUSIVE_POINT_SUBTYPES == frozenset(policies["spark_exclusive"])
    assert geo_constants.IMMUTABLE_POINT_SUBTYPES == IMMUTABLE_POINT_SUBTYPES
    assert geo_constants.IMPORT_ONLY_POINT_SUBTYPES == IMPORT_ONLY_POINT_SUBTYPES
    assert geo_constants.IE_DERIVED_POINT_SUBTYPES == IE_DERIVED_POINT_SUBTYPES


def test_manifest_labels_and_categories_cover_map_subtypes():
    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    map_subtypes = set(raw["linear"]["all"]) | set(raw["point"]["map"])
    labels = raw["labels"]
    categories = raw["categories"]
    assert map_subtypes <= set(labels.keys())
    assert map_subtypes <= set(categories.keys())
    assert SUBTYPE_LABELS == labels
    assert SUBTYPE_CATEGORY == categories
    assert geo_constants.SUBTYPE_LABELS == SUBTYPE_LABELS
    assert geo_constants.SUBTYPE_CATEGORY == SUBTYPE_CATEGORY


def test_well_bottomhole_subtypes_geometry_manifest():
    """Unified GS is linear (heel→toe); NNB and legacy heel/toe remain point map subtypes."""
    from app.geo.validation import validate_subtype_geometry

    raw = json.loads(_MANIFEST_PATH.read_text(encoding="utf-8"))
    bottomholes = set(raw["clusters"]["bottomhole"])
    point_map = set(raw["point"]["map"])
    linear_all = set(raw["linear"]["all"])

    point_bottomholes = bottomholes - {"well_bottomhole_gs"}
    assert point_bottomholes.issubset(point_map)
    assert "well_bottomhole_gs" in linear_all
    assert "well_bottomhole_gs" not in point_map

    for subtype in bottomholes:
        if subtype == "well_bottomhole_gs":
            validate_subtype_geometry(subtype, coordinate_count=2)
        else:
            validate_subtype_geometry(subtype)
