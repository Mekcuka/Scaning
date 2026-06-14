"""BFF request/response schemas for well trajectory."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from app.services.pad_earthwork.schemas import PlanVertexIn


class WellTrajectorySettingsOut(BaseModel):
    default_error_model: str = "ISCWSA MWD Rev5.11"
    default_azi_reference: Literal["grid", "magnetic", "true"] = "grid"
    sf_warning_threshold: float = 1.0
    default_target_tvd_m: float | None = None
    units: Literal["metric"] = "metric"
    step_m: float = 30.0
    stub_tvd_m: float = 100.0
    inc_heel: float = 90.0
    gs_entry_search_step_m: float = 30.0


class WellTrajectoryLastResponse(BaseModel):
    trajectories: list[dict[str, Any]] = Field(default_factory=list)
    wells_local: list[PlanVertexIn] = Field(default_factory=list)
    computed_at: str | None = None
    clearance_pairs: list[dict[str, Any]] = Field(default_factory=list)
    clearance_computed_at: str | None = None
    settings: WellTrajectorySettingsOut = Field(default_factory=WellTrajectorySettingsOut)
    warnings: list[str] = Field(default_factory=list)


class WellTrajectoryGenerateResponse(BaseModel):
    trajectories: list[dict[str, Any]]
    computed_at: str | None = None


class ConnectorEndIn(BaseModel):
    northing: float
    easting: float
    tvd: float
    inc: float = 90.0
    azi: float = 90.0


class WellTrajectoryDesignRequest(BaseModel):
    well_index: int = Field(..., ge=0, le=63)
    end: ConnectorEndIn
    step_m: float = Field(default=30.0, gt=0, le=500)


class WellTrajectoryDesignResponse(BaseModel):
    well_index: int
    trajectory: dict[str, Any]


class WellTrajectoryComputeResponse(BaseModel):
    trajectories: list[dict[str, Any]]
    computed_at: str


class BottomholePlanIn(BaseModel):
    east_m: float
    north_m: float


class BottomholeTargetIn(BaseModel):
    source: Literal["manual_map", "form", "import", "design"] = "manual_map"
    plan: BottomholePlanIn | None = None
    lon: float | None = None
    lat: float | None = None
    tvd_m: float = Field(..., gt=0, le=10000)
    inc: float = Field(default=360.0, ge=0, le=360)
    azi: float | None = Field(default=None, ge=0, le=360)


class WellTargetEntryIn(BaseModel):
    well_index: int = Field(..., ge=0, le=63)
    target: BottomholeTargetIn


class WellTrajectoryTargetsPatch(BaseModel):
    targets: list[WellTargetEntryIn] = Field(..., min_length=1)


class WellTrajectoryTargetsResponse(BaseModel):
    trajectories: list[dict[str, Any]]


class WellTrajectoryDesignAllRequest(BaseModel):
    step_m: float = Field(default=30.0, gt=0, le=500)
    well_indices: list[int] | None = None


class WellTrajectoryDesignAllResponse(BaseModel):
    designed: list[int]
    skipped: list[int]
    trajectories: list[dict[str, Any]]


class WellTrajectorySyncBottomholesResponse(BaseModel):
    trajectories: list[dict[str, Any]]
    warnings: list[str] = Field(default_factory=list)


class WellTrajectoryDesignFromBottomholesRequest(BaseModel):
    step_m: float = Field(default=30.0, gt=0, le=500)
    well_indices: list[int] | None = None


class WellTrajectoryDesignFromBottomholesResponse(BaseModel):
    designed: list[int]
    skipped: list[int]
    trajectories: list[dict[str, Any]]
    warnings: list[str] = Field(default_factory=list)


class WellTrajectoryGeoJsonResponse(BaseModel):
    type: Literal["FeatureCollection"] = "FeatureCollection"
    features: list[dict[str, Any]] = Field(default_factory=list)


class ClearancePairOut(BaseModel):
    well_a: int
    well_a_pad_id: str | None = None
    well_a_pad_name: str | None = None
    well_b: int
    well_b_pad_id: str | None = None
    well_b_pad_name: str | None = None
    min_sf: float
    warning: bool


class WellTrajectoryClearanceResponse(BaseModel):
    pairs: list[ClearancePairOut | dict[str, Any]]
    computed_at: str
    wells_count: int
    pairs_count: int
    threshold: float = 1.0
    warnings: list[str] = Field(default_factory=list)


class WellTrajectoryImportPreviewWell(BaseModel):
    name: str
    station_count: int
    matched_index: int | None = None
    warnings: list[str] = Field(default_factory=list)


class WellTrajectoryImportPreviewResponse(BaseModel):
    wells: list[WellTrajectoryImportPreviewWell] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    well_count: int = 0
    warnings: list[str] = Field(default_factory=list)


class WellTrajectoryImportCommitResponse(BaseModel):
    trajectories: list[dict[str, Any]]
    computed_at: str
    warnings: list[str] = Field(default_factory=list)
    imported_count: int = 0
