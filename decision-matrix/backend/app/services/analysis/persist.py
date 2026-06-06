"""Persist POI infrastructure analysis rows."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PoiInfrastructureAnalysis


async def clear_poi_analysis_rows(db: AsyncSession, poi_id: UUID) -> None:
    await db.execute(delete(PoiInfrastructureAnalysis).where(PoiInfrastructureAnalysis.poi_id == poi_id))


async def persist_analysis_rows(db: AsyncSession, rows: list[PoiInfrastructureAnalysis]) -> None:
    for row in rows:
        db.add(row)
    await db.flush()
