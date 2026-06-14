"""Sync corporate API import connection — fetch upstream JSON and persist to layer."""

from __future__ import annotations

from uuid import UUID

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.url_validation import safe_http_get, validate_outbound_url
from app.geo.geometry_utils import build_infra_geometry
from app.geo.validation import category_for_subtype
from app.models import ImportConnection, InfrastructureLayer
from app.services.import_service import import_rows_to_layer


def _parse_upstream_items(data: object) -> list[dict]:
    items = data if isinstance(data, list) else []
    if not items and isinstance(data, dict):
        raw = data.get("features") or data.get("items") or []
        items = raw if isinstance(raw, list) else []
    rows: list[dict] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        subtype = (item.get("type") or item.get("subtype") or "gas_processing").lower()
        name = item.get("name") or f"API object {i + 1}"
        lon = float(item.get("lon") or item.get("longitude") or 0)
        lat = float(item.get("lat") or item.get("latitude") or 0)
        rows.append(
            {
                "name": name,
                "subtype": subtype,
                "lon": lon,
                "lat": lat,
                "end_lon": None,
                "end_lat": None,
                "geometry": build_infra_geometry(subtype, lon, lat),
                "category": category_for_subtype(subtype),
            }
        )
    return rows


async def _get_or_create_corporate_api_layer(
    db: AsyncSession,
    project_id: UUID,
) -> InfrastructureLayer:
    layer = await db.scalar(
        select(InfrastructureLayer).where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureLayer.source_type == "corporate_api",
        )
    )
    if layer:
        return layer
    layer = InfrastructureLayer(
        project_id=project_id,
        name="Корпоративный API",
        source_type="corporate_api",
        layer_type="vector",
    )
    db.add(layer)
    await db.flush()
    return layer


async def sync_import_connection(
    db: AsyncSession,
    *,
    project_id: UUID,
    connection: ImportConnection,
    headers: dict[str, str],
    auth: httpx.Auth | None,
) -> dict[str, int]:
    try:
        validate_outbound_url(connection.api_url)
        response = await safe_http_get(
            connection.api_url,
            headers=headers,
            auth=auth,
            timeout=60.0,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Upstream request failed") from exc
    if response.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream returned {response.status_code}",
        )
    rows = _parse_upstream_items(response.json())
    layer = await _get_or_create_corporate_api_layer(db, project_id)
    count = await import_rows_to_layer(db, layer, rows)
    await db.commit()
    return {"imported": count}
