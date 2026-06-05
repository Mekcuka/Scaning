"""Autoroad network plan API schemas (service + BFF)."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.geo.constants import TERMINAL_EXCLUSION_RADIUS_KM


class PlanTerminalInput(BaseModel):
    id: UUID
    subtype: str
    name: str = ""
    lon: float
    lat: float
    category: str = ""
    subtype_label: str = ""
    properties: dict = Field(default_factory=dict)
    coordinates: list[float] | None = None

    @model_validator(mode="after")
    def _sync_coordinates(self) -> PlanTerminalInput:
        if self.coordinates is not None and len(self.coordinates) >= 2:
            c_lon, c_lat = float(self.coordinates[0]), float(self.coordinates[1])
            if abs(self.lon - c_lon) > 1e-9 or abs(self.lat - c_lat) > 1e-9:
                raise ValueError("coordinates must match lon/lat")
        object.__setattr__(
            self,
            "coordinates",
            [float(self.lon), float(self.lat)],
        )
        return self


class ExistingAutoroadInput(BaseModel):
    id: UUID
    coordinates: list[list[float]] = Field(..., min_length=2)
    name: str = ""
    subtype: str = "autoroad"


class PlanOptionsInput(BaseModel):
    solver: Literal["geosteiner", "steinerpy"] = "geosteiner"
    connector_max_km: float = Field(default=0.2, gt=0)
    enforce_attachment_radius: bool = True
    normalize_terminal_leaves: bool = True
    steiner_hub_prefix: str = Field(default="steiner:hub", min_length=1, max_length=48)
    steiner_hub_offset_km: float = Field(default=0.0, ge=0)
    edge_vertex_spacing_km: float = Field(default=0.0, ge=0)
    steiner_radius_km: float = Field(default=TERMINAL_EXCLUSION_RADIUS_KM, ge=0)
    attachment_angle_deg: float = Field(default=90.0, ge=0, le=180)
    attachment_angle_penalty: float = Field(default=0.0, ge=0, le=10)
    max_terminals: int = Field(default=50, ge=2, le=200)
    snap_tolerance_km: float = 0.3
    node_dedup_km: float = 0.05


class SolverStatusResponse(BaseModel):
    steinerpy: bool
    geosteiner: bool
    default_solver: str


class NetworkPlanRequest(BaseModel):
    project_id: UUID
    terminals: list[PlanTerminalInput] = Field(..., min_length=1)
    existing_autoroads: list[ExistingAutoroadInput] = Field(default_factory=list)
    options: PlanOptionsInput = Field(default_factory=PlanOptionsInput)


class PlanTerminalResult(BaseModel):
    id: UUID
    name: str = ""
    subtype: str = ""
    category: str = ""
    subtype_label: str = ""
    lon: float = 0.0
    lat: float = 0.0
    coordinates: list[float] = Field(default_factory=list)
    properties: dict = Field(default_factory=dict)
    warning: str | None = None
    snap_lon: float | None = None
    snap_lat: float | None = None
    graph_attached: bool = False
    graph_node_id: str | None = None


def terminal_result_from_input(
    t: PlanTerminalInput,
    *,
    warning: str | None = None,
    snap_lon: float | None = None,
    snap_lat: float | None = None,
    graph_attached: bool = False,
    graph_node_id: str | None = None,
) -> PlanTerminalResult:
    """Build response terminal row with echoed input metadata."""
    return PlanTerminalResult(
        id=t.id,
        name=t.name,
        subtype=t.subtype,
        category=t.category,
        subtype_label=t.subtype_label,
        lon=t.lon,
        lat=t.lat,
        coordinates=[t.lon, t.lat],
        properties=dict(t.properties),
        warning=warning,
        snap_lon=snap_lon,
        snap_lat=snap_lat,
        graph_attached=graph_attached,
        graph_node_id=graph_node_id,
    )


class PlannedLineOut(BaseModel):
    kind: str
    coordinates: list[list[float]]
    snap_start_object_id: UUID | None = None
    snap_finish_object_id: UUID | None = None


class PlannedNodeOut(BaseModel):
    lon: float
    lat: float
    reason: str = "intersection"


class PlannedSplitOut(BaseModel):
    line_id: UUID
    segment_index: int
    split_lon: float
    split_lat: float


class NetworkPlanResponse(BaseModel):
    terminals: list[PlanTerminalResult] = Field(default_factory=list)
    new_lines: list[PlannedLineOut] = Field(default_factory=list)
    new_nodes: list[PlannedNodeOut] = Field(default_factory=list)
    splits: list[PlannedSplitOut] = Field(default_factory=list)
    used_existing_edge_ids: list[str] = Field(default_factory=list)
    total_new_km: float = 0.0
    warnings: list[str] = Field(default_factory=list)
    preview: dict | None = None
    request_meta: dict | None = None
    new_line_count: int = 0
    new_node_count: int = 0
    split_count: int = 0


class AutoroadNetworkPlanBody(BaseModel):
    """Legacy: object_ids only (plan/apply wrappers)."""

    object_ids: list[UUID] = Field(..., min_length=2, max_length=50)
    dry_run: bool = False
    full_network_rebuild: bool = True


class AutoroadNetworkBuildRequestBody(BaseModel):
    """Step 1: build input JSON from project DB."""

    object_ids: list[UUID] = Field(..., min_length=2, max_length=50)
    full_network_rebuild: bool = True


class AutoroadNetworkApplyBody(BaseModel):
    """Step 3: apply a precomputed plan (same JSON as returned by compute)."""

    object_ids: list[UUID] = Field(..., min_length=2, max_length=50)
    plan: NetworkPlanResponse
    full_network_rebuild: bool = True


class AutoroadNetworkApplyResult(BaseModel):
    plan: NetworkPlanResponse
    created_node_ids: list[str] = Field(default_factory=list)
    created_line_ids: list[str] = Field(default_factory=list)
    created_nodes: int = 0
    created_lines: int = 0


class AutoroadNetworkApplyResponse(NetworkPlanResponse):
    dry_run: bool = False
    created_node_ids: list[str] = Field(default_factory=list)
    created_line_ids: list[str] = Field(default_factory=list)
    created_nodes: int = 0
    created_lines: int = 0
