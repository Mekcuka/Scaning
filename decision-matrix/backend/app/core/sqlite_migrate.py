"""Apply incremental SQLite schema patches (create_all does not alter existing tables)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Connection


def _add_column_if_missing(conn: Connection, table: str, column: str, ddl: str) -> None:
    insp = inspect(conn)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    if column not in existing:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {ddl}"))


def patch_sqlite_schema(conn: Connection) -> None:
    for table in ("project_distance_defaults", "points_of_interest"):
        _add_column_if_missing(conn, table, "max_total_line_gas_pipeline_km", "max_total_line_gas_pipeline_km FLOAT")
        _add_column_if_missing(conn, table, "km_per_pad_gas_pipeline", "km_per_pad_gas_pipeline FLOAT")

    _add_column_if_missing(
        conn,
        "poi_infrastructure_analysis",
        "nearest_node_id",
        "nearest_node_id CHAR(32)",
    )
