"""One-pager (management report) API — FR-11."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import OnePager, PointOfInterest, Project, User
from app.models.enums import AccessLevel
from app.schemas import OnePagerCreate, OnePagerExportPptxRequest, OnePagerResponse, OnePagerUpdate
from app.services.one_pager_builder import build_one_pager_snapshot
from app.services.one_pager_pptx import generate_one_pager_pptx
from app.services.project_access import resolve_project

one_pagers_router = APIRouter()


async def _project(project_id: UUID, user: User, db: AsyncSession, *, write: bool = False) -> Project:
    return await resolve_project(
        project_id,
        user,
        db,
        min_access=AccessLevel.write if write else AccessLevel.read,
    )


async def _one_pager_or_404(project_id: UUID, op_id: UUID, db: AsyncSession) -> OnePager:
    op = await db.get(OnePager, op_id)
    if not op or op.project_id != project_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One-pager not found")
    return op


async def _enrich_response(db: AsyncSession, op: OnePager) -> OnePagerResponse:
    poi = await db.get(PointOfInterest, op.poi_id)
    return OnePagerResponse(
        id=op.id,
        project_id=op.project_id,
        poi_id=op.poi_id,
        title=op.title,
        coordinates=op.coordinates,
        engineer_name=op.engineer_name,
        report_date=op.report_date,
        final_variant_data=op.final_variant_data or {},
        engineering_params=op.engineering_params or {},
        roadmap=op.roadmap or [],
        recommendation_text=op.recommendation_text,
        is_recommendation_edited=op.is_recommendation_edited,
        generation_status=op.generation_status,
        poi_name=poi.name if poi else None,
        created_at=op.created_at,
        updated_at=op.updated_at,
    )


@one_pagers_router.get("/projects/{project_id}/one-pagers", response_model=list[OnePagerResponse])
async def list_one_pagers(
    project_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    rows = (
        await db.execute(
            select(OnePager).where(OnePager.project_id == project_id).order_by(OnePager.created_at.desc())
        )
    ).scalars().all()
    return [await _enrich_response(db, op) for op in rows]


@one_pagers_router.post("/projects/{project_id}/one-pagers", response_model=OnePagerResponse, status_code=201)
async def create_one_pager(
    project_id: UUID,
    data: OnePagerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, write=True)
    engineer = data.engineer_name or user.username
    snapshot = await build_one_pager_snapshot(
        db,
        project_id,
        data.poi_id,
        engineer_name=engineer,
        roadmap=data.roadmap,
        recommendation_text=data.recommendation_text,
    )
    op = OnePager(
        project_id=project_id,
        poi_id=data.poi_id,
        title=snapshot["title"],
        coordinates=snapshot["coordinates"],
        engineer_name=snapshot["engineer_name"],
        report_date=snapshot["report_date"],
        final_variant_data=snapshot["final_variant_data"],
        engineering_params=snapshot["engineering_params"],
        roadmap=snapshot["roadmap"],
        recommendation_text=snapshot["recommendation_text"],
        is_recommendation_edited=snapshot["is_recommendation_edited"],
        map_snapshot_base64=data.map_snapshot_base64,
        generation_status="pending",
    )
    db.add(op)
    await db.commit()
    await db.refresh(op)
    return await _enrich_response(db, op)


@one_pagers_router.get("/projects/{project_id}/one-pagers/{op_id}", response_model=OnePagerResponse)
async def get_one_pager(
    project_id: UUID,
    op_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db)
    op = await _one_pager_or_404(project_id, op_id, db)
    return await _enrich_response(db, op)


@one_pagers_router.put("/projects/{project_id}/one-pagers/{op_id}", response_model=OnePagerResponse)
async def update_one_pager(
    project_id: UUID,
    op_id: UUID,
    data: OnePagerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, write=True)
    op = await _one_pager_or_404(project_id, op_id, db)
    if data.recommendation_text is not None:
        op.recommendation_text = data.recommendation_text
        op.is_recommendation_edited = True
    if data.roadmap is not None:
        op.roadmap = data.roadmap
    if data.map_snapshot_base64 is not None:
        op.map_snapshot_base64 = data.map_snapshot_base64
    if data.engineer_name is not None:
        op.engineer_name = data.engineer_name
    await db.commit()
    await db.refresh(op)
    return await _enrich_response(db, op)


@one_pagers_router.delete("/projects/{project_id}/one-pagers/{op_id}", status_code=204)
async def delete_one_pager(
    project_id: UUID,
    op_id: UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, write=True)
    op = await _one_pager_or_404(project_id, op_id, db)
    await db.delete(op)
    await db.commit()


@one_pagers_router.post("/projects/{project_id}/one-pagers/{op_id}/export/pptx")
async def export_one_pager_pptx(
    project_id: UUID,
    op_id: UUID,
    body: OnePagerExportPptxRequest | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _project(project_id, user, db, write=True)
    op = await _one_pager_or_404(project_id, op_id, db)
    if body and body.map_snapshot_base64:
        op.map_snapshot_base64 = body.map_snapshot_base64
    op.generation_status = "pending"
    await db.flush()
    try:
        path = generate_one_pager_pptx(op)
        op.pptx_file_path = str(path)
        op.generation_status = "ready"
        await db.commit()
    except Exception as exc:
        op.generation_status = "error"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"PPTX generation failed: {exc}") from exc
    filename = f"one-pager-{op.poi_id}.pptx"
    return FileResponse(path, media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation", filename=filename)
