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


def _create_table_if_missing(conn: Connection, table: str, ddl: str) -> None:
    insp = inspect(conn)
    if table not in insp.get_table_names():
        conn.execute(text(ddl))


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
    _add_column_if_missing(
        conn,
        "poi_infrastructure_analysis",
        "force_construction",
        "force_construction BOOLEAN DEFAULT 0",
    )
    _create_table_if_missing(
        conn,
        "project_ranking_settings",
        """
        CREATE TABLE project_ranking_settings (
            id CHAR(32) PRIMARY KEY,
            project_id CHAR(32) NOT NULL,
            poi_id CHAR(32) NOT NULL,
            algorithm VARCHAR(20) NOT NULL DEFAULT 'topsis',
            criteria JSON NOT NULL DEFAULT '[]',
            weights JSON NOT NULL DEFAULT '{}',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, poi_id),
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(poi_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
        )
        """,
    )
    _create_table_if_missing(
        conn,
        "scenario_criterion_values",
        """
        CREATE TABLE scenario_criterion_values (
            id CHAR(32) PRIMARY KEY,
            ranking_settings_id CHAR(32) NOT NULL,
            scenario_id CHAR(32) NOT NULL,
            criterion_id VARCHAR(100) NOT NULL,
            value FLOAT NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(ranking_settings_id, scenario_id, criterion_id),
            FOREIGN KEY(ranking_settings_id) REFERENCES project_ranking_settings(id) ON DELETE CASCADE,
            FOREIGN KEY(scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
        )
        """,
    )
