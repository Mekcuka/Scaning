"""BFF DTOs mirroring pad-earthwork-planner."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator


class LonLatIn(BaseModel):
    lon: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)


class PadParamsIn(BaseModel):
    length_m: float = Field(..., gt=0, le=500)
    width_m: float = Field(..., gt=0, le=500)
    height_m: float = Field(..., gt=0, le=20)
    rotation_deg: float = Field(default=0, ge=-180, le=180)
    reference_elevation_m: float = Field(..., ge=-500, le=5000)


class PadHeightReferenceIn(BaseModel):
    height_m: float = Field(..., gt=0, le=20)
    reference_elevation_m: float = Field(..., ge=-500, le=5000)


class EnvelopeWrapIn(BaseModel):
    enabled: bool = True
    wrap_width_m: float = Field(..., gt=0, le=100)


class PlanRectangleSketchIn(BaseModel):
    kind: Literal["plan_rectangle"] = "plan_rectangle"
    length_m: float = Field(..., gt=0, le=500)
    width_m: float = Field(..., gt=0, le=500)
    rotation_deg: float = Field(default=0, ge=-180, le=180)


class PlanVertexIn(BaseModel):
    east_m: float = Field(..., ge=-500, le=500)
    north_m: float = Field(..., ge=-500, le=500)


class PlanPolygonSketchIn(BaseModel):
    kind: Literal["plan_polygon"] = "plan_polygon"
    vertices: list[PlanVertexIn] = Field(..., min_length=3, max_length=64)


class ProfileChainagePointIn(BaseModel):
    chainage_m: float
    elevation_m: float


class ProfileSketchIn(BaseModel):
    kind: Literal["profile"] = "profile"
    width_m: float = Field(..., gt=0, le=500)
    chainage_points: list[ProfileChainagePointIn] = Field(default_factory=list)
    design_elevation_m: float = Field(..., ge=-500, le=5000)


SketchIn = Annotated[
    PlanRectangleSketchIn | PlanPolygonSketchIn | ProfileSketchIn,
    Field(discriminator="kind"),
]


class SketchPreviewRequestIn(BaseModel):
    sketch: SketchIn


class LocalCornerOut(BaseModel):
    east_m: float
    north_m: float


class SketchPreviewResponseOut(BaseModel):
    length_m: float
    width_m: float
    rotation_deg: float
    footprint_area_m2: float
    footprint_corners_local: list[LocalCornerOut]


class TerrainFlatIn(BaseModel):
    mode: Literal["flat"] = "flat"


class TerrainDemIn(BaseModel):
    mode: Literal["dem"] = "dem"
    dem_asset_id: str | None = None


TerrainIn = Annotated[TerrainFlatIn | TerrainDemIn, Field(discriminator="mode")]


class PadEarthworkComputeRequest(BaseModel):
    params: PadParamsIn | PadHeightReferenceIn | None = None
    sketch: SketchIn | None = None
    envelope: EnvelopeWrapIn | None = None
    terrain: TerrainIn | None = None


class PadEarthworkParamsPatch(BaseModel):
    length_m: float | None = Field(default=None, gt=0, le=500)
    width_m: float | None = Field(default=None, gt=0, le=500)
    height_m: float | None = Field(default=None, gt=0, le=20)
    rotation_deg: float | None = Field(default=None, ge=-180, le=180)
    reference_elevation_m: float | None = Field(default=None, ge=-500, le=5000)


class PadEarthworkSketchSaveRequest(BaseModel):
    sketch: SketchIn
    params: PadHeightReferenceIn | None = None
    envelope: EnvelopeWrapIn | None = None


class VolumesOut(BaseModel):
    fill_m3: float
    cut_m3: float
    net_fill_m3: float


class DesignOut(BaseModel):
    top_elevation_m: float
    footprint_area_m2: float


class FootprintCornerOut(BaseModel):
    lon: float
    lat: float


class MeshOut(BaseModel):
    format: Literal["glb"]
    base64: str


class PadEarthworkComputeResponse(BaseModel):
    volumes: VolumesOut
    design: DesignOut
    footprint_corners: list[FootprintCornerOut]
    mesh: MeshOut | None = None
    warnings: list[str] = Field(default_factory=list)
    computed_at: datetime | None = None


class PadEarthworkLastResponse(BaseModel):
    params: PadParamsIn | None = None
    sketch: PlanRectangleSketchIn | PlanPolygonSketchIn | ProfileSketchIn | None = None
    envelope: EnvelopeWrapIn | None = None
    sketch_saved_at: datetime | None = None
    result: PadEarthworkComputeResponse | None = None
