"""BFF DTOs mirroring pad-earthwork-planner."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


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


class PadLayoutMarginsIn(BaseModel):
    left_m: float = Field(default=27.0, ge=0, le=500)
    bottom_m: float = Field(default=43.0, ge=0, le=500)
    top_m: float = Field(default=15.0, ge=0, le=500)
    end_m: float = Field(default=70.0, ge=0, le=500)


class WellLayoutGenerateRequestIn(BaseModel):
    well_count: int | None = Field(default=None, ge=1, le=64)
    wells_per_group: int | None = Field(default=None, ge=1, le=64)
    well_spacing_m: float | None = Field(default=None, gt=0, le=500)
    group_spacing_m: float | None = Field(default=None, ge=0, le=500)
    margins: PadLayoutMarginsIn | None = None
    rotation_deg: float | None = Field(default=None, ge=0, le=360)


class WellLayoutGenerateResponseOut(BaseModel):
    sketch: PlanPolygonSketchIn
    wells_local: list[PlanVertexIn]
    length_m: float
    width_m: float
    rotation_deg: float
    footprint_area_m2: float


class TerrainFlatIn(BaseModel):
    mode: Literal["flat"] = "flat"


class TerrainDemIn(BaseModel):
    mode: Literal["dem"] = "dem"
    dem_asset_id: str | None = None


class PadDemStatusOut(BaseModel):
    asset_id: str | None = None
    source: str | None = None
    fetched_at: datetime | None = None


class PadDemFetchResponseOut(BaseModel):
    dem_asset_id: str
    source: str
    fetched_at: datetime
    bbox: list[float] = Field(..., min_length=4, max_length=4)
    reference_elevation_m: float


class PadDemPreviewBoundsOut(BaseModel):
    min_east_m: float
    max_east_m: float
    min_north_m: float
    max_north_m: float


class PadDemPreviewResponseOut(BaseModel):
    bounds: PadDemPreviewBoundsOut
    cols: int = Field(..., ge=1, le=128)
    rows: int = Field(..., ge=1, le=128)
    cell_size_m: float = Field(..., gt=0)
    elev_min: float
    elev_max: float
    design_elevation_m: float
    elevations: list[float | None]
    cut_fill: list[int | None]

    @model_validator(mode="after")
    def _grid_lengths(self) -> PadDemPreviewResponseOut:
        expected = self.cols * self.rows
        if len(self.elevations) != expected:
            raise ValueError("elevations length must equal cols * rows")
        if len(self.cut_fill) != expected:
            raise ValueError("cut_fill length must equal cols * rows")
        return self


class PadDemPreviewRequest(BaseModel):
    """Same shape as compute body for sketch + height reference."""

    params: PadParamsIn | PadHeightReferenceIn | None = None
    sketch: SketchIn | None = None


TerrainIn = Annotated[TerrainFlatIn | TerrainDemIn, Field(discriminator="mode")]


class PadEarthworkComputeRequest(BaseModel):
    params: PadParamsIn | PadHeightReferenceIn | None = None
    sketch: PlanRectangleSketchIn | PlanPolygonSketchIn | None = None
    profile: ProfileSketchIn | None = None
    envelope: EnvelopeWrapIn | None = None
    terrain: TerrainIn | None = None


class PadEarthworkProfileSaveRequest(BaseModel):
    profile: ProfileSketchIn
    params: PadHeightReferenceIn | None = None
    envelope: EnvelopeWrapIn | None = None


class PadDemProfileSampleRequest(BaseModel):
    params: PadParamsIn | PadHeightReferenceIn | None = None
    step_m: float = Field(default=1.0, gt=0, le=50)


class PadDemProfileSampleResponse(BaseModel):
    chainage_points: list[ProfileChainagePointIn]
    length_m: float
    rotation_deg: float
    design_elevation_m: float


class PadEarthworkParamsPatch(BaseModel):
    length_m: float | None = Field(default=None, gt=0, le=500)
    width_m: float | None = Field(default=None, gt=0, le=500)
    height_m: float | None = Field(default=None, gt=0, le=20)
    rotation_deg: float | None = Field(default=None, ge=-180, le=180)
    reference_elevation_m: float | None = Field(default=None, ge=-500, le=5000)


class PadEarthworkSketchSaveRequest(BaseModel):
    sketch: PlanRectangleSketchIn | PlanPolygonSketchIn
    params: PadHeightReferenceIn | None = None
    envelope: EnvelopeWrapIn | None = None
    wells_local: list[PlanVertexIn] | None = None
    rotation_deg: float | None = Field(default=None, ge=0, le=360)


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
    sketch: PlanRectangleSketchIn | PlanPolygonSketchIn | None = None
    profile: ProfileSketchIn | None = None
    wells_local: list[PlanVertexIn] = Field(default_factory=list)
    envelope: EnvelopeWrapIn | None = None
    sketch_saved_at: datetime | None = None
    profile_saved_at: datetime | None = None
    dem: PadDemStatusOut | None = None
    result: PadEarthworkComputeResponse | None = None
