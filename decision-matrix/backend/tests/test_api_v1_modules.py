"""Smoke tests for API v1 module split (SOLID phase 6)."""

from app.api.v1.analysis import analysis_router
from app.api.v1.projects import projects_router
from app.api.v1.router import router


def test_v1_router_is_compose_only():
    route_paths = {getattr(r, "path", None) for r in router.routes}
    assert "/projects" in route_paths
    assert any(p and "/pois/analyze-all" in p for p in route_paths)


def test_projects_and_analysis_routers_registered():
    paths = {getattr(r, "path", None) for r in router.routes}
    project_paths = {getattr(r, "path", None) for r in projects_router.routes}
    analysis_paths = {getattr(r, "path", None) for r in analysis_router.routes}
    assert project_paths.issubset(paths)
    assert analysis_paths.issubset(paths)
