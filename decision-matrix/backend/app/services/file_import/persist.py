"""Persist parsed import rows as infrastructure objects."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.geo.geometry_utils import build_infra_geometry, line_coordinates_for_storage
from app.models import InfrastructureLayer, InfrastructureObject
from app.services.line_endpoint_rules import LineEndpointRuleError, snap_line_endpoints_to_point_objects


async def import_rows_to_layer(
    db: AsyncSession,
    layer: InfrastructureLayer,
    rows: list[dict],
    *,
    build_network: bool = False,
    skip_line_endpoint_validation: bool = False,
) -> tuple[int, list[str]]:
    count = 0
    errors: list[str] = []
    for idx, row in enumerate(rows, start=1):
        if (
            not skip_line_endpoint_validation
            and row.get("end_lon") is not None
            and row.get("end_lat") is not None
        ):
            try:
                subtype = str(row["subtype"])
                lon, lat, end_lon, end_lat, line_coords = await snap_line_endpoints_to_point_objects(
                    db,
                    project_id=layer.project_id,
                    line_subtype=subtype,
                    lon=float(row["lon"]),
                    lat=float(row["lat"]),
                    end_lon=float(row["end_lon"]),
                    end_lat=float(row["end_lat"]),
                    coordinates=row.get("coordinates"),
                )
                row["lon"] = lon
                row["lat"] = lat
                row["end_lon"] = end_lon
                row["end_lat"] = end_lat
                if line_coords:
                    row["coordinates"] = line_coords
                row["geometry"] = build_infra_geometry(
                    subtype,
                    lon,
                    lat,
                    end_lon=end_lon,
                    end_lat=end_lat,
                    coordinates=line_coords,
                )
            except LineEndpointRuleError as e:
                errors.append(f"Row {idx} ({row['name']}): {e}")
                continue
        from app.geo.entry_date import apply_default_entry_date
        from app.geo.render_3d_properties import apply_default_render_3d, merge_geojson_render_3d
        from app.geo.sand_properties import apply_default_sand_volumes
        from app.geo.throughput_capacity import apply_default_throughput_capacity

        raw_props = merge_geojson_render_3d(dict(row.get("properties") or {}))
        row_subtype = str(row["subtype"])
        props: dict = apply_default_entry_date(
            row_subtype,
            apply_default_throughput_capacity(
                row_subtype,
                apply_default_render_3d(
                    row_subtype,
                    apply_default_sand_volumes(row_subtype, raw_props),
                ),
            ),
        )
        line_coords = line_coordinates_for_storage(
            lon=float(row["lon"]),
            lat=float(row["lat"]),
            end_lon=row.get("end_lon"),
            end_lat=row.get("end_lat"),
            coordinates=row.get("coordinates"),
        )
        if line_coords:
            props["coordinates"] = line_coords
        db.add(
            InfrastructureObject(
                layer_id=layer.id,
                name=row["name"],
                subtype=row["subtype"],
                category=row["category"],
                geometry=row["geometry"],
                longitude=row["lon"],
                latitude=row["lat"],
                end_longitude=row.get("end_lon"),
                end_latitude=row.get("end_lat"),
                properties=props,
            )
        )
        count += 1
    if build_network and count:
        from app.services.graph_builder import build_network_from_lines

        await build_network_from_lines(db, layer.project_id)
    return count, errors
