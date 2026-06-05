"""Request/response schemas for planning endpoints."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class TerminalInput(BaseModel):
    id: UUID
    type: str = "terminal"
    role: Literal["start", "end", "intermediate"] = "intermediate"
    lon: float
    lat: float
    attachment_max_km: float | None = Field(
        default=None,
        gt=0,
        description="Max leaf-edge length (km); overrides options.connector_max_km",
    )


class PlanOptions(BaseModel):
    connector_max_km: float = Field(
        default=0.2,
        gt=0,
        description="Default max terminal leaf-edge length (km)",
    )
    enforce_attachment_radius: bool = Field(
        default=True,
        description="When false, ignore leaf-edge limits (pure Steiner tree)",
    )
    normalize_terminal_leaves: bool = Field(
        default=True,
        description="Insert hub Steiner nodes so every terminal has degree 1",
    )
    steiner_hub_prefix: str = Field(
        default="steiner:hub",
        min_length=1,
        max_length=48,
        pattern=r"^[a-zA-Z][a-zA-Z0-9:._-]*$",
        description="Prefix for hub ids: {prefix}:0, {prefix}:1, …",
    )
    steiner_hub_offset_km: float = Field(
        default=0.0,
        ge=0,
        description="Length of terminal→hub edge (km); 0 = hub at terminal coordinates",
    )
    edge_vertex_spacing_km: float = Field(
        default=0.0,
        ge=0,
        description="Max segment length (km); subdivide edges with steiner:waypoint:* nodes",
    )
    attachment_angle_deg: float = Field(
        default=90.0,
        ge=0,
        le=180,
        description="Target attachment angle at backbone (degrees); 0 disables penalty",
    )
    attachment_angle_penalty: float = Field(
        default=0.0,
        ge=0,
        le=10,
        description="Weight multiplier for angle deviation from attachment_angle_deg",
    )
    steiner_radius_km: float = Field(
        default=0.0,
        ge=0,
        description="Exclusion zone (km) around terminals: no Steiner points closer than R",
    )
    max_points: int = Field(default=50, ge=2, le=200)


class PlanRequest(BaseModel):
    project_id: UUID | None = None
    terminals: list[TerminalInput] = Field(..., min_length=2)
    options: PlanOptions = Field(default_factory=PlanOptions)

    @model_validator(mode="after")
    def _validate_roles_and_limits(self) -> PlanRequest:
        starts = [t for t in self.terminals if t.role == "start"]
        ends = [t for t in self.terminals if t.role == "end"]
        if len(starts) != 1:
            raise ValueError("exactly one terminal with role 'start' is required")
        if len(ends) != 1:
            raise ValueError("exactly one terminal with role 'end' is required")
        if len(self.terminals) > self.options.max_points:
            raise ValueError(f"total points exceed max_points ({self.options.max_points})")
        return self


class SteinerPointOut(BaseModel):
    id: str
    lon: float
    lat: float


class SteinerEdgeOut(BaseModel):
    from_id: str
    to_id: str
    coordinates: list[list[float]]


class SteinerTreeOut(BaseModel):
    edges: list[SteinerEdgeOut] = Field(default_factory=list)
    steiner_points: list[SteinerPointOut] = Field(default_factory=list)
    length_m: float = 0.0


class TerminalResultOut(BaseModel):
    id: UUID
    type: str = ""
    role: str
    lon: float
    lat: float
    attached_to: str
    via: Literal["tree"] = "tree"
    length_m: float = 0.0


class PlanResponse(BaseModel):
    steiner_tree: SteinerTreeOut
    terminals: list[TerminalResultOut] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    total_length_m: float = 0.0
    solver: Literal["geosteiner", "steinerpy"]


class SteinerPyStatusOut(BaseModel):
    available: bool
    package: str = "steinerpy"
    homepage: str = "https://github.com/berendmarkhorst/SteinerPy"
    install_hint: str = "pip install steinerpy"


class GeoSteinerStatusOut(BaseModel):
    available: bool
    bin_dir: str | None = None
    efst: str | None = None
    bb: str | None = None
    runtime_path: str | None = None
    homepage: str = "https://geosteiner.net/"
    install_hint: str = (
        "Windows: winget install MSYS2.MSYS2, then "
        "powershell -ExecutionPolicy Bypass -File scripts/build_geosteiner.ps1. "
        "Linux/macOS: bash scripts/build_geosteiner.sh."
    )


class ReadinessOut(BaseModel):
    status: Literal["ok", "not_ready"]
    steinerpy: bool
    geosteiner: bool
