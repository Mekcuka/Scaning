"""Bbox filter for infrastructure list: geometry intersects viewport envelope."""

from sqlalchemy import and_, func
from sqlalchemy.sql import ColumnElement

from app.core.config import settings
from app.models import InfrastructureObject


def infra_bbox_filter(
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
) -> ColumnElement[bool]:
    """Object visible if its geometry intersects the lon/lat envelope (EPSG:4326)."""
    if not settings.is_sqlite:
        from geoalchemy2.functions import ST_Intersects, ST_MakeEnvelope

        envelope = ST_MakeEnvelope(min_lon, min_lat, max_lon, max_lat, 4326)
        return ST_Intersects(InfrastructureObject.geometry, envelope)

    min_lon_col = func.min(
        InfrastructureObject.longitude,
        func.coalesce(InfrastructureObject.end_longitude, InfrastructureObject.longitude),
    )
    max_lon_col = func.max(
        InfrastructureObject.longitude,
        func.coalesce(InfrastructureObject.end_longitude, InfrastructureObject.longitude),
    )
    min_lat_col = func.min(
        InfrastructureObject.latitude,
        func.coalesce(InfrastructureObject.end_latitude, InfrastructureObject.latitude),
    )
    max_lat_col = func.max(
        InfrastructureObject.latitude,
        func.coalesce(InfrastructureObject.end_latitude, InfrastructureObject.latitude),
    )
    return and_(
        min_lon_col <= max_lon,
        max_lon_col >= min_lon,
        min_lat_col <= max_lat,
        max_lat_col >= min_lat,
    )
