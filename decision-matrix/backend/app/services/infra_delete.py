"""Batch infrastructure object deletion (single transaction, one network rebuild)."""

from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.constants import LINE_SUBTYPES
from app.models import (
    InfrastructureEdge,
    InfrastructureLayer,
    InfrastructureNetwork,
    InfrastructureNode,
    InfrastructureObject,
    PointOfInterest,
    PoiInfrastructureAnalysis,
)
from app.services.pad_earthwork.pad_dem_repository import delete_pad_dem_files_for_object_ids
from app.services.graph_builder import build_network_from_lines, prune_disconnected_nodes

COORD_MATCH_EPS = 1e-6


def _line_endpoint_matches_point(
    line: InfrastructureObject,
    point_lon: float,
    point_lat: float,
) -> bool:
    start_match = (
        abs(float(line.longitude) - point_lon) <= COORD_MATCH_EPS
        and abs(float(line.latitude) - point_lat) <= COORD_MATCH_EPS
    )
    end_match = (
        line.end_longitude is not None
        and line.end_latitude is not None
        and abs(float(line.end_longitude) - point_lon) <= COORD_MATCH_EPS
        and abs(float(line.end_latitude) - point_lat) <= COORD_MATCH_EPS
    )
    return start_match or end_match


async def resolve_infra_delete_ids(
    db: AsyncSession,
    project_id: UUID,
    object_ids: set[UUID],
) -> set[UUID]:
    """Expand delete set with lines attached to deleted point objects."""
    if not object_ids:
        return set()

    delete_ids = set(object_ids)
    objs = (
        await db.execute(select(InfrastructureObject).where(InfrastructureObject.id.in_(delete_ids)))
    ).scalars().all()
    point_objs = [o for o in objs if o.subtype not in LINE_SUBTYPES]
    if not point_objs:
        return delete_ids

    line_rows = (
        await db.execute(
            select(InfrastructureObject)
            .join(InfrastructureLayer)
            .where(
                InfrastructureLayer.project_id == project_id,
                InfrastructureObject.subtype.in_(LINE_SUBTYPES),
            )
        )
    ).scalars().all()

    for obj in point_objs:
        point_lon = float(obj.longitude)
        point_lat = float(obj.latitude)
        for line in line_rows:
            if line.id in delete_ids:
                continue
            if _line_endpoint_matches_point(line, point_lon, point_lat):
                delete_ids.add(line.id)
    return delete_ids


async def delete_infra_objects_batch(
    db: AsyncSession,
    project_id: UUID,
    object_ids: set[UUID],
) -> tuple[int, bool]:
    """
    Delete infrastructure objects (with line cascade for points).
    Returns (deleted_count, line_was_deleted).
    """
    if not object_ids:
        return 0, False

    delete_ids = await resolve_infra_delete_ids(db, project_id, object_ids)

    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.nearest_object_id.in_(delete_ids))
        .values(nearest_object_id=None)
    )
    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.overridden_object_id.in_(delete_ids))
        .values(overridden_object_id=None)
    )

    network_ids = (
        await db.execute(
            select(InfrastructureNetwork.id).where(InfrastructureNetwork.project_id == project_id)
        )
    ).scalars().all()

    await db.execute(
        delete(InfrastructureEdge).where(InfrastructureEdge.infrastructure_object_id.in_(delete_ids))
    )
    await db.execute(
        delete(InfrastructureNode).where(InfrastructureNode.infrastructure_object_id.in_(delete_ids))
    )

    line_deleted = (
        await db.scalar(
            select(InfrastructureObject.id)
            .where(
                InfrastructureObject.id.in_(delete_ids),
                InfrastructureObject.subtype.in_(LINE_SUBTYPES),
            )
            .limit(1)
        )
    ) is not None

    await delete_pad_dem_files_for_object_ids(db, delete_ids)

    result = await db.execute(delete(InfrastructureObject).where(InfrastructureObject.id.in_(delete_ids)))
    deleted_count = result.rowcount or len(delete_ids)

    await db.flush()
    for network_id in network_ids:
        await prune_disconnected_nodes(db, network_id)
    if line_deleted:
        await build_network_from_lines(db, project_id)

    return deleted_count, line_deleted


async def delete_pois_batch(db: AsyncSession, project_id: UUID, poi_ids: set[UUID]) -> int:
    if not poi_ids:
        return 0
    pois = (
        await db.execute(
            select(PointOfInterest).where(
                PointOfInterest.project_id == project_id,
                PointOfInterest.id.in_(poi_ids),
            )
        )
    ).scalars().all()
    for poi in pois:
        await db.delete(poi)
    return len(pois)


async def clear_project_infrastructure(db: AsyncSession, project_id: UUID) -> dict[str, int]:
    """Remove all infrastructure objects and graph data for the project (POIs are kept)."""
    layer_ids_sq = select(InfrastructureLayer.id).where(InfrastructureLayer.project_id == project_id)
    poi_ids_sq = select(PointOfInterest.id).where(PointOfInterest.project_id == project_id)
    network_ids_sq = select(InfrastructureNetwork.id).where(InfrastructureNetwork.project_id == project_id)

    n_objects = len(
        (
            await db.execute(
                select(InfrastructureObject.id).where(InfrastructureObject.layer_id.in_(layer_ids_sq))
            )
        ).all()
    )

    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(PoiInfrastructureAnalysis.poi_id.in_(poi_ids_sq))
        .values(
            nearest_object_id=None,
            overridden_object_id=None,
            nearest_node_id=None,
        )
    )
    await db.execute(
        update(PoiInfrastructureAnalysis)
        .where(
            PoiInfrastructureAnalysis.poi_id.in_(poi_ids_sq),
            PoiInfrastructureAnalysis.param_type.in_(("external", "external_linear")),
            PoiInfrastructureAnalysis.distance_status != "not_required",
        )
        .values(
            distance_km=None,
            anchor_type=None,
            anchor_geometry=None,
            distance_status="construction_required",
            is_manually_overridden=False,
        )
    )

    edge_result = await db.execute(
        delete(InfrastructureEdge).where(InfrastructureEdge.network_id.in_(network_ids_sq))
    )
    node_result = await db.execute(
        delete(InfrastructureNode).where(InfrastructureNode.network_id.in_(network_ids_sq))
    )
    await db.execute(delete(InfrastructureObject).where(InfrastructureObject.layer_id.in_(layer_ids_sq)))

    return {
        "deleted_objects": n_objects,
        "deleted_edges": edge_result.rowcount or 0,
        "deleted_nodes": node_result.rowcount or 0,
    }
