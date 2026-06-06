"""Shared types for analysis row builders (OCP phase 5)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PoiInfrastructureAnalysis, PointOfInterest
from app.services.spatial_port import SpatialQueryPort


@dataclass
class AnalysisBuildContext:
    db: AsyncSession
    project_id: UUID
    poi: PointOfInterest
    spatial: SpatialQueryPort
    rates: dict[str, float]
    pads: int
    subtype_status: dict[str, str]
    km_per_pad_map: dict[str, float]
    max_line_map: dict[str, float]
    threshold_map: dict[str, float]
    manual_external: dict[str, PoiInfrastructureAnalysis]
    manual_external_linear: dict[str, PoiInfrastructureAnalysis]
    rows_to_save: list[PoiInfrastructureAnalysis] = field(default_factory=list)
    analysis_items: list[dict[str, Any]] = field(default_factory=list)
    statuses_for_overall: list[str] = field(default_factory=list)


@dataclass
class BuildBatchResult:
    rows: list[PoiInfrastructureAnalysis]
    items: list[dict[str, Any]]
    statuses_for_overall: list[str]


class ParamTypeAnalysisBuilder(Protocol):
    param_type: str

    async def build_all(self, ctx: AnalysisBuildContext) -> BuildBatchResult: ...
