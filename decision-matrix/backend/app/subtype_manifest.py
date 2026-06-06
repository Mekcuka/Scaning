"""Load shared infrastructure_subtypes.json — single source for map and analysis subtype lists."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[2]
_MANIFEST_PATH = _REPO_ROOT / "shared" / "infrastructure_subtypes.json"


@lru_cache(maxsize=1)
def load_infrastructure_subtypes_manifest() -> dict[str, Any]:
    with _MANIFEST_PATH.open(encoding="utf-8") as handle:
        return json.load(handle)


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

LEGACY_SUBTYPE_ALIASES = _dict(["legacy_aliases"])

ANALYSIS_SUBTYPES = (
    *ANALYSIS_LINEAR_SUBTYPES,
    *EXTERNAL_LINEAR_SUBTYPES,
    *EXTERNAL_POINT_SUBTYPES,
    *MATRIX_INTERNAL_EXTRA_ROWS,
)
