"""Anti-collision clearance orchestration for project and pad scope."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureLayer, InfrastructureObject
from app.services.well_trajectory.clearance_coords import (
    ClearanceCollection,
    ProjectWellMeta,
    all_pair_indices,
    collect_project_wells_for_clearance,
    intra_pad_pair_indices,
)
from app.services.well_trajectory.planner_bridge import planner_schemas
from app.services.well_trajectory.schemas import WellTrajectoryClearanceResponse
from app.services.well_trajectory.settings_store import well_trajectory_settings_for_pad
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import (
    read_clearance_computed_at,
    read_clearance_pairs_json,
    read_trajectories_json,
    store_clearance_results,
    store_trajectories_json,
)
from app.subtype_manifest import PAD_CLUSTER_SUBTYPES

CLEARANCE_SYNC_MAX_WELLS = 12


async def fetch_project_pads(db: AsyncSession, project_id: UUID) -> list[InfrastructureObject]:
    result = await db.execute(
        select(InfrastructureObject)
        .join(InfrastructureLayer)
        .where(
            InfrastructureLayer.project_id == project_id,
            InfrastructureObject.subtype.in_(PAD_CLUSTER_SUBTYPES),
        )
    )
    return list(result.scalars().all())


def _resolve_threshold(pads: list[InfrastructureObject]) -> float:
    for pad in pads:
        trajectories = read_trajectories_json(pad.properties)
        if trajectories:
            return well_trajectory_settings_for_pad(pad).sf_warning_threshold
    return 1.0


def count_valid_clearance_wells(pads: list[InfrastructureObject]) -> int:
    collection = collect_project_wells_for_clearance(pads)
    return len(collection.surveys)


def _validate_collection(collection: ClearanceCollection) -> None:
    if len(collection.surveys) < 2:
        detail = "Need at least 2 wells with survey ≥ 2 stations for clearance"
        if collection.skips:
            detail += f"; skipped: {'; '.join(collection.skips[:8])}"
        raise HTTPException(status_code=400, detail=detail)


def _pair_record(
    meta_a: ProjectWellMeta,
    meta_b: ProjectWellMeta,
    *,
    min_sf: float,
    warning: bool,
) -> dict[str, Any]:
    return {
        "well_a": meta_a.well_index,
        "well_a_pad_id": str(meta_a.pad_id),
        "well_a_pad_name": meta_a.pad_name,
        "well_b": meta_b.well_index,
        "well_b_pad_id": str(meta_b.pad_id),
        "well_b_pad_name": meta_b.pad_name,
        "min_sf": min_sf,
        "warning": warning,
    }


def _apply_clearance_to_pads(
    pads: list[InfrastructureObject],
    *,
    meta: list[ProjectWellMeta],
    pair_results: list[Any],
    computed_at: str,
    threshold: float,
) -> WellTrajectoryClearanceResponse:
    """Distribute pair results and per-well min_sf to pad properties (in-memory)."""
    pairs_by_pad: dict[UUID, list[dict[str, Any]]] = {p.id: [] for p in pads}
    seen_pair_keys: dict[UUID, set[tuple[Any, ...]]] = {p.id: set() for p in pads}
    well_min_sf: dict[str, float] = {}

    response_pairs: list[dict[str, Any]] = []
    for pr in pair_results:
        ma = meta[pr.well_a]
        mb = meta[pr.well_b]
        record = _pair_record(ma, mb, min_sf=pr.min_sf, warning=pr.warning)
        response_pairs.append(record)
        pair_key = (
            min(ma.well_index, mb.well_index),
            max(ma.well_index, mb.well_index),
            str(min(ma.pad_id, mb.pad_id)),
            str(max(ma.pad_id, mb.pad_id)),
        )
        for pad_id in (ma.pad_id, mb.pad_id):
            if pad_id not in seen_pair_keys:
                continue
            if pair_key in seen_pair_keys[pad_id]:
                continue
            seen_pair_keys[pad_id].add(pair_key)
            pairs_by_pad.setdefault(pad_id, []).append(record)
        for m in (ma, mb):
            prev = well_min_sf.get(m.well_key)
            if prev is None or pr.min_sf < prev:
                well_min_sf[m.well_key] = pr.min_sf

    for pad in pads:
        trajectories = read_trajectories_json(pad.properties)
        if not trajectories:
            continue
        changed = False
        for idx, well in enumerate(trajectories):
            if not isinstance(well, dict):
                continue
            well_key = f"{pad.id}:{well.get('well_index', idx)}"
            if well_key not in well_min_sf:
                continue
            updated = dict(well)
            updated["clearance"] = {"min_sf": well_min_sf[well_key], "computed_at": computed_at}
            trajectories[idx] = updated
            changed = True
        if changed:
            pad.properties = store_trajectories_json(pad.properties, trajectories)
        pad_pairs = pairs_by_pad.get(pad.id) or []
        if pad_pairs or read_clearance_pairs_json(pad.properties):
            pad.properties = store_clearance_results(
                pad.properties,
                pairs=pad_pairs,
                computed_at=computed_at,
            )

    warnings: list[str] = []
    for p in response_pairs:
        if p["warning"]:
            warnings.append(
                f"SF {p['min_sf']:.2f} < {threshold}: "
                f"{p['well_a_pad_name']} скв.{p['well_a'] + 1} ↔ "
                f"{p['well_b_pad_name']} скв.{p['well_b'] + 1}"
            )

    return WellTrajectoryClearanceResponse(
        pairs=response_pairs,
        computed_at=computed_at,
        wells_count=len(meta),
        pairs_count=len(response_pairs),
        threshold=threshold,
        warnings=warnings,
    )


def _run_clearance(
    collection: ClearanceCollection,
    *,
    pair_indices: list[list[int]],
    threshold: float,
    pads: list[InfrastructureObject],
) -> WellTrajectoryClearanceResponse:
    _validate_collection(collection)
    if not pair_indices:
        raise HTTPException(status_code=400, detail="No clearance pairs to compute")

    schemas = planner_schemas()
    surveys = [schemas.ClearanceSurveyIn.model_validate(s) for s in collection.surveys]
    adapter = get_well_trajectory_adapter()
    result = adapter.clearance_pairs(
        schemas.ClearancePairsRequest(
            surveys=surveys,
            pairs=pair_indices,
            method="iscwsa",
            threshold=threshold,
        )
    )
    computed_at = datetime.now(UTC).isoformat()
    return _apply_clearance_to_pads(
        pads,
        meta=collection.meta,
        pair_results=result.pairs,
        computed_at=computed_at,
        threshold=threshold,
    )


async def run_clearance_for_project(
    db: AsyncSession,
    project_id: UUID,
    *,
    threshold: float | None = None,
) -> WellTrajectoryClearanceResponse:
    pads = await fetch_project_pads(db, project_id)
    eff_threshold = threshold if threshold is not None else _resolve_threshold(pads)
    collection = collect_project_wells_for_clearance(pads)
    pair_indices = all_pair_indices(len(collection.surveys))
    return _run_clearance(
        collection,
        pair_indices=pair_indices,
        threshold=eff_threshold,
        pads=pads,
    )


async def run_clearance_for_pad(
    db: AsyncSession,
    project_id: UUID,
    pad_id: UUID,
    *,
    threshold: float | None = None,
) -> WellTrajectoryClearanceResponse:
    pads = await fetch_project_pads(db, project_id)
    pad = next((p for p in pads if p.id == pad_id), None)
    if pad is None:
        raise HTTPException(status_code=404, detail="Pad not found")
    eff_threshold = threshold if threshold is not None else well_trajectory_settings_for_pad(pad).sf_warning_threshold
    collection = collect_project_wells_for_clearance(pads, pad_filter=pad_id)
    pair_indices = intra_pad_pair_indices(collection.meta)
    return _run_clearance(
        collection,
        pair_indices=pair_indices,
        threshold=eff_threshold,
        pads=[pad],
    )
