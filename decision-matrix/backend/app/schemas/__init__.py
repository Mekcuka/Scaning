from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    username: str = Field(min_length=2)


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CostRatesUpdate(BaseModel):
    rates: dict[str, float]


class CostRatesResponse(BaseModel):
    project_id: UUID
    rates: dict[str, float]


class DistanceDefaultsUpdate(BaseModel):
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


class DistanceDefaultsResponse(BaseModel):
    threshold_gas_processing_km: float
    threshold_gtes_km: float
    threshold_substation_km: float
    threshold_refinery_km: float
    max_total_line_autoroad_km: float
    max_total_line_oil_pipeline_km: float
    max_total_line_gas_pipeline_km: float
    max_total_line_water_pipeline_km: float
    max_total_line_power_line_km: float
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
    eng_power: str | None = None
    eng_injection: str | None = None
    eng_gas: str | None = None
    eng_oil_preparation: str | None = None
    eng_well_gathering: str | None = None
    eng_transport: str | None = None


class InfraObjectCreate(BaseModel):
    name: str
    subtype: str
    lon: float
    lat: float
    end_lon: float | None = None
    end_lat: float | None = None
    coordinates: list[list[float]] | None = None
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


class ScenarioResponse(BaseModel):
    id: UUID
    name: str
    scenario_type: str
    is_manual: bool
    poi_id: UUID | None = None
    results: dict | None = None

    model_config = {"from_attributes": True}


class ImportPreviewResponse(BaseModel):
    rows: list[dict]
    errors: list[str]
    records_total: int


class RankingRequest(BaseModel):
    algorithm: str = "topsis"
    criteria_values: list[list[float]]
    criterion_types: list[str]
    weights: list[float]


class RankingResponse(BaseModel):
    algorithm: str
    scores: list[float]
    ranking: list[dict]


class RankingCriterion(BaseModel):
    id: str
    name: str
    type: str = "cost"


class RankingSettingsResponse(BaseModel):
    algorithm: str
    criteria: list[RankingCriterion]
    weights: dict[str, float]


class RankingSettingsUpdate(BaseModel):
    algorithm: str | None = None
    criteria: list[RankingCriterion] | None = None
    weights: dict[str, float] | None = None


class RankingCriterionValuesUpdate(BaseModel):
    values: dict[str, dict[str, float]]


class RankingAlternativeResult(BaseModel):
    scenario_id: UUID | None = None
    name: str
    score: float
    rank: int


class RankingRunResponse(BaseModel):
    algorithm: str
    alternatives: list[RankingAlternativeResult]


class RankingSensitivityPoint(BaseModel):
    delta: float
    alternatives: list[RankingAlternativeResult]


class RankingSensitivityResponse(BaseModel):
    algorithm: str
    criterion_id: str
    points: list[RankingSensitivityPoint]


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


class ImportJobResponse(BaseModel):
    id: UUID
    status: str
    records_total: int
    records_imported: int
    errors: list
