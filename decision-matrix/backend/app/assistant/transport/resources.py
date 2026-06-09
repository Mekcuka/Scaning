"""Read-only MCP resources for Atlas Grid HTTP MCP."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from mcp.types import Resource as MCPResource

from app.assistant.dev.repo_root import resolve_repo_root

OPENAPI_URI = "openapi://v1"


@dataclass(frozen=True, slots=True)
class _StaticResource:
    uri: str
    name: str
    description: str
    mime_type: str
    relative_path: str


_STATIC_RESOURCES: tuple[_StaticResource, ...] = (
    _StaticResource(
        uri="docs://calculation-logic",
        name="calculation-logic",
        description="Calculation logic flow documentation",
        mime_type="text/markdown",
        relative_path="docs/calculations/calculation-logic-flow.md",
    ),
    _StaticResource(
        uri="docs://infrastructure-subtypes",
        name="infrastructure-subtypes",
        description="Infrastructure subtype manifest (JSON)",
        mime_type="application/json",
        relative_path="decision-matrix/shared/infrastructure_subtypes.json",
    ),
)


def list_mcp_resources() -> list[MCPResource]:
    resources = [
        MCPResource(
            uri=item.uri,
            name=item.name,
            description=item.description,
            mimeType=item.mime_type,
        )
        for item in _STATIC_RESOURCES
    ]
    resources.append(
        MCPResource(
            uri=OPENAPI_URI,
            name="openapi-v1",
            description="OpenAPI schema snapshot for /api/v1",
            mimeType="application/json",
        )
    )
    return resources


def _read_static_resource(relative_path: str) -> str:
    root = resolve_repo_root()
    path = (root / relative_path).resolve()
    if not path.is_file():
        raise FileNotFoundError(f"Resource file not found: {relative_path}")
    return path.read_text(encoding="utf-8")


def read_mcp_resource(uri: str) -> tuple[str, str]:
    """Return (text, mime_type) for the given resource URI."""
    if uri == OPENAPI_URI:
        from app.main import app

        return json.dumps(app.openapi(), ensure_ascii=False, indent=2), "application/json"

    for item in _STATIC_RESOURCES:
        if item.uri == uri:
            return _read_static_resource(item.relative_path), item.mime_type

    raise FileNotFoundError(f"Unknown resource URI: {uri}")
