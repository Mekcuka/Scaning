"""Resolve POI names from user/LLM text to database rows."""

from __future__ import annotations

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointOfInterest

_POI_PREFIX_RE = re.compile(r"^точк[аи][_\s-]*", re.IGNORECASE)


def normalize_poi_lookup_name(value: str) -> str:
    s = value.strip().lower().replace(" ", "_")
    s = _POI_PREFIX_RE.sub("точка_", s)
    return s


async def find_poi_by_name(
    db: AsyncSession,
    project_id: UUID,
    name: str,
) -> PointOfInterest | None:
    raw = name.strip()
    if not raw:
        return None

    poi = await db.scalar(
        select(PointOfInterest).where(
            PointOfInterest.project_id == project_id,
            PointOfInterest.name.ilike(raw),
        )
    )
    if poi:
        return poi

    target = normalize_poi_lookup_name(raw)
    candidates = list(
        (
            await db.execute(
                select(PointOfInterest).where(PointOfInterest.project_id == project_id)
            )
        ).scalars()
    )
    for candidate in candidates:
        if normalize_poi_lookup_name(candidate.name) == target:
            return candidate

    digit = re.match(r"^(\d+)$", raw)
    if digit:
        token = digit.group(1)
        for candidate in candidates:
            norm = normalize_poi_lookup_name(candidate.name)
            if norm in {f"точка_{token}", f"точка{token}"}:
                return candidate

    return None
