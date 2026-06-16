"""Pydantic schemas for PyWellGeo BFF."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class PyWellGeoTreeNode(BaseModel):
    x: float
    y: float
    z: float
    radius: float = 0.10795
    perforated: bool = False
    color: str = "black"
    name: str = "main"
    branches: list[PyWellGeoTreeNode] = Field(default_factory=list)


class PyWellGeoTreeRecord(BaseModel):
    well_index: int
    name: str | None = None
    tree: PyWellGeoTreeNode
    source: str | None = None
    geometry: dict[str, Any] | None = None
    branch_stats: list[dict[str, Any]] | None = None


class PyWellGeoSettings(BaseModel):
    default_radius_m: float = 0.10795
    tsurface_c: float = 10.0
    tgrad_c_per_m: float = 0.031
    yaml_format_default: Literal["XYZGENERIC", "DETAILEDTNO", "DC1D"] = "XYZGENERIC"
    coarsen_segment_length_m: float = 75.0


class PyWellGeoLastResponse(BaseModel):
    settings: PyWellGeoSettings
    trees: list[dict[str, Any]]
    computed_at: str | None = None
    warnings: list[str] = Field(default_factory=list)


class PyWellGeoTreesPutRequest(BaseModel):
    settings: PyWellGeoSettings | None = None
    trees: list[PyWellGeoTreeRecord]


class PyWellGeoSyncFromSurveyRequest(BaseModel):
    well_index: int = Field(ge=0)
    radius_m: float | None = None


class PyWellGeoSyncFromSurveyResponse(BaseModel):
    tree: PyWellGeoTreeRecord
    warnings: list[str] = Field(default_factory=list)


class PyWellGeoApplyGeometryRequest(BaseModel):
    well_index: int = Field(ge=0)
    tree: PyWellGeoTreeNode | None = None


class PyWellGeoApplyGeometryResponse(BaseModel):
    well_index: int
    geometry: dict[str, Any]


class PyWellGeoYamlImportRequest(BaseModel):
    content: str
    format: Literal["XYZGENERIC", "DETAILEDTNO", "DC1D", "AUTO"] = "AUTO"
    well_index: int = Field(default=0, ge=0)
    well_key: str | None = None
    radius_m: float | None = None


class PyWellGeoYamlExportRequest(BaseModel):
    well_index: int = Field(ge=0)
    format: Literal["XYZGENERIC", "DETAILEDTNO"] = "XYZGENERIC"
    well_name: str = "WELL1"
    tree: PyWellGeoTreeNode | None = None


class PyWellGeoYamlExportResponse(BaseModel):
    content: str
    format: str


class PyWellGeoComputeRequest(BaseModel):
    well_index: int = Field(ge=0)
    tsurface_c: float | None = None
    tgrad_c_per_m: float | None = None
    tree: PyWellGeoTreeNode | None = None


class PyWellGeoComputeResponse(BaseModel):
    tree: PyWellGeoTreeRecord
    temperature_profile: list[dict[str, float]] = Field(default_factory=list)


class PyWellGeoPlotDataRequest(BaseModel):
    well_index: int = Field(ge=0)
    tree: PyWellGeoTreeNode | None = None


class PyWellGeoPlotDataResponse(BaseModel):
    segments: list[dict[str, Any]]


class PyWellGeoAddBranchRequest(BaseModel):
    well_index: int = Field(ge=0)
    tree: PyWellGeoTreeNode
    xyz: list[list[float]] | None = None
    name: str = "branch1"
    color: str = "orange"
    radius_m: float | None = None
    design_with_welleng: bool = False
    kickoff_xyz: list[float] | None = None
    bottomhole_ref: str | None = None
    step_m: float | None = Field(default=None, gt=0, le=500)
    dls_design: float | None = Field(default=None, gt=0, le=30)

    @model_validator(mode="after")
    def validate_xyz_or_design(self) -> PyWellGeoAddBranchRequest:
        if self.design_with_welleng:
            if not self.kickoff_xyz or len(self.kickoff_xyz) != 3:
                raise ValueError("design_with_welleng requires kickoff_xyz [x, y, z]")
            if not self.bottomhole_ref:
                raise ValueError("design_with_welleng requires bottomhole_ref")
            return self
        if not self.xyz or len(self.xyz) < 2:
            raise ValueError("xyz must contain at least two points when design_with_welleng is false")
        return self


class PyWellGeoAddBranchResponse(BaseModel):
    tree: dict[str, Any]
    warnings: list[str] = Field(default_factory=list)


class PyWellGeoCoarsenRequest(BaseModel):
    well_index: int = Field(ge=0)
    tree: PyWellGeoTreeNode
    segment_length_m: float | None = None


class PyWellGeoCoarsenResponse(BaseModel):
    tree: PyWellGeoTreeRecord
    node_count_before: int
    node_count_after: int


class PyWellGeoSplitAtZRequest(BaseModel):
    well_index: int = Field(ge=0)
    tree: PyWellGeoTreeNode
    z_m: float


class PyWellGeoSplitAtZResponse(BaseModel):
    tree: PyWellGeoTreeRecord


class PyWellGeoAzimDipRequest(BaseModel):
    mode: Literal["vector_to_azim_dip", "azim_dip_to_vector", "azim_dip_to_normal"]
    azim_deg: float | None = None
    dip_deg: float | None = None
    vector: list[float] | None = None


class PyWellGeoAzimDipResponse(BaseModel):
    azim_deg: float | None = None
    dip_deg: float | None = None
    vector: list[float] | None = None
    normal: list[float] | None = None


class PyWellGeoWaterPropertiesRequest(BaseModel):
    temperature_c: float = 20.0
    pressure_pa: float | None = None
    depth_m: float | None = None
    salinity_ppm: float = 0.0
    properties: list[str] = Field(default_factory=lambda: ["viscosity", "density", "heatcapacity"])


class PyWellGeoWaterPropertiesResponse(BaseModel):
    values: dict[str, float]
    units: dict[str, str] = Field(default_factory=dict)


class PyWellGeoDc1dBuildRequest(BaseModel):
    k: float = 100.0
    H: float = 50.0
    L: float = 500.0
    tvd: list[float] = Field(default_factory=lambda: [1500.0, 1500.0])
    temp: list[float] = Field(default_factory=lambda: [80.0, 40.0])
    salinity: list[float] = Field(default_factory=lambda: [0.0, 0.0])
    skin: list[float] = Field(default_factory=lambda: [0.0, 0.0])
    ahd: list[float] = Field(default_factory=lambda: [1600.0, 1600.0])
    rw: list[float] = Field(default_factory=lambda: [0.10795, 0.10795])
    roughness: float = 0.0
    tgrad: float = 0.031
    tsurface: float = 10.0
    useheatloss: bool = False
    well_index: int = Field(default=0, ge=0)


class PyWellGeoCoordinateTransformRequest(BaseModel):
    plane_azim_deg: float
    plane_dip_deg: float
    origin: list[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    pitch_deg: float = 0.0
    points: list[list[float]]
    direction: Literal["global_to_local", "local_to_global"] = "global_to_local"
