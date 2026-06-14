"""Pydantic models for pad placement BFF."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class PadPlacementParams(BaseModel):
    max_wells_per_pad: int = Field(default=12, ge=1, le=64)
    well_spacing_m: float = Field(default=9.0, gt=0, le=200)
    wells_per_group: int = Field(default=1, ge=1, le=12)
    group_spacing_m: float = Field(default=9.0, gt=0, le=200)
    margin_left_m: float = Field(default=27.0, ge=0, le=500)
    margin_bottom_m: float = Field(default=43.0, ge=0, le=500)
    margin_top_m: float = Field(default=15.0, ge=0, le=500)
    margin_end_m: float = Field(default=70.0, ge=0, le=500)
    rotation_deg: float = Field(default=90.0)
    min_pad_spacing_m: float = Field(default=200.0, ge=0, le=5000)
    step_m: float = Field(default=30.0, gt=0, le=500)
    sf_check: bool = False
    sf_threshold: float = Field(default=1.0, gt=0)
    top_k: int = Field(default=5, ge=1, le=20)
    center_optimize: bool = True
    center_search_radius_m: float = Field(default=400.0, ge=100, le=2000)
    center_search_step_m: float = Field(default=200.0, ge=50, le=500)
    gs_entry_search_step_m: float | None = Field(
        default=None,
        gt=0,
        le=500,
        description="Override GS entry search step; None = adaptive coarser step for pad placement",
    )


class PadPlacementComputeRequest(BaseModel):
    bottomhole_ids: list[UUID] = Field(min_length=1)
    params: PadPlacementParams = Field(default_factory=PadPlacementParams)
    subtype: Literal["oil_pad", "gas_pad"] = "oil_pad"


class PadPlacementRequestResponse(BaseModel):
    request_id: UUID
    logical_well_count: int
    estimated_partitions: int
    sync_allowed: bool
    warnings: list[str] = Field(default_factory=list)


class BottomholeSnapshot(BaseModel):
    id: UUID
    subtype: str
    name: str
    longitude: float
    latitude: float
    end_longitude: float | None = None
    end_latitude: float | None = None
    properties: dict[str, Any] = Field(default_factory=dict)


class LogicalWell(BaseModel):
    logical_id: str
    profile: Literal["nnb", "gs"]
    bottomhole_ids: list[UUID]
    td_longitude: float
    td_latitude: float
    tvd_m: float
    target_inc: float | None = None
    target_azi: float | None = None
    heel_longitude: float | None = None
    heel_latitude: float | None = None


class PadCandidateOut(BaseModel):
    candidate_id: str
    center_longitude: float
    center_latitude: float
    assigned_logical_ids: list[str]
    sketch: dict[str, Any] | None = None
    wells_local: list[dict[str, float]] = Field(default_factory=list)
    length_m: float | None = None
    width_m: float | None = None
    rotation_deg: float | None = None
    trajectories: list[dict[str, Any]] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class PlacementVariantOut(BaseModel):
    variant_index: int
    pad_count: int
    sum_md_m: float
    pads: list[PadCandidateOut]
    score_warnings: list[str] = Field(default_factory=list)
    invalid: bool = False
    min_sf: float | None = None
    sf_violation_count: int = 0


class PadPlacementComputeResponse(BaseModel):
    request_id: UUID
    logical_well_count: int
    partitions_evaluated: int
    variants: list[PlacementVariantOut]
    warnings: list[str] = Field(default_factory=list)
    computed_at: datetime


class PadPlacementApplyRequest(BaseModel):
    request_id: UUID
    variant_index: int = Field(ge=0)


class PadPlacementApplyResponse(BaseModel):
    created_pad_ids: list[UUID]
    updated_bottomhole_ids: list[UUID]
    warnings: list[str] = Field(default_factory=list)
    applied_at: datetime


class PadPlacementGeoJsonResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict[str, Any]] = Field(default_factory=list)
