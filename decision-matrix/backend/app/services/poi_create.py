"""POI creation with project distance defaults applied."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.geometry_utils import point_wkt
from app.models import PointOfInterest, ProjectDistanceDefaults
from app.schemas import POICreate


async def create_poi_for_project(
    db: AsyncSession,
    project_id: UUID,
    data: POICreate,
    *,
    commit: bool = True,
) -> PointOfInterest:
    defaults = await db.scalar(
        select(ProjectDistanceDefaults).where(ProjectDistanceDefaults.project_id == project_id)
    )
    poi = PointOfInterest(
        project_id=project_id,
        name=data.name,
        description=data.description,
        geometry=point_wkt(data.lon, data.lat),
        longitude=data.lon,
        latitude=data.lat,
        planned_production_volume=data.planned_production_volume,
        production_per_well=data.production_per_well,
        wells_per_pad=data.wells_per_pad,
        fluid_type=data.fluid_type,
        water_injection_volume=data.water_injection_volume,
        gas_factor=data.gas_factor,
        eng_power=data.eng_power,
        eng_injection=data.eng_injection,
        eng_gas=data.eng_gas,
        eng_oil_preparation=data.eng_oil_preparation,
        eng_well_gathering=data.eng_well_gathering,
        eng_transport=data.eng_transport,
    )
    if defaults:
        poi.threshold_gas_processing_km = defaults.threshold_gas_processing_km
        poi.threshold_gtes_km = defaults.threshold_gtes_km
        poi.threshold_substation_km = defaults.threshold_substation_km
        poi.threshold_refinery_km = defaults.threshold_refinery_km
        poi.max_total_line_autoroad_km = defaults.max_total_line_autoroad_km
        poi.max_total_line_oil_pipeline_km = defaults.max_total_line_oil_pipeline_km
        poi.max_total_line_gas_pipeline_km = defaults.max_total_line_gas_pipeline_km
        poi.max_total_line_water_pipeline_km = defaults.max_total_line_water_pipeline_km
        poi.max_total_line_power_line_km = defaults.max_total_line_power_line_km
        poi.km_per_pad_autoroad = defaults.km_per_pad_autoroad
        poi.km_per_pad_oil_pipeline = defaults.km_per_pad_oil_pipeline
        poi.km_per_pad_gas_pipeline = defaults.km_per_pad_gas_pipeline
        poi.km_per_pad_water_pipeline = defaults.km_per_pad_water_pipeline
        poi.km_per_pad_power_line = defaults.km_per_pad_power_line
    db.add(poi)
    await db.flush()
    if commit:
        await db.commit()
        await db.refresh(poi)
    return poi
