"""Evaluate a pad candidate in memory (layout + trajectories)."""

from __future__ import annotations

from uuid import UUID, uuid4

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import store_sketch, store_wells_local
from app.services.pad_earthwork.properties import (
    PAD_LAYOUT_MARGIN_BOTTOM_M,
    PAD_LAYOUT_MARGIN_END_M,
    PAD_LAYOUT_MARGIN_LEFT_M,
    PAD_LAYOUT_MARGIN_TOP_M,
    PAD_ROTATION_DEG,
    PAD_WELL_COUNT,
    PAD_WELL_GROUP_SPACING_M,
    PAD_WELL_SPACING_M,
    PAD_WELLS_PER_GROUP,
)
from app.services.pad_earthwork.schemas import WellLayoutGenerateRequestIn
from app.services.pad_earthwork.service import generate_pad_sketch_from_wells
from app.services.pad_placement.placement import suggest_pad_center
from app.services.pad_placement.schemas import (
    BottomholeSnapshot,
    LogicalWell,
    PadCandidateOut,
    PadPlacementParams,
)
from app.services.well_trajectory.bottomhole_properties import WELL_INDEX
from app.services.well_trajectory.bottomhole_sync import sync_bottomholes_to_trajectories
from app.services.well_trajectory.schemas import WellTrajectoryDesignAllRequest
from app.services.well_trajectory.service import design_all_from_targets, generate_trajectories_from_layout
from app.services.well_trajectory.trajectory_store import store_trajectories_json
from app.services.well_trajectory.settings_store import WELL_TRAJECTORY_STEP_M, WELL_TRAJECTORY_SF_WARNING_THRESHOLD


def params_to_pad_properties(params: PadPlacementParams, well_count: int) -> dict:
    return {
        PAD_WELL_COUNT: well_count,
        PAD_WELLS_PER_GROUP: params.wells_per_group,
        PAD_WELL_SPACING_M: params.well_spacing_m,
        PAD_WELL_GROUP_SPACING_M: params.group_spacing_m,
        PAD_LAYOUT_MARGIN_LEFT_M: params.margin_left_m,
        PAD_LAYOUT_MARGIN_BOTTOM_M: params.margin_bottom_m,
        PAD_LAYOUT_MARGIN_TOP_M: params.margin_top_m,
        PAD_LAYOUT_MARGIN_END_M: params.margin_end_m,
        PAD_ROTATION_DEG: params.rotation_deg,
        WELL_TRAJECTORY_STEP_M: params.step_m,
        WELL_TRAJECTORY_SF_WARNING_THRESHOLD: params.sf_threshold,
    }


def build_virtual_pad(
    *,
    center_lon: float,
    center_lat: float,
    subtype: str,
    params: PadPlacementParams,
    well_count: int,
    pad_id: UUID | None = None,
) -> InfrastructureObject:
    return InfrastructureObject(
        id=pad_id or uuid4(),
        layer_id=uuid4(),
        name="Candidate pad",
        subtype=subtype,
        category="pad",
        geometry={"type": "Point", "coordinates": [center_lon, center_lat]},
        longitude=center_lon,
        latitude=center_lat,
        properties=params_to_pad_properties(params, well_count),
    )


def snapshot_to_bottomhole(
    snap: BottomholeSnapshot,
    *,
    well_index: int | None = None,
) -> InfrastructureObject:
    props = dict(snap.properties)
    if well_index is not None:
        props[WELL_INDEX] = well_index
    return InfrastructureObject(
        id=snap.id,
        layer_id=uuid4(),
        name=snap.name,
        subtype=snap.subtype,
        category="well",
        geometry={"type": "Point", "coordinates": [snap.longitude, snap.latitude]},
        longitude=snap.longitude,
        latitude=snap.latitude,
        properties=props,
    )


def evaluate_pad_group(
    wells: list[LogicalWell],
    *,
    snapshots_by_id: dict[UUID, BottomholeSnapshot],
    params: PadPlacementParams,
    subtype: str,
    candidate_id: str,
    center_lon: float | None = None,
    center_lat: float | None = None,
) -> PadCandidateOut:
    warnings: list[str] = []
    if not wells:
        return PadCandidateOut(
            candidate_id=candidate_id,
            center_longitude=0.0,
            center_latitude=0.0,
            assigned_logical_ids=[],
            warnings=["Empty pad group"],
        )

    clon, clat = (
        (center_lon, center_lat)
        if center_lon is not None and center_lat is not None
        else suggest_pad_center(wells)
    )
    pad = build_virtual_pad(
        center_lon=clon,
        center_lat=clat,
        subtype=subtype,
        params=params,
        well_count=len(wells),
    )

    layout = generate_pad_sketch_from_wells(
        pad,
        WellLayoutGenerateRequestIn(well_count=len(wells)),
    )
    props = dict(pad.properties or {})
    props = store_sketch(props, layout.sketch)
    props = store_wells_local(props, layout.wells_local)
    pad.properties = props

    try:
        gen = generate_trajectories_from_layout(pad)
        pad.properties = store_trajectories_json(pad.properties, gen.trajectories)
    except Exception as exc:
        warnings.append(f"generate-from-layout failed: {exc}")
        return PadCandidateOut(
            candidate_id=candidate_id,
            center_longitude=clon,
            center_latitude=clat,
            assigned_logical_ids=[w.logical_id for w in wells],
            warnings=warnings,
        )

    virtual_bottomholes: list[InfrastructureObject] = []
    for well_index, lw in enumerate(wells):
        for bh_id in lw.bottomhole_ids:
            snap = snapshots_by_id.get(bh_id)
            if snap is None:
                warnings.append(f"Missing snapshot for bottomhole {bh_id}")
                continue
            virtual_bottomholes.append(
                snapshot_to_bottomhole(snap, well_index=well_index)
            )

    trajectories, sync_warnings = sync_bottomholes_to_trajectories(pad, virtual_bottomholes)
    warnings.extend(sync_warnings)
    pad.properties = store_trajectories_json(pad.properties, trajectories)

    design = design_all_from_targets(
        pad,
        WellTrajectoryDesignAllRequest(step_m=params.step_m),
    )
    if design.skipped:
        warnings.append(f"Design skipped wells: {design.skipped}")

    pad.properties = store_trajectories_json(pad.properties, design.trajectories)

    return PadCandidateOut(
        candidate_id=candidate_id,
        center_longitude=clon,
        center_latitude=clat,
        assigned_logical_ids=[w.logical_id for w in wells],
        sketch=layout.sketch.model_dump(mode="json"),
        wells_local=[{"east_m": w.east_m, "north_m": w.north_m} for w in layout.wells_local],
        length_m=layout.length_m,
        width_m=layout.width_m,
        rotation_deg=layout.rotation_deg,
        trajectories=design.trajectories,
        warnings=warnings,
    )


def sum_md_m_from_candidate(
    pads: list[PadCandidateOut],
    logical_wells: list[LogicalWell] | None = None,
) -> tuple[float, list[str]]:
    """Sum last-station MD per well; fallback to target.md or LogicalWell.tvd_m."""
    warnings: list[str] = []
    logical_by_id = {lw.logical_id: lw for lw in (logical_wells or [])}
    total = 0.0

    for pad in pads:
        for wi, well in enumerate(pad.trajectories):
            if not isinstance(well, dict):
                continue
            md: float | None = None
            survey = well.get("survey")
            stations = survey.get("stations") if isinstance(survey, dict) else None
            if isinstance(stations, list) and stations:
                last = stations[-1]
                if isinstance(last, dict) and last.get("md") is not None:
                    try:
                        md = float(last["md"])
                    except (TypeError, ValueError):
                        md = None
            if md is None:
                target = well.get("target")
                if isinstance(target, dict) and target.get("md") is not None:
                    try:
                        md = float(target["md"])
                    except (TypeError, ValueError):
                        md = None
            if md is None:
                logical_id = (
                    pad.assigned_logical_ids[wi]
                    if wi < len(pad.assigned_logical_ids)
                    else None
                )
                lw = logical_by_id.get(logical_id) if logical_id else None
                if lw is not None:
                    md = lw.tvd_m
                    warnings.append(f"MD fallback to TVD for {lw.logical_id}")
            if md is not None:
                total += md

    return total, warnings


def variant_is_invalid(pads: list[PadCandidateOut], expected_wells: int) -> bool:
    designed = 0
    for pad in pads:
        for well in pad.trajectories:
            survey = well.get("survey") if isinstance(well, dict) else None
            stations = survey.get("stations") if isinstance(survey, dict) else None
            if isinstance(stations, list) and len(stations) >= 2:
                source = survey.get("source")
                if source == "calculated":
                    designed += 1
    return designed < expected_wells
