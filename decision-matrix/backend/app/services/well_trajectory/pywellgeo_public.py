"""JSON-safe serialization for PyWellGeo tree payloads (deep branch chains)."""

from __future__ import annotations

from app.core.json_public import json_public_roundtrip


def tree_record_to_public_json(record: dict[str, Any]) -> dict[str, Any]:
    """Round-trip tree record through stdlib json (avoids Pydantic depth limits)."""
    return json_public_roundtrip(record)


def trees_to_public_json(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [tree_record_to_public_json(item) for item in records]


def add_branch_response_json(record: dict[str, Any], warnings: list[str]) -> dict[str, Any]:
    """Full add-branch HTTP payload safe for JSONResponse (deep main-bore chains)."""
    return json_public_roundtrip({"tree": tree_record_to_public_json(record), "warnings": warnings})
