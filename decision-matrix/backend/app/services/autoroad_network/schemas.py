"""Autoroad network plan API schemas (service + BFF)."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field


class PlanTerminalInput(BaseModel):
    id: UUID
    subtype: str
    name: str = ""
    lon: float
    lat: float


class ExistingAutoroadInput(BaseModel):
    id: UUID
    coordinates: list[list[float]] = Field(..., min_length=2)


class PlanOptionsInput(BaseModel):
    snap_tolerance_km: float = 0.3
    node_dedup_km: float = 0.05
    access_node_offset_km: float = 0.05
    max_terminals: int = 50


class NetworkPlanRequest(BaseModel):
    project_id: UUID
    terminals: list[PlanTerminalInput] = Field(..., min_length=1)
    existing_autoroads: list[ExistingAutoroadInput] = Field(default_factory=list)
    options: PlanOptionsInput = Field(default_factory=PlanOptionsInput)


class PlanTerminalResult(BaseModel):
    id: UUID
    name: str = ""
    warning: str | None = None
    snap_lon: float | None = None
    snap_lat: float | None = None
    access_lon: float | None = None
    access_lat: float | None = None
    graph_attached: bool = False
    graph_node_id: str | None = None


class PlannedLineOut(BaseModel):
    kind: str
    coordinates: list[list[float]]
    snap_start_object_id: UUID | None = None
    snap_finish_object_id: UUID | None = None
    snap_start_terminal_id: UUID | None = None
    snap_finish_terminal_id: UUID | None = None


class PlannedNodeOut(BaseModel):
    lon: float
    lat: float
    reason: str = "intersection"
    terminal_id: UUID | None = None


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
    new_line_count: int = 0
    new_node_count: int = 0
    split_count: int = 0


class AutoroadNetworkPlanBody(BaseModel):
    object_ids: list[UUID] = Field(..., min_length=2, max_length=50)
    dry_run: bool = False


class AutoroadNetworkApplyResponse(NetworkPlanResponse):
    dry_run: bool = False
    created_node_ids: list[str] = Field(default_factory=list)
    created_line_ids: list[str] = Field(default_factory=list)
    created_nodes: int = 0
    created_lines: int = 0
