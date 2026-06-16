"""Bootstrap pad_wells_local_json when trajectory workflows run before earthwork sketch save."""

from __future__ import annotations

from app.models import InfrastructureObject
from app.services.pad_earthwork.earthwork_store import read_wells_local, store_wells_local
from app.services.pad_earthwork.properties import PAD_WELL_COUNT
from app.services.pad_earthwork.schemas import PlanVertexIn, WellLayoutGenerateRequestIn
from app.services.pad_earthwork.service import generate_pad_sketch_from_wells
from app.services.well_trajectory.bottomhole_properties import WELL_INDEX, is_lateral_bottomhole


def _read_pad_well_count(props: dict) -> int | None:
    raw = props.get(PAD_WELL_COUNT)
    if raw is None or raw == "":
        return None
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value if value >= 1 else None


def slot_demand_from_bottomholes(bottomholes: list[InfrastructureObject]) -> int:
    """Logical well slots implied by pad-linked bottomholes (NNB + GS heel/line; toe shares heel slot)."""
    if not bottomholes:
        return 0

    max_explicit = -1
    nnb_count = 0
    gs_heel_count = 0
    for bh in bottomholes:
        props = bh.properties or {}
        if is_lateral_bottomhole(props):
            continue
        raw = props.get(WELL_INDEX)
        if raw is not None and raw != "":
            try:
                max_explicit = max(max_explicit, int(raw))
            except (TypeError, ValueError):
                pass
        st = (bh.subtype or "").lower().strip()
        if st == "well_bottomhole_nnb":
            nnb_count += 1
        elif st in ("well_bottomhole_gs_heel", "well_bottomhole_gs"):
            gs_heel_count += 1

    return max(
        max_explicit + 1 if max_explicit >= 0 else 0,
        nnb_count + gs_heel_count,
        1,
    )


def trajectory_stub_well_count(
    pad: InfrastructureObject,
    bottomholes: list[InfrastructureObject] | None,
) -> int:
    """Well count for trajectory stubs: linked bottomholes when present, else pad layout settings."""
    if bottomholes:
        demand = slot_demand_from_bottomholes(bottomholes)
        if demand > 0:
            return demand
    props = pad.properties or {}
    pad_count = _read_pad_well_count(props)
    if pad_count is not None:
        return pad_count
    existing = read_wells_local(props)
    if existing:
        return len(existing)
    return 1


def required_well_count_from_bottomholes(
    pad: InfrastructureObject,
    bottomholes: list[InfrastructureObject],
) -> int:
    pad_count = _read_pad_well_count(pad.properties or {}) or 1
    if not bottomholes:
        return pad_count
    return max(slot_demand_from_bottomholes(bottomholes), pad_count)


def auto_generate_wells_local(
    obj: InfrastructureObject,
    *,
    well_count: int | None = None,
) -> list[PlanVertexIn]:
    body = (
        WellLayoutGenerateRequestIn(well_count=well_count)
        if well_count is not None
        else None
    )
    result = generate_pad_sketch_from_wells(obj, body)
    return list(result.wells_local)


def ensure_pad_wells_local_on_object(
    obj: InfrastructureObject,
    *,
    min_well_count: int = 1,
    exact_well_count: int | None = None,
) -> tuple[list[PlanVertexIn], bool]:
    """Return wells layout; auto-generate, expand, or trim to the required well count."""
    props = dict(obj.properties or {})
    existing = read_wells_local(props)
    pad_count = _read_pad_well_count(props)
    if exact_well_count is not None:
        target_count = max(exact_well_count, 1)
    else:
        target_count = max(min_well_count, pad_count or min_well_count)

    if existing and len(existing) == target_count:
        return existing, False

    if existing and len(existing) > target_count:
        trimmed = existing[:target_count]
        obj.properties = store_wells_local(props, trimmed)
        return trimmed, True

    if existing and len(existing) >= target_count and exact_well_count is None:
        return existing, False

    generated = auto_generate_wells_local(obj, well_count=target_count)
    if not generated:
        return existing, False

    obj.properties = store_wells_local(props, generated)
    return generated, True
