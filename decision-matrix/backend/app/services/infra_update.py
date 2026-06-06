"""Update infrastructure object records (shared by map API)."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.map_deps import get_layer
from app.geo.constants import LINE_SUBTYPES, normalize_infra_subtype
from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage
from app.geo.render_3d_properties import apply_default_render_3d, merge_infra_properties_patch
from app.geo.validation import category_for_subtype, validate_subtype_change, validate_subtype_geometry
from app.models import InfrastructureObject, Project, User
from app.schemas import InfraObjectUpdate
from app.services.line_endpoint_rules import LineEndpointRuleError, snap_line_endpoints_to_point_objects
from app.services.map3d_custom_models import assert_can_set_custom_model_id_async
from app.services.serializers import _infra_line_coordinates


async def update_infra_object_record(
    db: AsyncSession,
    *,
    project: Project,
    project_id: UUID,
    user: User,
    obj: InfrastructureObject,
    data: InfraObjectUpdate,
) -> InfrastructureObject:
    payload = data.model_dump(exclude_unset=True)
    lon = payload.get("lon", obj.longitude)
    lat = payload.get("lat", obj.latitude)
    end_lon = payload.get("end_lon", obj.end_longitude)
    end_lat = payload.get("end_lat", obj.end_latitude)
    coords = payload.get("coordinates")
    if coords is None and any(
        k in payload for k in ("lon", "lat", "end_lon", "end_lat", "coordinates", "subtype")
    ):
        coords = _infra_line_coordinates(obj)

    subtype = normalize_infra_subtype(payload.get("subtype", obj.subtype))

    if any(k in payload for k in ("lon", "lat", "end_lon", "end_lat", "coordinates", "subtype")):
        if "subtype" in payload:
            validate_subtype_change(normalize_infra_subtype(obj.subtype), subtype)
        has_line = end_lon is not None or (coords and len(coords) >= 2)
        validate_subtype_geometry(subtype, has_line_endpoints=has_line)
        if coords and len(coords) >= 2:
            lon, lat = coords[0][0], coords[0][1]
            end_lon, end_lat = coords[-1][0], coords[-1][1]
        line_coords = line_coordinates_for_storage(
            lon=lon, lat=lat, end_lon=end_lon, end_lat=end_lat, coordinates=coords
        )
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
                    exclude_object_id=obj.id,
                )
            except LineEndpointRuleError as e:
                raise ValueError(str(e)) from e
        try:
            obj.geometry = build_infra_geometry(
                subtype, lon, lat, end_lon=end_lon, end_lat=end_lat, coordinates=line_coords
            )
        except ValueError:
            raise
        obj.longitude, obj.latitude = lon, lat
        obj.end_longitude, obj.end_latitude = end_lon, end_lat
        obj.subtype = subtype
        obj.category = category_for_subtype(subtype)
        if line_coords:
            props = dict(obj.properties or {})
            props["coordinates"] = line_coords
            obj.properties = props

    if "name" in payload:
        obj.name = payload["name"]
    if "layer_id" in payload:
        await get_layer(payload["layer_id"], project_id, db)
        obj.layer_id = payload["layer_id"]
    if "properties" in payload:
        await assert_can_set_custom_model_id_async(
            db, user, project, project_id, subtype, payload["properties"]
        )
        merged_props = merge_infra_properties_patch(obj.properties, payload["properties"])
        await assert_can_set_custom_model_id_async(
            db, user, project, project_id, subtype, merged_props
        )
        obj.properties = apply_default_render_3d(subtype, merged_props)
    if "description" in payload:
        props = dict(obj.properties or {})
        props["description"] = payload["description"]
        obj.properties = props

    return obj
