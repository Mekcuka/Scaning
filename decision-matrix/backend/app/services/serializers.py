"""API response builders for map entities."""

from typing import Any
from uuid import UUID

from app.core.json_public import json_public_roundtrip

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES
from app.geo.geometry_utils import geometry_to_wkt_str, parse_linestring_wkt
from app.models import InfrastructureObject, PointOfInterest, Project, User
from app.schemas import AnalysisRowResponse, InfraObjectResponse, POIResponse, ProjectResponse
from app.services.calculations import calc_pads_count, calc_wells_total


def _owner_display_name(owner: User | None) -> str:
    if not owner:
        return "—"
    return owner.username or owner.email


def project_to_response(project: Project, *, poi_count: int, owner: User | None = None) -> ProjectResponse:
    return ProjectResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        visibility=project.visibility,
        poi_count=poi_count,
        owner_user_id=project.user_id,
        owner_name=_owner_display_name(owner),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


async def load_project_owners(db: AsyncSession, projects: list[Project]) -> dict[UUID, User]:
    owner_ids = {p.user_id for p in projects}
    if not owner_ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(owner_ids)))
    return {u.id: u for u in result.scalars().all()}


def poi_to_response(poi: PointOfInterest) -> POIResponse:
    volume = float(poi.planned_production_volume or 0)
    per_well = float(poi.production_per_well or 10)
    wells_per_pad = int(poi.wells_per_pad or 4)
    pads = calc_pads_count(volume, per_well, wells_per_pad)
    wells = calc_wells_total(volume, per_well)
    return POIResponse(
        id=poi.id,
        project_id=poi.project_id,
        name=poi.name,
        description=poi.description,
        lon=float(poi.longitude),
        lat=float(poi.latitude),
        planned_production_volume=volume,
        production_per_well=per_well,
        wells_per_pad=wells_per_pad,
        fluid_type=poi.fluid_type,
        water_injection_volume=poi.water_injection_volume,
        gas_factor=poi.gas_factor if poi.gas_factor is not None else 120.0,
        eng_power=poi.eng_power,
        eng_injection=poi.eng_injection,
        eng_gas=poi.eng_gas,
        eng_oil_preparation=poi.eng_oil_preparation,
        eng_well_gathering=poi.eng_well_gathering,
        eng_transport=poi.eng_transport,
        pads_count=pads,
        wells_total=wells,
        threshold_gas_processing_km=poi.threshold_gas_processing_km,
        threshold_gtes_km=poi.threshold_gtes_km,
        threshold_substation_km=poi.threshold_substation_km,
        threshold_refinery_km=poi.threshold_refinery_km,
        threshold_ground_pumping_station_km=poi.threshold_ground_pumping_station_km,
        threshold_sand_quarry_km=poi.threshold_sand_quarry_km,
        max_total_line_autoroad_km=poi.max_total_line_autoroad_km,
        max_total_line_oil_pipeline_km=poi.max_total_line_oil_pipeline_km,
        max_total_line_gas_pipeline_km=poi.max_total_line_gas_pipeline_km,
        max_total_line_water_pipeline_km=poi.max_total_line_water_pipeline_km,
        max_total_line_power_line_km=poi.max_total_line_power_line_km,
        max_total_line_methanol_pipeline_km=poi.max_total_line_methanol_pipeline_km,
        max_total_line_additional_line_km=poi.max_total_line_additional_line_km,
        cost_rates=poi.cost_rates,
        economic_params=poi.economic_params,
        km_per_pad_autoroad=poi.km_per_pad_autoroad,
        km_per_pad_oil_pipeline=poi.km_per_pad_oil_pipeline,
        km_per_pad_gas_pipeline=poi.km_per_pad_gas_pipeline,
        km_per_pad_water_pipeline=poi.km_per_pad_water_pipeline,
        km_per_pad_power_line=poi.km_per_pad_power_line,
    )


def _infra_line_coordinates(obj: InfrastructureObject) -> list[list[float]] | None:
    if obj.subtype not in LINE_SUBTYPES:
        return None
    props = obj.properties or {}
    raw = props.get("coordinates")
    if isinstance(raw, list) and len(raw) >= 2:
        return [[float(c[0]), float(c[1])] for c in raw]
    parsed = parse_linestring_wkt(geometry_to_wkt_str(obj.geometry))
    if parsed:
        return parsed
    if obj.end_longitude is not None and obj.end_latitude is not None:
        return [[obj.longitude, obj.latitude], [obj.end_longitude, obj.end_latitude]]
    return None


def infra_to_response(obj: InfrastructureObject) -> InfraObjectResponse:
    from app.geo.constants import normalize_infra_subtype
    from app.geo.render_3d_properties import read_render_3d
    from app.schemas import Render3DEffective

    coords = _infra_line_coordinates(obj)
    subtype = normalize_infra_subtype(obj.subtype)
    props = obj.properties or {}
    r3d = read_render_3d(subtype, props)
    return InfraObjectResponse(
        id=obj.id,
        layer_id=obj.layer_id,
        name=obj.name,
        subtype=subtype,
        category=obj.category,
        lon=obj.longitude,
        lat=obj.latitude,
        end_lon=obj.end_longitude,
        end_lat=obj.end_latitude,
        coordinates=coords,
        properties=props,
        render_3d_effective=Render3DEffective(
            height_m=r3d.height_m,
            base_m=r3d.base_m,
            visible=r3d.visible,
            scale=r3d.scale,
        ),
    )


def infra_to_public_json(obj: InfrastructureObject) -> dict[str, Any]:
    """JSON-safe infra payload for HTTP responses.

    Deep PyWellGeo trees (long main-bore chains) exceed Pydantic's serialization
    depth guard on ``InfraObjectResponse.model_dump()``; stdlib ``json`` encodes them fine.
    """
    resp = infra_to_response(obj)
    payload: dict[str, Any] = {
        "id": str(resp.id),
        "layer_id": str(resp.layer_id),
        "name": resp.name,
        "subtype": resp.subtype,
        "category": resp.category,
        "lon": resp.lon,
        "lat": resp.lat,
        "end_lon": resp.end_lon,
        "end_lat": resp.end_lat,
        "coordinates": resp.coordinates,
        "properties": resp.properties,
    }
    if resp.render_3d_effective is not None:
        payload["render_3d_effective"] = resp.render_3d_effective.model_dump(mode="json")
    return json_public_roundtrip(payload)


async def load_infra_name(db: AsyncSession, object_id: UUID | None) -> str | None:
    if not object_id:
        return None
    obj = await db.get(InfrastructureObject, object_id)
    return obj.name if obj else None
