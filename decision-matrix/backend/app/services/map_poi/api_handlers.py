"""HTTP orchestration for map POI BFF."""

from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_poi, get_user_project, require_project_write
from app.geo.geometry_utils import point_wkt
from app.models import PoiInfrastructureAnalysis, User
from app.schemas import (
    AnalysisOverrideUpdate,
    CandidateResponse,
    DistanceDefaultsResponse,
    PoiCostRatesResponse,
    PoiCostRatesUpdate,
    PoiDistanceSettingsResponse,
    PoiDistanceSettingsUpdate,
    PoiEconomicParamsResponse,
    PoiEconomicParamsUpdate,
    POIUpdate,
)
from app.services.analysis_override import patch_analysis_subtype
from app.services.cost_rates import sparse_rate_overrides
from app.services.economic_rates import sparse_economic_overrides
from app.services.infrastructure_analysis import build_enriched_analysis_from_db
from app.services.poi_rate_settings import (
    apply_effective_distance_settings,
    clear_poi_distance_overrides,
    effective_poi_cost_rates,
    effective_poi_distance_settings,
    effective_poi_economic_params,
    load_project_cost_rates,
    load_project_distance_defaults,
    load_project_economic_params,
)
from app.services.serializers import poi_to_response
from app.services.spatial import list_candidates_by_subtype


async def handle_get_poi_rates(
    project_id: UUID,
    poi_id: UUID,
    user: User,
    db: AsyncSession,
) -> PoiCostRatesResponse:
    await get_user_project(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    project_rates = await load_project_cost_rates(db, project_id)
    return PoiCostRatesResponse(
        poi_id=poi.id,
        rates=effective_poi_cost_rates(project_rates, poi),
        overrides=poi.cost_rates,
    )


async def handle_update_poi_rates(
    project_id: UUID,
    poi_id: UUID,
    data: PoiCostRatesUpdate,
    user: User,
    db: AsyncSession,
) -> PoiCostRatesResponse:
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    project_rates = await load_project_cost_rates(db, project_id)
    if data.rates is None:
        poi.cost_rates = None
    else:
        poi.cost_rates = sparse_rate_overrides(data.rates, project_rates)
    await db.commit()
    await db.refresh(poi)
    return PoiCostRatesResponse(
        poi_id=poi.id,
        rates=effective_poi_cost_rates(project_rates, poi),
        overrides=poi.cost_rates,
    )


async def handle_get_poi_economic_params(
    project_id: UUID,
    poi_id: UUID,
    user: User,
    db: AsyncSession,
) -> PoiEconomicParamsResponse:
    await get_user_project(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    project_params = await load_project_economic_params(db, project_id)
    return PoiEconomicParamsResponse(
        poi_id=poi.id,
        params=effective_poi_economic_params(project_params, poi),
        overrides=poi.economic_params,
    )


async def handle_update_poi_economic_params(
    project_id: UUID,
    poi_id: UUID,
    data: PoiEconomicParamsUpdate,
    user: User,
    db: AsyncSession,
) -> PoiEconomicParamsResponse:
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    project_params = await load_project_economic_params(db, project_id)
    if data.params is None:
        poi.economic_params = None
    else:
        poi.economic_params = sparse_economic_overrides(data.params, project_params)
    await db.commit()
    await db.refresh(poi)
    return PoiEconomicParamsResponse(
        poi_id=poi.id,
        params=effective_poi_economic_params(project_params, poi),
        overrides=poi.economic_params,
    )


async def handle_get_poi_distance_settings(
    project_id: UUID,
    poi_id: UUID,
    user: User,
    db: AsyncSession,
) -> PoiDistanceSettingsResponse:
    await get_user_project(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    defaults = await load_project_distance_defaults(db, project_id)
    effective = effective_poi_distance_settings(poi, defaults)
    return PoiDistanceSettingsResponse(
        poi_id=poi.id,
        settings=DistanceDefaultsResponse.model_validate(effective),
    )


async def handle_update_poi_distance_settings(
    project_id: UUID,
    poi_id: UUID,
    data: PoiDistanceSettingsUpdate,
    user: User,
    db: AsyncSession,
) -> PoiDistanceSettingsResponse:
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    defaults = await load_project_distance_defaults(db, project_id)
    if data.clear:
        clear_poi_distance_overrides(poi)
    else:
        payload = data.model_dump(exclude_unset=True, exclude={"clear"})
        if not payload:
            raise HTTPException(status_code=400, detail="No distance settings provided")
        current = effective_poi_distance_settings(poi, defaults)
        current.update(payload)
        apply_effective_distance_settings(poi, defaults, current)
    await db.commit()
    await db.refresh(poi)
    effective = effective_poi_distance_settings(poi, defaults)
    return PoiDistanceSettingsResponse(
        poi_id=poi.id,
        settings=DistanceDefaultsResponse.model_validate(effective),
    )


async def handle_update_poi(
    project_id: UUID,
    poi_id: UUID,
    data: POIUpdate,
    user: User,
    db: AsyncSession,
) -> dict:
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    payload = data.model_dump(exclude_unset=True)
    if "lon" in payload or "lat" in payload:
        lon = payload.get("lon", poi.longitude)
        lat = payload.get("lat", poi.latitude)
        poi.longitude = lon
        poi.latitude = lat
        poi.geometry = point_wkt(lon, lat)
        payload.pop("lon", None)
        payload.pop("lat", None)
    for field, value in payload.items():
        setattr(poi, field, value)
    await db.commit()
    await db.refresh(poi)
    return poi_to_response(poi).model_dump()


async def handle_delete_poi(
    project_id: UUID,
    poi_id: UUID,
    user: User,
    db: AsyncSession,
) -> None:
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    await db.delete(poi)
    await db.commit()


async def handle_get_poi_analysis(
    project_id: UUID,
    poi_id: UUID,
    user: User,
    db: AsyncSession,
):
    await get_user_project(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    row_count = await db.scalar(
        select(PoiInfrastructureAnalysis.id)
        .where(PoiInfrastructureAnalysis.poi_id == poi.id)
        .limit(1)
    )
    if not row_count:
        raise HTTPException(status_code=404, detail="No analysis found. Run POST .../analyze first.")
    return await build_enriched_analysis_from_db(db, project_id, poi)


async def handle_get_candidates(
    project_id: UUID,
    poi_id: UUID,
    user: User,
    db: AsyncSession,
    *,
    subtype: str,
    limit: int = 20,
    nearest_policy: str = "point_on_line",
    param_type: str | None = None,
) -> list[CandidateResponse]:
    await get_user_project(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    st = subtype.lower()
    if param_type == "external_linear":
        from app.services.spatial import list_external_linear_candidates

        candidates = await list_external_linear_candidates(db, project_id, poi, st, limit)
    else:
        candidates = await list_candidates_by_subtype(
            db, project_id, poi, st, limit, nearest_policy=nearest_policy
        )
    return [
        CandidateResponse(
            object_id=c.object_id,
            nearest_node_id=c.nearest_node_id,
            name=c.name,
            distance_km=round(c.distance_km, 2),
            anchor_lon=c.anchor_lon,
            anchor_lat=c.anchor_lat,
            anchor_type=c.anchor_type,
        )
        for c in candidates
    ]


async def handle_patch_analysis_override(
    project_id: UUID,
    poi_id: UUID,
    subtype: str,
    data: AnalysisOverrideUpdate,
    user: User,
    db: AsyncSession,
):
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    if data.force_construction is None and not data.nearest_object_id and not data.nearest_node_id:
        raise HTTPException(
            status_code=400,
            detail="Provide nearest_object_id, nearest_node_id, or force_construction",
        )
    try:
        await patch_analysis_subtype(
            db,
            project_id,
            poi,
            subtype,
            nearest_object_id=data.nearest_object_id,
            nearest_node_id=data.nearest_node_id,
            force_construction=data.force_construction,
            param_type=data.param_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    await db.commit()
    return await build_enriched_analysis_from_db(db, project_id, poi)
