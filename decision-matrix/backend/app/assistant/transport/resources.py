"""Read-only MCP resources for Atlas Grid HTTP MCP."""

from __future__ import annotations

import json

from mcp.types import Resource as MCPResource

from app.assistant.knowledge.paths import wiki_enabled
from app.assistant.knowledge.store import list_resource_uris, read_resource

OPENAPI_URI = "openapi://v1"

_LEGACY_DOC_RESOURCES: tuple[tuple[str, str, str, str], ...] = (
    (
        "docs://calculation-logic",
        "calculation-logic",
        "Calculation logic flow documentation",
        "text/markdown",
    ),
    (
        "docs://infrastructure-subtypes",
        "infrastructure-subtypes",
        "Infrastructure subtype manifest (JSON)",
        "application/json",
    ),
)


def list_mcp_resources() -> list[MCPResource]:
    resources: list[MCPResource] = []

    if wiki_enabled():
        for uri, name, description, mime_type in list_resource_uris():
            resources.append(
                MCPResource(
                    uri=uri,
                    name=name,
                    description=description,
                    mimeType=mime_type,
                )
            )
        for uri, name, description, mime_type in _LEGACY_DOC_RESOURCES:
            resources.append(
                MCPResource(
                    uri=uri,
                    name=name,
                    description=description,
                    mimeType=mime_type,
                )
            )

    resources.append(
        MCPResource(
            uri=OPENAPI_URI,
            name="openapi-v1",
            description="OpenAPI schema snapshot for /api/v1",
            mimeType="application/json",
        )
    )
    return resources


def read_mcp_resource(uri: str) -> tuple[str, str]:
    """Return (text, mime_type) for the given resource URI."""
    if uri == OPENAPI_URI:
        from app.main import app

        return json.dumps(app.openapi(), ensure_ascii=False, indent=2), "application/json"

    if wiki_enabled():
        if uri.startswith("wiki://") or uri in {
            "docs://calculation-logic",
            "docs://infrastructure-subtypes",
        }:
            return read_resource(uri)

    raise FileNotFoundError(f"Unknown resource URI: {uri}")
