"""POI update/delete and analysis endpoints on map module."""

from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import JSONResponse
from sqlalchemy import cast, delete, or_, select, String, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.api.v1.map_deps import (
    get_infra_object,
    get_layer,
    get_or_create_default_layer,
    get_poi,
    get_user_project,
    require_infra_write,
    require_project_write,
)
from app.core.database import get_db
from app.models import User

from app.geo.geometry_utils import point_wkt
from app.models import PoiInfrastructureAnalysis
from app.schemas import AnalysisOverrideUpdate, CandidateResponse, POIUpdate
from app.services.analysis_override import patch_analysis_subtype
from app.services.infrastructure_analysis import build_enriched_analysis_from_db
from app.services.serializers import poi_to_response
from app.services.spatial import list_candidates_by_subtype

poi_router = APIRouter(tags=["map-poi"])

@poi_router.patch("/projects/{project_id}/pois/{poi_id}", response_model=dict)
async def update_poi(
    project_id: UUID,
    poi_id: UUID,
    data: POIUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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


@poi_router.delete("/projects/{project_id}/pois/{poi_id}", status_code=204)
async def delete_poi(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_project_write(project_id, user, db)
    poi = await get_poi(poi_id, project_id, db)
    await db.delete(poi)
    await db.commit()


@poi_router.get("/projects/{project_id}/pois/{poi_id}/analysis")
async def get_poi_analysis(
    project_id: UUID,
    poi_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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


@poi_router.patch("/projects/{project_id}/pois/{poi_id}/analysis/{subtype}")
async def patch_analysis_override(
    project_id: UUID,
    poi_id: UUID,
    subtype: str,
    data: AnalysisOverrideUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
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
