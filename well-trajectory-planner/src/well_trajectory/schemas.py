"""Request/response schemas for well trajectory planner."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class SurveyStation(BaseModel):
    md: float
    inc: float
    azi: float
    tvd: float
    n: float
    e: float


class SurveyGeometry(BaseModel):
    length_m: float
    md_max: float
    tvd_max: float


class ConnectorPoint(BaseModel):
    northing: float = 0.0
    easting: float = 0.0
    tvd: float = 0.0
    inc: float = 0.0
    azi: float = 0.0


class ConnectorDesignRequest(BaseModel):
    start: ConnectorPoint
    end: ConnectorPoint
    step_m: float = Field(default=30.0, gt=0, le=500)
    units: Literal["metric"] = "metric"
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"


class ConnectorDesignResponse(BaseModel):
    stations: list[SurveyStation]
    max_dls: float
    geometry: SurveyGeometry


class HorizontalDesignRequest(BaseModel):
    start: ConnectorPoint
    heel: ConnectorPoint
    toe: ConnectorPoint
    step_m: float = Field(default=30.0, gt=0, le=500)
    units: Literal["metric"] = "metric"
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"
    inc_heel: float = Field(default=90.0, ge=0, le=180)


class HorizontalDesignResponse(BaseModel):
    stations: list[SurveyStation]
    max_dls: float
    geometry: SurveyGeometry


class SurveyInterpolateRequest(BaseModel):
    stations: list[SurveyStation] = Field(..., min_length=2)
    step_m: float = Field(default=30.0, gt=0, le=500)
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"


class SurveyInterpolateResponse(BaseModel):
    stations: list[SurveyStation]
    geometry: SurveyGeometry


class LonLat(BaseModel):
    lon: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)


class WellLocal(BaseModel):
    east_m: float
    north_m: float


class WellHead(BaseModel):
    east_m: float
    north_m: float
    kb_m: float


class WellDesignStub(BaseModel):
    profile: Literal["vertical", "connector"] = "vertical"
    start: dict[str, float] | None = None
    end: dict[str, float] | None = None


class WellSurveyBlock(BaseModel):
    source: Literal["calculated", "imported", "stub"] = "calculated"
    stations: list[SurveyStation]


class PadWellTrajectory(BaseModel):
    well_index: int
    name: str
    well_type: Literal["producer", "injector", "other"] = "producer"
    wellhead: WellHead
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"
    error_model: str = "ISCWSA MWD Rev5.11"
    design: WellDesignStub
    survey: WellSurveyBlock
    geometry: SurveyGeometry | None = None


class PadGenerateFromLayoutRequest(BaseModel):
    wells_local: list[WellLocal] = Field(..., min_length=1, max_length=64)
    kb_m: float = Field(..., ge=-500, le=5000)
    rotation_deg: float = Field(default=90.0, ge=0, le=360)
    anchor: LonLat | None = None
    default_profile: Literal["vertical"] = "vertical"
    target_tvd_m: float | None = Field(default=None, gt=0, le=10000)
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"
    error_model: str = "ISCWSA MWD Rev5.11"


class PadGenerateFromLayoutResponse(BaseModel):
    wells: list[PadWellTrajectory]


class ClearanceSurveyIn(BaseModel):
    name: str = ""
    md: list[float] = Field(..., min_length=2)
    inc: list[float] = Field(..., min_length=2)
    azi: list[float] = Field(..., min_length=2)
    n: list[float] = Field(..., min_length=2)
    e: list[float] = Field(..., min_length=2)
    tvd: list[float] = Field(..., min_length=2)
    error_model: str = "ISCWSA MWD Rev5.11"
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"
    start_nev: list[float] | None = None


class ClearancePairsRequest(BaseModel):
    surveys: list[ClearanceSurveyIn] = Field(..., min_length=2)
    pairs: list[list[int]] = Field(..., min_length=1)
    method: Literal["iscwsa"] = "iscwsa"
    threshold: float = Field(default=1.0, gt=0)


class ClearancePairResult(BaseModel):
    well_a: int
    well_b: int
    min_sf: float
    warning: bool
    center_to_center_m: float | None = None


class ClearancePairsResponse(BaseModel):
    pairs: list[ClearancePairResult]
    threshold: float = 1.0


class ImportCsvTextRequest(BaseModel):
    content: str = Field(..., min_length=1)


class ImportParseWell(BaseModel):
    name: str
    azi_reference: Literal["grid", "magnetic", "true"] = "grid"
    stations: list[SurveyStation] = Field(..., min_length=2)
    geometry: SurveyGeometry | None = None
    warnings: list[str] = Field(default_factory=list)


class ImportParseResponse(BaseModel):
    wells: list[ImportParseWell] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
