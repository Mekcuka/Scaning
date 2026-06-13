"""Pad placement compute orchestration."""

from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import InfrastructureObject
from app.services.pad_placement.evaluate import (
    evaluate_pad_group,
    sum_md_m_from_candidate,
    variant_is_invalid,
)
from app.services.pad_placement.normalize import normalize_bottomholes
from app.services.pad_placement.partition import (
    SYNC_MAX_PARTITIONS,
    SYNC_MAX_WELLS,
    estimate_partition_count,
    iter_partition_assignments,
    max_pad_count,
)
from app.services.pad_placement.placement import suggest_pad_center, violates_pad_spacing
from app.services.pad_placement.placement_optimize import find_best_pad_center
from app.services.pad_placement.result_cache import put
from app.services.pad_placement.schemas import (
    BottomholeSnapshot,
    PadPlacementComputeRequest,
    PadPlacementComputeResponse,
    PadPlacementParams,
    PadPlacementRequestResponse,
    PlacementVariantOut,
)
from app.services.pad_placement.score import rank_variants
from app.services.pad_placement.sf_score import score_variant_sf
from app.services.pad_placement.snapshot import fetch_existing_pads, load_bottomhole_snapshots


class PadPlacementComputeError(Exception):
    def __init__(self, detail: str, *, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


async def build_request_preview(
    db: AsyncSession,
    project_id: UUID,
    body: PadPlacementComputeRequest,
) -> PadPlacementRequestResponse:
    snapshots, load_warnings = await load_bottomhole_snapshots(
        db, project_id, body.bottomhole_ids
    )
    logical, norm_warnings = normalize_bottomholes(snapshots)
    n = len(logical)
    estimated = estimate_partition_count(n, body.params.max_wells_per_pad) if n else 0
    sync_allowed = n <= SYNC_MAX_WELLS and estimated <= SYNC_MAX_PARTITIONS
    warnings = load_warnings + norm_warnings
    if n == 0:
        warnings.append("No logical wells after normalization")
    return PadPlacementRequestResponse(
        request_id=uuid4(),
        logical_well_count=n,
        estimated_partitions=estimated,
        sync_allowed=sync_allowed,
        warnings=warnings,
    )


async def run_compute(
    db: AsyncSession,
    project_id: UUID,
    body: PadPlacementComputeRequest,
    *,
    request_id: UUID | None = None,
) -> PadPlacementComputeResponse:
    snapshots, load_warnings = await load_bottomhole_snapshots(
        db, project_id, body.bottomhole_ids
    )
    logical, norm_warnings = normalize_bottomholes(snapshots)
    n = len(logical)
    if n == 0:
        raise PadPlacementComputeError("No logical wells to optimize")

    estimated = estimate_partition_count(n, body.params.max_wells_per_pad)
    use_heuristic = n > SYNC_MAX_WELLS
    if not use_heuristic and estimated > SYNC_MAX_PARTITIONS:
        raise PadPlacementComputeError(
            f"Too many partition combinations ({estimated}); use async compute or reduce selection",
            status_code=400,
        )
    if use_heuristic and n > 20:
        raise PadPlacementComputeError(
            f"Too many wells ({n}); maximum 20 for pad placement",
            status_code=400,
        )

    existing_pads = await fetch_existing_pads(db, project_id)
    snapshots_by_id = {s.id: s for s in snapshots}
    warnings = load_warnings + norm_warnings
    variants: list[PlacementVariantOut] = []
    partitions_evaluated = 0

    for groups in iter_partition_assignments(
        logical,
        max_wells_per_pad=body.params.max_wells_per_pad,
        use_heuristic=use_heuristic,
    ):
        partitions_evaluated += 1
        if partitions_evaluated > SYNC_MAX_PARTITIONS and not use_heuristic:
            warnings.append(f"Stopped after {SYNC_MAX_PARTITIONS} partitions")
            break

        variant = _evaluate_partition(
            groups,
            snapshots_by_id=snapshots_by_id,
            params=body.params,
            subtype=body.subtype,
            existing_pads=existing_pads,
            variant_seq=len(variants),
        )
        if variant is None:
            continue
        if body.params.sf_check:
            variant = score_variant_sf(
                variant,
                existing_pads=existing_pads,
                params=body.params,
                subtype=body.subtype,
            )
        variants.append(variant)

    ranked = rank_variants(variants)[: body.params.top_k]
    rid = request_id or uuid4()
    response = PadPlacementComputeResponse(
        request_id=rid,
        logical_well_count=n,
        partitions_evaluated=partitions_evaluated,
        variants=ranked,
        warnings=warnings,
        computed_at=datetime.now(UTC),
    )
    put(rid, response, snapshots=snapshots, subtype=body.subtype, params=body.params, compute_request=body)
    return response


def _evaluate_partition(
    groups: list[list],
    *,
    snapshots_by_id: dict[UUID, BottomholeSnapshot],
    params: PadPlacementParams,
    subtype: str,
    existing_pads: list[InfrastructureObject],
    variant_seq: int,
) -> PlacementVariantOut | None:
    pad_candidates = []
    centers: list[tuple[float, float]] = []
    score_warnings: list[str] = []

    for pi, group in enumerate(groups):
        if not group:
            return None

        candidate_id = f"v{variant_seq}_p{pi}"
        if params.center_optimize:
            cand, opt_warnings = find_best_pad_center(
                group,
                params=params,
                snapshots_by_id=snapshots_by_id,
                subtype=subtype,
                candidate_id=candidate_id,
                existing_pads=existing_pads,
                other_centers=centers,
            )
            score_warnings.extend(opt_warnings)
            if cand is None:
                score_warnings.append(f"Pad {pi}: no valid center in search grid")
                return None
            clon, clat = cand.center_longitude, cand.center_latitude
        else:
            clon, clat = suggest_pad_center(group)
            if violates_pad_spacing(
                clon,
                clat,
                params=params,
                existing_pads=existing_pads,
                other_centers=centers,
            ):
                score_warnings.append(f"Pad {pi}: spacing violation at ({clon:.5f}, {clat:.5f})")
                return None
            cand = evaluate_pad_group(
                group,
                snapshots_by_id=snapshots_by_id,
                params=params,
                subtype=subtype,
                candidate_id=candidate_id,
                center_lon=clon,
                center_lat=clat,
            )

        centers.append((clon, clat))
        pad_candidates.append(cand)
        score_warnings.extend(cand.warnings)

    expected_wells = sum(len(g) for g in groups)
    invalid = variant_is_invalid(pad_candidates, expected_wells)
    if invalid:
        score_warnings.append("Not all wells have calculated trajectories")

    logical_wells = [w for group in groups for w in group]
    sum_md_m, md_warnings = sum_md_m_from_candidate(pad_candidates, logical_wells)
    score_warnings.extend(md_warnings)

    return PlacementVariantOut(
        variant_index=variant_seq,
        pad_count=len(pad_candidates),
        sum_md_m=sum_md_m,
        pads=pad_candidates,
        score_warnings=score_warnings,
        invalid=invalid,
    )
