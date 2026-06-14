"""Smoke tests for API v1 module split (SOLID phase 6)."""

from app.api.v1.analysis import analysis_router
from app.api.v1.projects import projects_router
from app.api.v1.router import router
from tests.router_paths import collect_route_paths


def test_v1_router_is_compose_only():
    route_paths = collect_route_paths(router)
    assert "/projects" in route_paths
    assert any("/pois/analyze-all" in p for p in route_paths)


def test_projects_and_analysis_routers_registered():
    paths = collect_route_paths(router)
    project_paths = collect_route_paths(projects_router)
    analysis_paths = collect_route_paths(analysis_router)
    assert project_paths.issubset(paths)
    assert analysis_paths.issubset(paths)
