"""Validate line.properties.line_footprint_attach (display-only footprint edge attach)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.pad_earthwork.service import resolve_footprint_lonlat
from app.subtype_manifest import EARTHWORK_SUBTYPES

LINE_FOOTPRINT_ATTACH_KEY = "line_footprint_attach"
_DEFAULT_T = 0.5


def _parse_endpoint(raw: object) -> dict | None:
    if not isinstance(raw, dict):
        return None
    point_id = raw.get("point_id")
    edge_index = raw.get("edge_index")
    if not isinstance(point_id, str) or not point_id.strip():
        return None
    try:
        idx = int(edge_index)
    except (TypeError, ValueError):
        return None
    if idx < 0:
        return None
    out: dict = {"point_id": point_id.strip(), "edge_index": idx}
    t_raw = raw.get("t")
    if t_raw is not None and t_raw != "":
        try:
            t = float(t_raw)
        except (TypeError, ValueError):
            return None
        out["t"] = max(0.0, min(1.0, t))
    return out


async def _load_points_by_id(
    db: AsyncSession,
    *,
    project_id: UUID,
    ids: set[str],
) -> dict[str, InfrastructureObject]:
    if not ids:
        return {}
    uuids: list[UUID] = []
    for s in ids:
        try:
            uuids.append(UUID(s))
        except ValueError:
            continue
    if not uuids:
        return {}
    q = (
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.id.in_(uuids),
        )
    )
    rows = list((await db.execute(q)).scalars().all())
    return {str(o.id): o for o in rows}


def _endpoint_valid_for_point(
    endpoint: dict,
    point: InfrastructureObject,
) -> dict | None:
    if point.subtype not in EARTHWORK_SUBTYPES:
        return None
    ring = resolve_footprint_lonlat(point)
    if not ring or len(ring) < 2:
        return None
    edge_count = len(ring) - 1
    idx = int(endpoint["edge_index"])
    if idx >= edge_count:
        return None
    out = {"point_id": endpoint["point_id"], "edge_index": idx}
    if "t" in endpoint:
        out["t"] = endpoint["t"]
    return out


async def sanitize_line_footprint_attach_in_properties(
    db: AsyncSession,
    *,
    project_id: UUID,
    subtype: str,
    properties: dict | None,
) -> dict:
    props = dict(properties or {})
    raw = props.get(LINE_FOOTPRINT_ATTACH_KEY)
    if raw is None:
        return props
    if subtype not in LINE_SUBTYPES:
        props.pop(LINE_FOOTPRINT_ATTACH_KEY, None)
        return props
    if not isinstance(raw, dict):
        props.pop(LINE_FOOTPRINT_ATTACH_KEY, None)
        return props

    parsed: dict[str, dict] = {}
    for key in ("start", "finish"):
        ep = _parse_endpoint(raw.get(key))
        if ep:
            parsed[key] = ep

    if not parsed:
        props.pop(LINE_FOOTPRINT_ATTACH_KEY, None)
        return props

    ids = {ep["point_id"] for ep in parsed.values()}
    by_id = await _load_points_by_id(db, project_id=project_id, ids=ids)

    cleaned: dict[str, dict] = {}
    for key, ep in parsed.items():
        point = by_id.get(ep["point_id"])
        if not point:
            continue
        valid = _endpoint_valid_for_point(ep, point)
        if valid:
            cleaned[key] = valid

    if cleaned:
        props[LINE_FOOTPRINT_ATTACH_KEY] = cleaned
    else:
        props.pop(LINE_FOOTPRINT_ATTACH_KEY, None)
    return props
