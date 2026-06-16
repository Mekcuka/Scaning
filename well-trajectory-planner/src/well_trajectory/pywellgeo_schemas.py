"""Pydantic DTO for PyWellGeo HTTP API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from well_trajectory.schemas import SurveyGeometry, SurveyStation


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
    well_index: int = 0
    name: str | None = None
    tree: PyWellGeoTreeNode
    source: str | None = None


class TreeFromSurveyRequest(BaseModel):
    stations: list[SurveyStation]
    radius_m: float = 0.10795
    name: str = "main"


class TreeFromYamlRequest(BaseModel):
    content: str
    format: Literal["XYZGENERIC", "DETAILEDTNO", "DC1D", "AUTO"] = "AUTO"
    well_key: str | None = None
    radius_m: float = 0.10795


class TreeComputeRequest(BaseModel):
    tree: PyWellGeoTreeNode
    tsurface_c: float | None = None
    tgrad_c_per_m: float | None = None


class BranchStat(BaseModel):
    name: str
    length_m: float
    ahd_m: float
    perforated: bool
    color: str


class TreeComputeResponse(BaseModel):
    geometry: SurveyGeometry
    branch_stats: list[BranchStat]
    md_max: float | None = None
    tvd_max: float | None = None
    temperature_profile: list[dict[str, float]] = Field(default_factory=list)


class PlotSegment(BaseModel):
    from_xyz: list[float]
    to_xyz: list[float]
    color: str
    perforated: bool
    name: str


class TreePlotDataRequest(BaseModel):
    tree: PyWellGeoTreeNode


class TreePlotDataResponse(BaseModel):
    segments: list[PlotSegment]


class TreeAddBranchRequest(BaseModel):
    tree: PyWellGeoTreeNode
    xyz: list[list[float]]
    name: str = "branch1"
    color: str = "orange"
    radius_m: float | None = None


class TreeAddBranchResponse(BaseModel):
    tree: PyWellGeoTreeNode
    warnings: list[str] = Field(default_factory=list)


class TreeCoarsenRequest(BaseModel):
    tree: PyWellGeoTreeNode
    segment_length_m: float = 75.0
    perforated: bool | None = None


class TreeCoarsenResponse(BaseModel):
    tree: PyWellGeoTreeNode
    node_count_before: int
    node_count_after: int


class TreeSplitAtZRequest(BaseModel):
    tree: PyWellGeoTreeNode
    z_m: float


class TreeSplitAtZResponse(BaseModel):
    tree: PyWellGeoTreeNode


class TreeFromSurveyResponse(BaseModel):
    tree: PyWellGeoTreeNode


class TreeFromYamlResponse(BaseModel):
    tree: PyWellGeoTreeNode
    format_detected: str
    warnings: list[str] = Field(default_factory=list)


class TreeExportYamlRequest(BaseModel):
    tree: PyWellGeoTreeNode
    format: Literal["XYZGENERIC", "DETAILEDTNO"] = "XYZGENERIC"
    well_name: str = "WELL1"


class TreeExportYamlResponse(BaseModel):
    content: str
    format: str


class AzimDipConvertRequest(BaseModel):
    mode: Literal["vector_to_azim_dip", "azim_dip_to_vector", "azim_dip_to_normal"]
    azim_deg: float | None = None
    dip_deg: float | None = None
    vector: list[float] | None = None


class AzimDipConvertResponse(BaseModel):
    azim_deg: float | None = None
    dip_deg: float | None = None
    vector: list[float] | None = None
    normal: list[float] | None = None


class ThermalInitSoilRequest(BaseModel):
    tree: PyWellGeoTreeNode
    tsurface_c: float
    tgrad_c_per_m: float


class ThermalInitSoilResponse(BaseModel):
    tree: PyWellGeoTreeNode
    profile: list[dict[str, float]]


class WaterPropertiesRequest(BaseModel):
    temperature_c: float = 20.0
    pressure_pa: float | None = None
    depth_m: float | None = None
    salinity_ppm: float = 0.0
    properties: list[Literal["viscosity", "density", "heatcapacity", "well_pressure"]] = Field(
        default_factory=lambda: ["viscosity", "density", "heatcapacity"]
    )


class WaterPropertiesResponse(BaseModel):
    values: dict[str, float]
    units: dict[str, str] = Field(default_factory=dict)


class Dc1dBuildRequest(BaseModel):
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


class Dc1dWellTree(BaseModel):
    name: str
    tree: PyWellGeoTreeNode


class Dc1dBuildResponse(BaseModel):
    wells: list[Dc1dWellTree]
    params: dict[str, Any]


class CoordinateTransformRequest(BaseModel):
    plane_azim_deg: float
    plane_dip_deg: float
    origin: list[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0])
    pitch_deg: float = 0.0
    points: list[list[float]]
    direction: Literal["global_to_local", "local_to_global"] = "global_to_local"


class CoordinateTransformResponse(BaseModel):
    points: list[list[float]]
