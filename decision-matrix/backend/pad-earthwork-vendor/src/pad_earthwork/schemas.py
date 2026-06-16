"""Request/response schemas for pad earthwork compute."""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


class LonLat(BaseModel):
    lon: float = Field(..., ge=-180, le=180)
    lat: float = Field(..., ge=-90, le=90)


class PadParams(BaseModel):
    length_m: float = Field(..., gt=0, le=500)
    width_m: float = Field(..., gt=0, le=500)
    height_m: float = Field(..., gt=0, le=20)
    rotation_deg: float = Field(default=0, ge=-180, le=180)
    reference_elevation_m: float = Field(..., ge=-500, le=5000)


class TerrainFlat(BaseModel):
    mode: Literal["flat"] = "flat"


class TerrainDem(BaseModel):
    mode: Literal["dem"] = "dem"
    dem_asset_id: str | None = None
    dem_file_path: str | None = None


TerrainInput = Annotated[TerrainFlat | TerrainDem, Field(discriminator="mode")]


class PlanRectangleSketch(BaseModel):
    kind: Literal["plan_rectangle"] = "plan_rectangle"
    length_m: float = Field(..., gt=0, le=500)
    width_m: float = Field(..., gt=0, le=500)
    rotation_deg: float = Field(default=0, ge=-180, le=180)


class PlanVertex(BaseModel):
    east_m: float = Field(..., ge=-500, le=500)
    north_m: float = Field(..., ge=-500, le=500)


class PlanPolygonSketch(BaseModel):
    kind: Literal["plan_polygon"] = "plan_polygon"
    vertices: list[PlanVertex] = Field(..., min_length=3, max_length=64)


SketchInput = Annotated[
    PlanRectangleSketch | PlanPolygonSketch,
    Field(discriminator="kind"),
]


class PadHeightReference(BaseModel):
    """Height and reference when footprint comes from sketch."""

    height_m: float = Field(..., gt=0, le=20)
    reference_elevation_m: float = Field(..., ge=-500, le=5000)


class EnvelopeWrap(BaseModel):
    enabled: bool = True
    wrap_width_m: float = Field(..., gt=0, le=100)


class ComputeRequest(BaseModel):
    object_id: str
    subtype: str
    center: LonLat
    params: PadParams | PadHeightReference | None = None
    sketch: PlanRectangleSketch | PlanPolygonSketch | None = None
    envelope: EnvelopeWrap | None = None
    terrain: TerrainInput = Field(default_factory=TerrainFlat)

    @field_validator("terrain", mode="before")
    @classmethod
    def default_terrain(cls, value: object) -> object:
        if value is None:
            return {"mode": "flat"}
        return value

    @model_validator(mode="after")
    def require_params_or_sketch(self) -> ComputeRequest:
        if self.sketch is None and self.params is None:
            raise ValueError("params or sketch is required")
        if self.sketch is not None and self.params is None:
            raise ValueError("params with height_m and reference_elevation_m required when sketch is set")
        if isinstance(self.sketch, (PlanRectangleSketch, PlanPolygonSketch)) and not isinstance(
            self.params, (PadParams, PadHeightReference)
        ):
            raise ValueError("invalid params for plan sketch")
        if self.sketch is None and not isinstance(self.params, PadParams):
            raise ValueError("full params required when sketch is omitted")
        return self


class SketchPreviewRequest(BaseModel):
    sketch: SketchInput


class LocalCornerOut(BaseModel):
    east_m: float
    north_m: float


class SketchPreviewResponse(BaseModel):
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


class WellLayoutGenerateRequest(BaseModel):
    well_count: int = Field(..., ge=1, le=64)
    wells_per_group: int = Field(..., ge=1, le=64)
    well_spacing_m: float = Field(..., gt=0, le=500)
    group_spacing_m: float = Field(default=0.0, ge=0, le=500)
    margins: PadLayoutMarginsIn = Field(default_factory=PadLayoutMarginsIn)
    rotation_deg: float = Field(default=90.0, ge=0, le=360)


class WellLayoutGenerateResponse(BaseModel):
    sketch: PlanPolygonSketch
    wells_local: list[PlanVertex]
    length_m: float
    width_m: float
    rotation_deg: float
    footprint_area_m2: float


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


class ComputeResponse(BaseModel):
    volumes: VolumesOut
    design: DesignOut
    footprint_corners: list[FootprintCornerOut]
    mesh: MeshOut | None = None
    warnings: list[str] = Field(default_factory=list)
