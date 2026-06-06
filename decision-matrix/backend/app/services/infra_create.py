"""Create infrastructure object records (shared by map API and autoroad connect)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_layer, get_or_create_default_layer
from app.geo.constants import LINE_SUBTYPES, normalize_infra_subtype
from app.geo.entry_date import apply_default_entry_date
from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage
from app.geo.render_3d_properties import apply_default_render_3d
from app.geo.sand_properties import apply_default_sand_volumes
from app.geo.throughput_capacity import apply_default_throughput_capacity
from app.geo.validation import category_for_subtype, validate_subtype_geometry
from app.models import InfrastructureObject
from app.schemas import InfraObjectCreate
from app.services.graph_builder import build_network_from_lines
from app.services.line_endpoint_rules import LineEndpointRuleError, snap_line_endpoints_to_point_objects


async def create_infra_object_record(
    db: AsyncSession,
    *,
    project_id: UUID,
    data: InfraObjectCreate,
    layer_source_type: str = "manual",
) -> InfrastructureObject:
    subtype = normalize_infra_subtype(data.subtype)
    has_line = data.end_lon is not None or (data.coordinates and len(data.coordinates) >= 2)
    validate_subtype_geometry(subtype, has_line_endpoints=has_line, coordinate_count=len(data.coordinates or [1]))
    geom = build_infra_geometry(
        subtype,
        data.lon,
        data.lat,
        end_lon=data.end_lon,
        end_lat=data.end_lat,
        coordinates=data.coordinates,
    )

    if data.layer_id:
        layer = await get_layer(data.layer_id, project_id, db)
    else:
        layer = await get_or_create_default_layer(project_id, db, source_type=layer_source_type)

    props = apply_default_entry_date(
        subtype,
        apply_default_throughput_capacity(
            subtype,
            apply_default_render_3d(
                subtype, apply_default_sand_volumes(subtype, dict(data.properties))
            ),
        ),
    )
    if data.description:
        props["description"] = data.description

    end_lon, end_lat = data.end_lon, data.end_lat
    if data.coordinates and len(data.coordinates) >= 2:
        end_lon = data.coordinates[-1][0]
        end_lat = data.coordinates[-1][1]
    line_coords = line_coordinates_for_storage(
        lon=data.lon,
        lat=data.lat,
        end_lon=end_lon,
        end_lat=end_lat,
        coordinates=data.coordinates,
    )
    lon, lat = data.lon, data.lat
    if subtype in LINE_SUBTYPES:
        try:
            lon, lat, end_lon, end_lat, line_coords = await snap_line_endpoints_to_point_objects(
                db,
                project_id=project_id,
                line_subtype=subtype,
                lon=lon,
                lat=lat,
                end_lon=end_lon,
                end_lat=end_lat,
                coordinates=line_coords,
                line_snap_start_object_id=data.line_snap_start_object_id,
                line_snap_finish_object_id=data.line_snap_finish_object_id,
                line_preserve_geometry=data.line_preserve_geometry,
            )
        except LineEndpointRuleError as e:
            raise ValueError(str(e)) from e
        geom = build_infra_geometry(
            subtype,
            lon,
            lat,
            end_lon=end_lon,
            end_lat=end_lat,
            coordinates=line_coords,
        )
    if line_coords:
        props["coordinates"] = line_coords

    obj = InfrastructureObject(
        layer_id=layer.id,
        name=data.name,
        subtype=subtype,
        category=category_for_subtype(subtype),
        geometry=geom,
        longitude=lon,
        latitude=lat,
        end_longitude=end_lon,
        end_latitude=end_lat,
        properties=props,
    )
    db.add(obj)
    await db.flush()
    if obj.end_longitude is not None:
        await build_network_from_lines(db, project_id)
    return obj
