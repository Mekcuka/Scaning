"""Persist and load sand logistics analysis snapshots."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.entry_date import entry_date_to_iso, parse_entry_date
from app.models import ProjectSandLogisticsResult


def _parse_as_of(raw: str | date | None) -> date:
    if isinstance(raw, date) and not isinstance(raw, datetime):
        return raw
    if isinstance(raw, str):
        parsed = parse_entry_date(raw)
        if parsed is not None:
            return parsed
    return date.today()


def _parse_network_id(raw: object | None) -> UUID | None:
    if raw is None or raw == "":
        return None
    try:
        return UUID(str(raw))
    except (TypeError, ValueError):
        return None


def _result_payload_for_storage(result: dict[str, Any]) -> dict[str, Any]:
    """Store subnets/warnings/object_names/timeline; top-level ids live in columns."""
    return {
        "subnet_count": result.get("subnet_count", 0),
        "subnets": result.get("subnets", []),
        "timeline": result.get("timeline", []),
        "warnings": result.get("warnings", []),
        "object_names": result.get("object_names", {}),
    }


def row_to_response(row: ProjectSandLogisticsResult) -> dict[str, Any]:
    payload = row.result if isinstance(row.result, dict) else {}
    calculated_at = row.calculated_at
    if calculated_at.tzinfo is None:
        calculated_at = calculated_at.replace(tzinfo=timezone.utc)
    as_of_iso = entry_date_to_iso(row.as_of)
    horizon_from = row.horizon_from or row.as_of
    horizon_to = row.horizon_to or row.as_of
    timeline = payload.get("timeline", [])
    if not timeline and horizon_from == horizon_to:
        timeline = []
    return {
        "project_id": str(row.project_id),
        "horizon_from": entry_date_to_iso(horizon_from),
        "horizon_to": entry_date_to_iso(horizon_to),
        "as_of": as_of_iso,
        "network_id": str(row.network_id) if row.network_id else "",
        "subnet_count": payload.get("subnet_count", 0),
        "subnets": payload.get("subnets", []),
        "timeline": timeline,
        "warnings": payload.get("warnings", []),
        "object_names": payload.get("object_names", {}),
        "calculated_at": calculated_at.isoformat(),
    }


async def get_sand_logistics_result(
    db: AsyncSession,
    project_id: UUID,
) -> dict[str, Any] | None:
    row = await db.scalar(
        select(ProjectSandLogisticsResult).where(
            ProjectSandLogisticsResult.project_id == project_id
        )
    )
    if not row:
        return None
    return row_to_response(row)


async def upsert_sand_logistics_result(
    db: AsyncSession,
    project_id: UUID,
    result: dict[str, Any],
    *,
    user_id: UUID | None,
) -> ProjectSandLogisticsResult:
    as_of = _parse_as_of(result.get("as_of"))
    horizon_from = _parse_as_of(result.get("horizon_from")) if result.get("horizon_from") else as_of
    horizon_to = _parse_as_of(result.get("horizon_to")) if result.get("horizon_to") else as_of
    network_id = _parse_network_id(result.get("network_id"))
    stored = _result_payload_for_storage(result)
    now = datetime.now(timezone.utc)

    row = await db.scalar(
        select(ProjectSandLogisticsResult).where(
            ProjectSandLogisticsResult.project_id == project_id
        )
    )
    if row is None:
        row = ProjectSandLogisticsResult(
            project_id=project_id,
            as_of=as_of,
            horizon_from=horizon_from,
            horizon_to=horizon_to,
            network_id=network_id,
            result=stored,
            calculated_at=now,
            calculated_by_user_id=user_id,
        )
        db.add(row)
    else:
        row.as_of = as_of
        row.horizon_from = horizon_from
        row.horizon_to = horizon_to
        row.network_id = network_id
        row.result = stored
        row.calculated_at = now
        row.calculated_by_user_id = user_id

    await db.flush()
    return row
