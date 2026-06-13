"""Load shared infrastructure_subtypes.json — single source for map and analysis subtype lists."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_BACKEND_ROOT = Path(__file__).resolve().parents[1]


def _resolve_manifest_path() -> Path:
    """Monorepo canonical path first, then Docker layout (backend/shared at /app/shared)."""
    for candidate in (
        _BACKEND_ROOT.parent / "shared" / "infrastructure_subtypes.json",
        _BACKEND_ROOT / "shared" / "infrastructure_subtypes.json",
    ):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        "infrastructure_subtypes.json not found; expected decision-matrix/shared or backend/shared"
    )


_MANIFEST_PATH = _resolve_manifest_path()


@lru_cache(maxsize=4)
def _load_manifest_cached(path: str, mtime_ns: int) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as handle:
        return json.load(handle)


def load_infrastructure_subtypes_manifest() -> dict[str, Any]:
    stat = _MANIFEST_PATH.stat()
    return _load_manifest_cached(str(_MANIFEST_PATH), stat.st_mtime_ns)


def _tuple(key_path: list[str]) -> tuple[str, ...]:
    node: Any = load_infrastructure_subtypes_manifest()
    for key in key_path:
        node = node[key]
    return tuple(str(item) for item in node)


def _frozenset(key_path: list[str]) -> frozenset[str]:
    return frozenset(_tuple(key_path))


def _dict(key_path: list[str]) -> dict[str, str]:
    node: Any = load_infrastructure_subtypes_manifest()
    for key in key_path:
        node = node[key]
    return {str(k): str(v) for k, v in node.items()}


LINEAR_SUBTYPES = _tuple(["linear", "all"])
ANALYSIS_LINEAR_SUBTYPES = _tuple(["linear", "analysis_internal"])
EXTERNAL_LINEAR_SUBTYPES = _tuple(["linear", "analysis_external"])
POINT_MAP_SUBTYPES = _tuple(["point", "map"])
EXTERNAL_POINT_SUBTYPES = _tuple(["point", "analysis_external"])
MATRIX_POINT_EXCLUDE = _tuple(["matrix", "point_exclude"])
MATRIX_INTERNAL_EXTRA_ROWS = _tuple(["matrix", "internal_extra_rows"])

GKS_CLUSTER_SUBTYPES = _frozenset(["clusters", "gks"])
NODE_CLUSTER_SUBTYPES = _frozenset(["clusters", "node"])
PAD_CLUSTER_SUBTYPES = _frozenset(["clusters", "pad"])
GTES_CLUSTER_SUBTYPES = _frozenset(["clusters", "gtes"])
BOTTOMHOLE_CLUSTER_SUBTYPES = _frozenset(["clusters", "bottomhole"])

# Point map subtypes eligible for pad earthwork (sketch, DEM, volumes) — excludes node and sand quarry.
EARTHWORK_SUBTYPES = frozenset(POINT_MAP_SUBTYPES) - frozenset({"node"})

IMMUTABLE_POINT_SUBTYPES = _frozenset(["point_policies", "immutable"])
EXCLUSIVE_POINT_SUBTYPES = _frozenset(["point_policies", "exclusive"])
FACILITY_POINT_SUBTYPES = _frozenset(["point_policies", "facility"])
IMPORT_ONLY_POINT_SUBTYPES = _frozenset(["point_policies", "import_only"])
IE_DERIVED_POINT_SUBTYPES = _frozenset(["point_policies", "ie_derived"])
NODE_DERIVED_POINT_SUBTYPES = _frozenset(["point_policies", "node_derived"])
PAD_DERIVED_POINT_SUBTYPES = _frozenset(["point_policies", "pad_derived"])
SPARK_EXCLUSIVE_POINT_SUBTYPES = _frozenset(["point_policies", "spark_exclusive"])

SUBTYPE_LABELS = _dict(["labels"])
SUBTYPE_CATEGORY = _dict(["categories"])

LEGACY_SUBTYPE_ALIASES = _dict(["legacy_aliases"])

ANALYSIS_SUBTYPES = (
    *ANALYSIS_LINEAR_SUBTYPES,
    *EXTERNAL_LINEAR_SUBTYPES,
    *EXTERNAL_POINT_SUBTYPES,
    *MATRIX_INTERNAL_EXTRA_ROWS,
)
