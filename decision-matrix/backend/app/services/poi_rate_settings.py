"""Resolve and persist per-POI rate settings (CAPEX, OPEX, distances)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PointOfInterest, ProjectCostRates, ProjectDistanceDefaults, ProjectEconomicParams
from app.schemas import DistanceDefaultsResponse
from app.services.analysis.compute import resolve_distance_defaults
from app.services.cost_rates import merge_project_cost_rates, resolve_cost_rates
from app.services.economic_rates import merge_economic_params, resolve_economic_params

POI_DISTANCE_FIELDS = (
    "threshold_gas_processing_km",
    "threshold_gtes_km",
    "threshold_substation_km",
    "threshold_refinery_km",
    "threshold_ground_pumping_station_km",
    "threshold_sand_quarry_km",
    "max_total_line_autoroad_km",
    "max_total_line_oil_pipeline_km",
    "max_total_line_gas_pipeline_km",
    "max_total_line_water_pipeline_km",
    "max_total_line_power_line_km",
    "max_total_line_methanol_pipeline_km",
    "max_total_line_additional_line_km",
    "km_per_pad_autoroad",
    "km_per_pad_oil_pipeline",
    "km_per_pad_gas_pipeline",
    "km_per_pad_water_pipeline",
    "km_per_pad_power_line",
)


async def load_project_cost_rates(db: AsyncSession, project_id: UUID) -> dict[str, float]:
    row = await db.scalar(select(ProjectCostRates).where(ProjectCostRates.project_id == project_id))
    return merge_project_cost_rates(row.rates if row else None)


async def load_project_economic_params(db: AsyncSession, project_id: UUID) -> dict[str, float]:
    row = await db.scalar(
        select(ProjectEconomicParams).where(ProjectEconomicParams.project_id == project_id)
    )
    return merge_economic_params(row.params if row else None)


async def load_project_distance_defaults(
    db: AsyncSession, project_id: UUID
) -> ProjectDistanceDefaults | None:
    return await db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id)
    )


def project_distance_template(defaults: ProjectDistanceDefaults | None) -> dict[str, float]:
    if defaults:
        return DistanceDefaultsResponse.model_validate(defaults).model_dump()
    from types import SimpleNamespace

    blank = SimpleNamespace(**{field: None for field in POI_DISTANCE_FIELDS})
    return resolve_distance_defaults(blank, None)  # type: ignore[arg-type]


def effective_poi_cost_rates(
    project_rates: dict[str, float], poi: PointOfInterest
) -> dict[str, float]:
    return resolve_cost_rates(project_rates, poi.cost_rates)


def effective_poi_economic_params(
    project_params: dict[str, float], poi: PointOfInterest
) -> dict[str, float]:
    return resolve_economic_params(project_params, poi.economic_params)


def effective_poi_distance_settings(
    poi: PointOfInterest, defaults: ProjectDistanceDefaults | None
) -> dict[str, float]:
    return resolve_distance_defaults(poi, defaults)


def apply_effective_distance_settings(
    poi: PointOfInterest,
    defaults: ProjectDistanceDefaults | None,
    effective: dict[str, float],
) -> None:
    template = project_distance_template(defaults)
    for field in POI_DISTANCE_FIELDS:
        value = effective.get(field)
        if value is None:
            continue
        project_val = template[field]
        setattr(poi, field, None if value == project_val else value)


def clear_poi_distance_overrides(poi: PointOfInterest) -> None:
    for field in POI_DISTANCE_FIELDS:
        setattr(poi, field, None)
