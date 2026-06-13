"""SF scoring for pad placement variants (M5)."""

from __future__ import annotations

from uuid import UUID, uuid4

from app.models import InfrastructureObject
from app.services.pad_placement.evaluate import build_virtual_pad, params_to_pad_properties
from app.services.pad_placement.schemas import PadCandidateOut, PadPlacementParams, PlacementVariantOut
from app.services.well_trajectory.clearance_coords import (
    all_pair_indices,
    collect_project_wells_for_clearance,
)
from app.services.well_trajectory.planner_bridge import planner_schemas
from app.services.well_trajectory.trajectory_adapter import get_well_trajectory_adapter
from app.services.well_trajectory.trajectory_store import store_trajectories_json


def score_variant_sf(
    variant: PlacementVariantOut,
    *,
    existing_pads: list[InfrastructureObject],
    params: PadPlacementParams,
    subtype: str,
) -> PlacementVariantOut:
    if not params.sf_check:
        return variant

    virtual_pads = _virtual_pads_from_variant(variant, params, subtype)
    all_pads = list(existing_pads) + virtual_pads
    try:
        collection = collect_project_wells_for_clearance(all_pads)
    except ValueError as exc:
        variant.score_warnings.append(str(exc))
        return variant

    if len(collection.surveys) < 2:
        variant.score_warnings.append("SF check skipped: fewer than 2 designed wells")
        return variant

    schemas = planner_schemas()
    adapter = get_well_trajectory_adapter()
    try:
        result = adapter.clearance_pairs(
            schemas.ClearancePairsRequest(
                surveys=[
                    schemas.ClearanceSurveyIn.model_validate(s)
                    for s in collection.surveys
                ],
                pairs=all_pair_indices(len(collection.surveys)),
                method="iscwsa",
                threshold=params.sf_threshold,
            )
        )
    except Exception as exc:
        variant.score_warnings.append(f"SF check failed: {exc}")
        return variant

    if not result.pairs:
        return variant

    variant.min_sf = min(p.min_sf for p in result.pairs)
    violations = [p for p in result.pairs if p.warning]
    variant.sf_violation_count = len(violations)
    for pair in violations:
        variant.score_warnings.append(
            f"SF {pair.min_sf:.2f} below threshold {params.sf_threshold}"
        )
    return variant


def _virtual_pads_from_variant(
    variant: PlacementVariantOut,
    params: PadPlacementParams,
    subtype: str,
) -> list[InfrastructureObject]:
    pads: list[InfrastructureObject] = []
    for cand in variant.pads:
        pad = build_virtual_pad(
            center_lon=cand.center_longitude,
            center_lat=cand.center_latitude,
            subtype=subtype,
            params=params,
            well_count=len(cand.wells_local) or len(cand.trajectories) or 1,
            pad_id=uuid4(),
        )
        props = dict(pad.properties or {})
        props = store_trajectories_json(props, cand.trajectories)
        pad.properties = props
        pad.name = cand.candidate_id
        pads.append(pad)
    return pads
