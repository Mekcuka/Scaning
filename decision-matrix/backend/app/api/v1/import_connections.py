"""Corporate API import connections (FR-2.5.1–2.5.2)."""

from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.database import get_db
from app.core.url_validation import safe_http_get, validate_outbound_url
from app.models import ImportConnection, InfrastructureLayer, Project, User
from app.models.enums import AccessLevel, WriteScope
from app.schemas import ImportConnectionCreate, ImportConnectionResponse, ImportConnectionUpdate
from app.services.import_service import import_rows_to_layer
from app.services.project_access import resolve_project

connections_router = APIRouter()


def _http_auth(c: ImportConnection, token: str) -> tuple[dict[str, str], httpx.Auth | None]:
    headers: dict[str, str] = {}
    auth: httpx.Auth | None = None
    if c.auth_type == "bearer" and token:
        headers["Authorization"] = f"Bearer {token}"
    elif c.auth_type == "api_key" and token:
        headers["X-API-Key"] = token
    elif c.auth_type == "basic" and token:
        user, _, password = token.partition(":")
        auth = httpx.BasicAuth(user, password)
    return headers, auth


async def _project(
    project_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    min_access: AccessLevel = AccessLevel.read,
) -> Project:
    return await resolve_project(project_id, user, db, min_access=min_access, write_scope=WriteScope.infra)


def _conn_response(c: ImportConnection) -> ImportConnectionResponse:
    return ImportConnectionResponse(
        id=c.id,
        project_id=c.project_id,
        name=c.name,
        api_url=c.api_url,
        auth_type=c.auth_type,
        registry_type=c.registry_type,
        created_at=c.created_at.isoformat() if c.created_at else "",
    )


@connections_router.get("/projects/{project_id}/import_connections", response_model=list[ImportConnectionResponse])
async def list_connections(
    project_id: UUID, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    await _project(project_id, user, db)
    rows = (
        await db.execute(
            select(ImportConnection).where(
                ImportConnection.project_id == project_id,
                ImportConnection.user_id == user.id,
            )
        )
    ).scalars().all()
    return [_conn_response(c) for c in rows]


@connections_router.post("/projects/{project_id}/import_connections", response_model=ImportConnectionResponse, status_code=201)
async def create_connection(
    project_id: UUID,
    data: ImportConnectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, min_access=AccessLevel.write)
    try:
        validate_outbound_url(data.api_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    c = ImportConnection(
        user_id=user.id,
        project_id=project_id,
        name=data.name,
        api_url=data.api_url,
        auth_type=data.auth_type,
        credentials_encrypted=encrypt_secret(data.credentials),
        registry_type=data.registry_type,
    )
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return _conn_response(c)


@connections_router.patch(
    "/projects/{project_id}/import_connections/{connection_id}", response_model=ImportConnectionResponse
)
async def update_connection(
    project_id: UUID,
    connection_id: UUID,
    data: ImportConnectionUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, min_access=AccessLevel.write)
    c = await db.get(ImportConnection, connection_id)
    if not c or c.project_id != project_id or c.user_id != user.id:
        raise HTTPException(status_code=404, detail="Connection not found")
    payload = data.model_dump(exclude_unset=True)
    if "credentials" in payload:
        c.credentials_encrypted = encrypt_secret(payload.pop("credentials") or "")
    for k, v in payload.items():
        if k == "api_url":
            try:
                validate_outbound_url(str(v))
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e)) from e
        setattr(c, k, v)
    await db.commit()
    await db.refresh(c)
    return _conn_response(c)


@connections_router.delete("/projects/{project_id}/import_connections/{connection_id}", status_code=204)
async def delete_connection(
    project_id: UUID,
    connection_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, min_access=AccessLevel.write)
    c = await db.get(ImportConnection, connection_id)
    if not c or c.project_id != project_id:
        raise HTTPException(status_code=404, detail="Connection not found")
    await db.delete(c)
    await db.commit()


@connections_router.post("/projects/{project_id}/import_connections/{connection_id}/test")
async def test_connection(
    project_id: UUID,
    connection_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, min_access=AccessLevel.write)
    c = await db.get(ImportConnection, connection_id)
    if not c or c.project_id != project_id:
        raise HTTPException(status_code=404, detail="Connection not found")
    token = decrypt_secret(c.credentials_encrypted)
    headers, auth = _http_auth(c, token)
    try:
        validate_outbound_url(c.api_url)
        r = await safe_http_get(c.api_url, headers=headers, auth=auth, timeout=15.0)
        return {"ok": r.status_code < 400, "status_code": r.status_code}
    except ValueError as e:
        return {"ok": False, "error": str(e)}
    except httpx.HTTPError as e:
        return {"ok": False, "error": str(e)}


@connections_router.post("/projects/{project_id}/import/sync/{connection_id}")
async def sync_connection(
    project_id: UUID,
    connection_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, min_access=AccessLevel.write)
    c = await db.get(ImportConnection, connection_id)
    if not c or c.project_id != project_id:
        raise HTTPException(status_code=404, detail="Connection not found")
    token = decrypt_secret(c.credentials_encrypted)
    headers, auth = _http_auth(c, token)
    try:
        validate_outbound_url(c.api_url)
        r = await safe_http_get(c.api_url, headers=headers, auth=auth, timeout=60.0)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail="Upstream request failed") from e
    if r.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"Upstream returned {r.status_code}")
    data = r.json()
    items = data if isinstance(data, list) else data.get("features") or data.get("items") or []
    rows: list[dict] = []
    for i, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        subtype = (item.get("type") or item.get("subtype") or "gas_processing").lower()
        name = item.get("name") or f"API object {i + 1}"
        lon = float(item.get("lon") or item.get("longitude") or 0)
        lat = float(item.get("lat") or item.get("latitude") or 0)
        from app.geo.geometry_utils import build_infra_geometry
        from app.geo.validation import category_for_subtype

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
    layer = await db.scalar(
        select(InfrastructureLayer).where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureLayer.source_type == "corporate_api",
        )
    )
    if not layer:
        layer = InfrastructureLayer(
            project_id=project_id,
            name="Корпоративный API",
            source_type="corporate_api",
            layer_type="vector",
        )
        db.add(layer)
        await db.flush()
    count = await import_rows_to_layer(db, layer, rows)
    await db.commit()
    return {"imported": count}
