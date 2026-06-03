from datetime import date, datetime
from uuid import UUID

import re
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthMessageResponse(BaseModel):
    message: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    username: str = Field(min_length=2)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8 or not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must be 8+ chars with letter and digit")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: UUID
    email: str
    username: str
    role: str
    avatar_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RefreshTokenBody(BaseModel):
    """For cross-origin SPA when refresh cookie is blocked (e.g. incognito)."""

    refresh_token: str | None = None


class AuthSessionResponse(UserResponse):
    """Login/register/refresh: cookies + tokens for Bearer auth (GitHub Pages → API)."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserAdminResponse(BaseModel):
    id: UUID
    email: str
    username: str
    role: str
    is_active: bool
    created_at: datetime
    project_count: int = 0

    model_config = {"from_attributes": True}


class AdminUserUpdate(BaseModel):
    role: str | None = None
    is_active: bool | None = None


class AdminStatsResponse(BaseModel):
    users: int
    projects: int
    pois: int


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    status: str | None = None
    visibility: str | None = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    status: str
    visibility: str
    poi_count: int = 0
    owner_user_id: UUID
    owner_name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CostRatesUpdate(BaseModel):
    rates: dict[str, float]


class CostRatesResponse(BaseModel):
    project_id: UUID
    rates: dict[str, float]


class EconomicParamsUpdate(BaseModel):
    params: dict[str, float]


class EconomicParamsResponse(BaseModel):
    project_id: UUID
    params: dict[str, float]


class DistanceDefaultsUpdate(BaseModel):
    threshold_gas_processing_km: float | None = None
    threshold_gtes_km: float | None = None
    threshold_substation_km: float | None = None
    threshold_refinery_km: float | None = None
    threshold_ground_pumping_station_km: float | None = None
    threshold_sand_quarry_km: float | None = None
    max_total_line_autoroad_km: float | None = None
    max_total_line_oil_pipeline_km: float | None = None
    max_total_line_gas_pipeline_km: float | None = None
    max_total_line_water_pipeline_km: float | None = None
    max_total_line_power_line_km: float | None = None
    max_total_line_methanol_pipeline_km: float | None = None
    max_total_line_additional_line_km: float | None = None
    km_per_pad_autoroad: float | None = None
    km_per_pad_oil_pipeline: float | None = None
    km_per_pad_gas_pipeline: float | None = None
    km_per_pad_water_pipeline: float | None = None
    km_per_pad_power_line: float | None = None


class DistanceDefaultsResponse(BaseModel):
    threshold_gas_processing_km: float
    threshold_gtes_km: float
    threshold_substation_km: float
    threshold_refinery_km: float
    threshold_ground_pumping_station_km: float
    threshold_sand_quarry_km: float
    max_total_line_autoroad_km: float
    max_total_line_oil_pipeline_km: float
    max_total_line_gas_pipeline_km: float
    max_total_line_water_pipeline_km: float
    max_total_line_power_line_km: float
    max_total_line_methanol_pipeline_km: float
    max_total_line_additional_line_km: float
    km_per_pad_autoroad: float
    km_per_pad_oil_pipeline: float
    km_per_pad_gas_pipeline: float
    km_per_pad_water_pipeline: float
    km_per_pad_power_line: float

    model_config = {"from_attributes": True}


class POICreate(BaseModel):
    name: str
    description: str | None = None
    lon: float
    lat: float
    planned_production_volume: float = 0
    production_per_well: float = 10
    wells_per_pad: int = 4
    fluid_type: str = "oil"
    water_injection_volume: float = 0
    gas_factor: float = 120
    eng_power: str = "external"
    eng_injection: str = "centralized"
    eng_gas: str = "well"
    eng_oil_preparation: str = "mkos"
    eng_well_gathering: str = "single_tube"
    eng_transport: str = "auto"


class POIResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: str | None
    lon: float
    lat: float
    planned_production_volume: float
    production_per_well: float
    wells_per_pad: int
    fluid_type: str
    water_injection_volume: float
    gas_factor: float = 120
    eng_power: str
    eng_injection: str
    eng_gas: str
    eng_oil_preparation: str
    eng_well_gathering: str
    eng_transport: str
    pads_count: int = 0
    wells_total: float = 0
    threshold_gas_processing_km: float | None = None
    threshold_gtes_km: float | None = None
    threshold_substation_km: float | None = None
    threshold_refinery_km: float | None = None
    max_total_line_autoroad_km: float | None = None
    max_total_line_oil_pipeline_km: float | None = None
    max_total_line_gas_pipeline_km: float | None = None
    max_total_line_water_pipeline_km: float | None = None
    max_total_line_power_line_km: float | None = None
    km_per_pad_autoroad: float | None = None
    km_per_pad_oil_pipeline: float | None = None
    km_per_pad_gas_pipeline: float | None = None
    km_per_pad_water_pipeline: float | None = None
    km_per_pad_power_line: float | None = None


class AnalysisOverrideUpdate(BaseModel):
    param_type: str | None = None  # external | external_linear
    nearest_object_id: UUID | None = None
    nearest_node_id: UUID | None = None
    force_construction: bool | None = None


class ImportConnectionCreate(BaseModel):
    name: str
    api_url: str
    auth_type: str = "bearer"
    credentials: str = ""
    registry_type: str | None = None


class ImportConnectionUpdate(BaseModel):
    name: str | None = None
    api_url: str | None = None
    auth_type: str | None = None
    credentials: str | None = None
    registry_type: str | None = None


class ImportConnectionResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    api_url: str
    auth_type: str
    registry_type: str | None = None
    created_at: str


class LayerCreate(BaseModel):
    name: str
    layer_type: str = "vector"
    source_type: str = "manual"
    is_visible: bool = True
    opacity: float = 1.0
    sort_order: int = 0
    style_config: dict = Field(default_factory=dict)


class LayerUpdate(BaseModel):
    name: str | None = None
    is_visible: bool | None = None
    opacity: float | None = None
    sort_order: int | None = None
    style_config: dict | None = None


class LayerResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    layer_type: str
    source_type: str
    is_visible: bool
    opacity: float
    sort_order: int
    style_config: dict

    model_config = {"from_attributes": True}


class POIUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    lon: float | None = None
    lat: float | None = None
    threshold_gas_processing_km: float | None = None
    threshold_gtes_km: float | None = None
    threshold_substation_km: float | None = None
    threshold_refinery_km: float | None = None
    max_total_line_autoroad_km: float | None = None
    max_total_line_oil_pipeline_km: float | None = None
    max_total_line_gas_pipeline_km: float | None = None
    max_total_line_water_pipeline_km: float | None = None
    max_total_line_power_line_km: float | None = None
    km_per_pad_autoroad: float | None = None
    km_per_pad_oil_pipeline: float | None = None
    km_per_pad_gas_pipeline: float | None = None
    km_per_pad_water_pipeline: float | None = None
    km_per_pad_power_line: float | None = None
    planned_production_volume: float | None = None
    production_per_well: float | None = None
    wells_per_pad: int | None = None
    fluid_type: str | None = None
    water_injection_volume: float | None = None
    gas_factor: float | None = None
    eng_power: str | None = None
    eng_injection: str | None = None
    eng_gas: str | None = None
    eng_oil_preparation: str | None = None
    eng_well_gathering: str | None = None
    eng_transport: str | None = None


FacilityPointSubtype = Literal["refinery", "oil_pumping_station"]


class InfraObjectCreate(BaseModel):
    name: str
    subtype: str = Field(..., min_length=1, description="Код подтипа инфраструктуры (обязательно)")
    lon: float
    lat: float
    end_lon: float | None = None
    end_lat: float | None = None
    coordinates: list[list[float]] | None = None
    layer_id: UUID | None = None
    properties: dict = Field(default_factory=dict)
    description: str | None = None


class FacilityInfraObjectCreate(BaseModel):
    """НПЗ / НПС — подтип обязателен в теле запроса (refinery | oil_pumping_station)."""

    name: str = Field(..., min_length=1)
    subtype: FacilityPointSubtype = Field(
        ...,
        description="Обязательно: refinery (НПЗ), oil_pumping_station (НПС)",
    )
    lon: float
    lat: float
    layer_id: UUID | None = None
    properties: dict = Field(default_factory=dict)
    description: str | None = None


class InfraObjectUpdate(BaseModel):
    name: str | None = None
    subtype: str | None = None
    description: str | None = None
    layer_id: UUID | None = None
    lon: float | None = None
    lat: float | None = None
    end_lon: float | None = None
    end_lat: float | None = None
    coordinates: list[list[float]] | None = None
    properties: dict | None = None


class Map3dCustomModelResponse(BaseModel):
    id: UUID
    project_id: UUID
    filename: str
    target_height_m: float
    created_at: datetime
    assigned_subtypes: list[str] = Field(default_factory=list)


class Map3dCustomModelAssign(BaseModel):
    """Replace GLB subtype assignments. ``subtypes: []`` clears all assignments."""

    subtypes: list[str] | None = None
    subtype: str | None = None
    object_id: UUID | None = None

    @model_validator(mode="after")
    def require_assign_payload(self) -> "Map3dCustomModelAssign":
        if self.subtypes is not None:
            return self
        has_subtype = bool(self.subtype and str(self.subtype).strip())
        if has_subtype or self.object_id is not None:
            return self
        raise ValueError("subtypes, subtype or object_id is required")


class Render3DEffective(BaseModel):
    height_m: float
    base_m: float
    visible: bool
    scale: float = 1.0


class InfraObjectResponse(BaseModel):
    id: UUID
    layer_id: UUID
    name: str
    subtype: str
    category: str
    lon: float
    lat: float
    end_lon: float | None = None
    end_lat: float | None = None
    coordinates: list[list[float]] | None = None
    properties: dict = Field(default_factory=dict)
    render_3d_effective: Render3DEffective | None = None


class MapBatchDeleteRequest(BaseModel):
    object_ids: list[UUID] = Field(default_factory=list)
    poi_ids: list[UUID] = Field(default_factory=list)


class MapBatchDeleteResponse(BaseModel):
    deleted_objects: int
    deleted_pois: int
    network_rebuilt: bool = False


class AnalysisRowResponse(BaseModel):
    subtype: str
    param_type: str
    status: str
    distance_km: float | None = None
    limit_km: float | None = None
    distance_source: str | None = None
    nearest_object_id: str | None = None
    object_name: str | None = None
    anchor_lon: float | None = None
    anchor_lat: float | None = None
    anchor_type: str | None = None


class POIAnalysisResponse(BaseModel):
    poi_id: UUID
    total_cost_mln: float
    overall_status: str
    analysis: list[dict]
    engineering_status: dict[str, str]


class CandidateResponse(BaseModel):
    object_id: UUID | None
    nearest_node_id: UUID | None = None
    name: str
    distance_km: float
    anchor_lon: float
    anchor_lat: float
    anchor_type: str | None = None


class ImportPreviewResponse(BaseModel):
    rows: list[dict]
    errors: list[str]
    records_total: int


class ImportLogResponse(BaseModel):
    id: UUID
    project_id: UUID | None = None
    source_type: str
    file_name: str | None
    status: str
    records_total: int
    records_imported: int
    errors: list
    created_at: datetime

    model_config = {"from_attributes": True}


class FlowSchematicNode(BaseModel):
    id: str
    kind: str
    label: str
    fluid: str | None = None
    subtype: str | None = None
    status: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    throughput_capacity_annual: float | None = None
    capacity_unit: str | None = None
    flow_annual: float | None = None
    flow_unit: str | None = None
    over_capacity: bool = False
    separation_percent: float | None = None
    length_km: float | None = None
    infrastructure_object_id: UUID | None = None


class FlowSchematicEdge(BaseModel):
    id: str
    source: str
    target: str
    fluid: str


class FlowSchematicResponse(BaseModel):
    poi_id: UUID
    nodes: list[FlowSchematicNode]
    edges: list[FlowSchematicEdge]
    warnings: list[str]
    source: str = "auto"


class FlowSchematicSave(BaseModel):
    nodes: list[FlowSchematicNode]
    edges: list[FlowSchematicEdge]


class EconomicFlowNode(BaseModel):
    id: str
    kind: str
    label: str
    fluid: str | None = None
    position_x: float | None = None
    position_y: float | None = None
    flow_annual: float | None = None
    flow_unit: str | None = None
    capex_thousand_rub: float | None = None
    opex_thousand_rub_per_year: float | None = None
    revenue_thousand_rub_per_year: float | None = None
    net_thousand_rub_per_year: float | None = None
    formula_label: str | None = None


class EconomicFlowSummary(BaseModel):
    total_capex_mln: float
    total_opex_mln_per_year: float
    total_revenue_mln_per_year: float
    net_mln_per_year: float


class EconomicFlowResponse(BaseModel):
    poi_id: UUID
    nodes: list[EconomicFlowNode]
    edges: list[FlowSchematicEdge]
    summary: EconomicFlowSummary
    warnings: list[str]


class SandLogisticsNetworkNode(BaseModel):
    id: str
    lon: float
    lat: float


class SandLogisticsNetworkEdge(BaseModel):
    id: str
    from_node_id: str
    to_node_id: str
    length_km: float


class SandLogisticsProportionalPart(BaseModel):
    quarry_id: str
    quarry_name: str
    allocated_m3: float
    distance_km: float | None = None


class SandLogisticsConsumerRow(BaseModel):
    object_id: str
    name: str
    subtype: str
    lon: float
    lat: float
    snap_node_id: str | None = None
    demand_m3: float
    demand_plan_total_m3: float = 0.0
    demand_by_year_m3: dict[str, float] = Field(default_factory=dict)
    entry_date: str = "2020-01-01"
    in_service: bool = True
    nearest_quarry_id: str | None = None
    nearest_quarry_name: str | None = None
    distance_km: float | None = None
    snap_to_node_km: float | None = None
    distances_to_quarries_km: dict[str, float | None] = Field(default_factory=dict)
    greedy_quarry_id: str | None = None
    greedy_quarry_name: str | None = None
    greedy_allocated_m3: float = 0.0
    allocation_by_year_m3: dict[str, float] = Field(default_factory=dict)
    proportional_allocations: list[SandLogisticsProportionalPart] = Field(default_factory=list)


class SandLogisticsQuarryRow(BaseModel):
    object_id: str
    name: str
    lon: float
    lat: float
    snap_node_id: str | None = None
    entry_date: str = "2020-01-01"
    in_service: bool = True
    initial_m3: float
    current_m3: float
    greedy_allocated_m3: float
    greedy_remaining_m3: float
    proportional_allocated_m3: float
    proportional_exceeds_capacity: bool = False


class SandLogisticsSubnetResult(BaseModel):
    subnet_index: int
    name: str
    autoroad_edge_count: int
    quarry_count: int
    consumer_count: int
    network_nodes: list[SandLogisticsNetworkNode] = Field(default_factory=list)
    network_edges: list[SandLogisticsNetworkEdge] = Field(default_factory=list)
    quarries: list[SandLogisticsQuarryRow] = Field(default_factory=list)
    consumers: list[SandLogisticsConsumerRow] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class SandLogisticsYearStep(BaseModel):
    year: int
    as_of: str
    subnet_count: int = 0
    total_demand_m3: float = 0.0
    total_allocated_m3: float = 0.0
    unmet_m3: float = 0.0
    subnets: list[SandLogisticsSubnetResult] = Field(default_factory=list)


class SandLogisticsAnalyzeResponse(BaseModel):
    project_id: str
    horizon_from: str = "2020-01-01"
    horizon_to: str = "2020-01-01"
    as_of: str = "2020-01-01"
    network_id: str
    subnet_count: int = 0
    subnets: list[SandLogisticsSubnetResult] = Field(default_factory=list)
    timeline: list[SandLogisticsYearStep] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    object_names: dict[str, str] = Field(default_factory=dict)
    calculated_at: str | None = None


class SandLogisticsAnalyzeRequest(BaseModel):
    horizon_from: date | None = None
    horizon_to: date | None = None
    as_of: date | None = None
    rebuild_network: bool = True


class ImportJobResponse(BaseModel):
    id: UUID
    status: str
    records_total: int
    records_imported: int
    errors: list


class OnePagerCreate(BaseModel):
    poi_id: UUID
    engineer_name: str | None = None
    roadmap: list[dict] | None = None
    recommendation_text: str | None = None
    map_snapshot_base64: str | None = None


class OnePagerUpdate(BaseModel):
    recommendation_text: str | None = None
    roadmap: list[dict] | None = None
    map_snapshot_base64: str | None = None
    engineer_name: str | None = None


class OnePagerExportPptxRequest(BaseModel):
    map_snapshot_base64: str | None = None


class OnePagerResponse(BaseModel):
    id: UUID
    project_id: UUID
    poi_id: UUID
    title: str
    coordinates: str | None = None
    engineer_name: str | None = None
    report_date: date | None = None
    final_variant_data: dict = Field(default_factory=dict)
    engineering_params: dict = Field(default_factory=dict)
    roadmap: list = Field(default_factory=list)
    recommendation_text: str | None = None
    is_recommendation_edited: bool = False
    generation_status: str = "pending"
    poi_name: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}

