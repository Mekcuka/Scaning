"""Pydantic schemas for line elevation profile API."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class LineProfilePointOut(BaseModel):
    chainage_m: float
    lon: float
    lat: float
    elevation_m: float


class LineElevationProfileOut(BaseModel):
    step_m: float
    computed_at: datetime
    dem_source: str
    total_length_m: float
    points: list[LineProfilePointOut]


class LineElevationProfileComputeOut(BaseModel):
    computed_count: int
    points_updated_count: int = 0
    dem_fetched: bool
    dem_reused: bool
    errors: list[str] = Field(default_factory=list)
