"""POI update/delete and analysis endpoints on map module."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import User
from app.schemas import (
    AnalysisOverrideUpdate,
    CandidateResponse,
    PoiCostRatesResponse,
    PoiCostRatesUpdate,
    PoiDistanceSettingsResponse,
    PoiDistanceSettingsUpdate,
    PoiEconomicParamsResponse,
    PoiEconomicParamsUpdate,
    POIUpdate,
)
from app.services.map_poi.api_handlers import (
    handle_delete_poi,
    handle_get_candidates,
    handle_get_poi_analysis,
    handle_get_poi_distance_settings,
    handle_get_poi_economic_params,
    handle_get_poi_rates,
    handle_patch_analysis_override,
    handle_update_poi,
    handle_update_poi_distance_settings,
    handle_update_poi_economic_params,
    handle_update_poi_rates,
)

poi_router = APIRouter(tags=["map-poi"])


@poi_router.get("/projects/{project_id}/pois/{poi_id}/rates", response_model=PoiCostRatesResponse)
async def get_poi_rates(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_poi_rates(project_id, poi_id, user, db)


@poi_router.put("/projects/{project_id}/pois/{poi_id}/rates", response_model=PoiCostRatesResponse)
async def update_poi_rates(
    project_id: UUID,
    poi_id: UUID,
    data: PoiCostRatesUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_poi_rates(project_id, poi_id, data, user, db)


@poi_router.get(
    "/projects/{project_id}/pois/{poi_id}/economic-params",
    response_model=PoiEconomicParamsResponse,
)
async def get_poi_economic_params(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_poi_economic_params(project_id, poi_id, user, db)


@poi_router.put(
    "/projects/{project_id}/pois/{poi_id}/economic-params",
    response_model=PoiEconomicParamsResponse,
)
async def update_poi_economic_params(
    project_id: UUID,
    poi_id: UUID,
    data: PoiEconomicParamsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_poi_economic_params(project_id, poi_id, data, user, db)


@poi_router.get(
    "/projects/{project_id}/pois/{poi_id}/distance-settings",
    response_model=PoiDistanceSettingsResponse,
)
async def get_poi_distance_settings(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_poi_distance_settings(project_id, poi_id, user, db)


@poi_router.put(
    "/projects/{project_id}/pois/{poi_id}/distance-settings",
    response_model=PoiDistanceSettingsResponse,
)
async def update_poi_distance_settings(
    project_id: UUID,
    poi_id: UUID,
    data: PoiDistanceSettingsUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_poi_distance_settings(project_id, poi_id, data, user, db)


@poi_router.patch("/projects/{project_id}/pois/{poi_id}", response_model=dict)
async def update_poi(
    project_id: UUID,
    poi_id: UUID,
    data: POIUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_update_poi(project_id, poi_id, data, user, db)


@poi_router.delete("/projects/{project_id}/pois/{poi_id}", status_code=204)
async def delete_poi(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await handle_delete_poi(project_id, poi_id, user, db)


@poi_router.get("/projects/{project_id}/pois/{poi_id}/analysis")
async def get_poi_analysis(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_poi_analysis(project_id, poi_id, user, db)


@poi_router.get("/projects/{project_id}/pois/{poi_id}/candidates", response_model=list[CandidateResponse])
async def get_candidates(
    project_id: UUID,
    poi_id: UUID,
    subtype: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    nearest_policy: str = Query("point_on_line", description="point_on_line | network_node"),
    param_type: str | None = Query(None, description="external | external_linear"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_get_candidates(
        project_id,
        poi_id,
        user,
        db,
        subtype=subtype,
        limit=limit,
        nearest_policy=nearest_policy,
        param_type=param_type,
    )


@poi_router.patch("/projects/{project_id}/pois/{poi_id}/analysis/{subtype}")
async def patch_analysis_override(
    project_id: UUID,
    poi_id: UUID,
    subtype: str,
    data: AnalysisOverrideUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await handle_patch_analysis_override(project_id, poi_id, subtype, data, user, db)
