"""Smoke tests for map API module split."""

from app.api.v1.map import map_router
from app.api.v1.map_import import import_router
from app.api.v1.map_layers import layers_router
from app.api.v1.map_objects import objects_router
from app.api.v1.map_poi import poi_router


def _paths(router) -> set[str | None]:
    return {getattr(r, "path", None) for r in router.routes}


def test_map_router_composes_subrouters():
    paths = _paths(map_router)
    assert "/projects/{project_id}/infrastructure/layers" in paths
    assert "/projects/{project_id}/infrastructure/objects" in paths
    assert "/projects/{project_id}/pois/{poi_id}/analysis" in paths
    assert "/projects/{project_id}/import/csv" in paths


def test_subrouters_registered_in_map_router():
    paths = _paths(map_router)
    for sub in (layers_router, objects_router, poi_router, import_router):
        assert _paths(sub).issubset(paths)
