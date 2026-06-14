"""Collect HTTP path patterns from FastAPI/Starlette routers (incl. FastAPI 0.137+)."""

from __future__ import annotations

from typing import Any


def collect_route_paths(router: Any) -> set[str]:
    """Return route path templates from a router, following nested includes."""
    paths: set[str] = set()
    for route in getattr(router, "routes", ()):
        path = getattr(route, "path", None)
        if path:
            paths.add(path)
        original = getattr(route, "original_router", None)
        if original is not None:
            paths.update(collect_route_paths(original))
        elif getattr(route, "routes", None):
            paths.update(collect_route_paths(route))
    return paths
