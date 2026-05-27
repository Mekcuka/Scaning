"""Geometry column types: PostGIS (PostgreSQL) or WKT text (SQLite)."""

from geoalchemy2 import Geometry
from sqlalchemy import Text
from sqlalchemy.orm import mapped_column

from app.core.config import settings


def geometry_point_column(*, nullable: bool = False):
    if settings.is_sqlite:
        return mapped_column(Text, nullable=nullable)
    return mapped_column(Geometry(geometry_type="POINT", srid=4326), nullable=nullable)


def geometry_any_column(*, nullable: bool = False):
    if settings.is_sqlite:
        return mapped_column(Text, nullable=nullable)
    return mapped_column(Geometry(geometry_type="GEOMETRY", srid=4326), nullable=nullable)
