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
        "poi_flow_schematic_layouts",
        """
        CREATE TABLE poi_flow_schematic_layouts (
            id CHAR(32) PRIMARY KEY,
            poi_id CHAR(32) NOT NULL UNIQUE,
            nodes JSON NOT NULL DEFAULT '[]',
            edges JSON NOT NULL DEFAULT '[]',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(poi_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
        )
        """,
    )
    _create_table_if_missing(
        conn,
        "project_economic_params",
        """
        CREATE TABLE project_economic_params (
            id CHAR(32) PRIMARY KEY,
            project_id CHAR(32) NOT NULL UNIQUE,
            params JSON NOT NULL DEFAULT '{}',
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
        """,
    )

    _add_column_if_missing(
        conn,
        "points_of_interest",
        "gas_factor",
        "gas_factor FLOAT NOT NULL DEFAULT 120",
    )
    _create_table_if_missing(
        conn,
        "refresh_tokens",
        """
        CREATE TABLE refresh_tokens (
            id CHAR(32) PRIMARY KEY,
            user_id CHAR(32) NOT NULL,
            token_hash VARCHAR(64) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """,
    )
    _create_table_if_missing(
        conn,
        "one_pagers",
        """
        CREATE TABLE one_pagers (
            id CHAR(32) PRIMARY KEY,
            project_id CHAR(32) NOT NULL,
            poi_id CHAR(32) NOT NULL,
            title VARCHAR(255) NOT NULL,
            coordinates VARCHAR(100),
            engineer_name VARCHAR(255),
            report_date DATE,
            final_variant_data JSON NOT NULL DEFAULT '{}',
            engineering_params JSON NOT NULL DEFAULT '{}',
            roadmap JSON NOT NULL DEFAULT '[]',
            recommendation_text TEXT,
            is_recommendation_edited BOOLEAN DEFAULT 0,
            map_snapshot_base64 TEXT,
            pdf_file_path VARCHAR(500),
            pptx_file_path VARCHAR(500),
            generation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
            FOREIGN KEY(poi_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
        )
        """,
    )

    insp = inspect(conn)
    if "one_pagers" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("one_pagers")}
        if "scenario_id" in cols:
            conn.execute(text("DROP TABLE one_pagers"))
            conn.execute(
                text(
                    """
                    CREATE TABLE one_pagers (
                        id CHAR(32) PRIMARY KEY,
                        project_id CHAR(32) NOT NULL,
                        poi_id CHAR(32) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        coordinates VARCHAR(100),
                        engineer_name VARCHAR(255),
                        report_date DATE,
                        final_variant_data JSON NOT NULL DEFAULT '{}',
                        engineering_params JSON NOT NULL DEFAULT '{}',
                        roadmap JSON NOT NULL DEFAULT '[]',
                        recommendation_text TEXT,
                        is_recommendation_edited BOOLEAN DEFAULT 0,
                        map_snapshot_base64 TEXT,
                        pdf_file_path VARCHAR(500),
                        pptx_file_path VARCHAR(500),
                        generation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
                        FOREIGN KEY(poi_id) REFERENCES points_of_interest(id) ON DELETE CASCADE
                    )
                    """
                )
            )

    if "scenarios" in insp.get_table_names():
        conn.execute(text("DROP TABLE scenarios"))
    if "scenario_criterion_values" in insp.get_table_names():
        conn.execute(text("DROP TABLE scenario_criterion_values"))


def patch_postgres_schema(conn: Connection) -> None:
    """Incremental patches for PostgreSQL (create_all does not alter existing tables)."""
    for table in ("project_distance_defaults", "points_of_interest"):
        _add_column_if_missing(
            conn,
            table,
            "max_total_line_gas_pipeline_km",
            "max_total_line_gas_pipeline_km DOUBLE PRECISION",
        )
        _add_column_if_missing(
            conn,
            table,
            "km_per_pad_gas_pipeline",
            "km_per_pad_gas_pipeline DOUBLE PRECISION",
        )

    _add_column_if_missing(
        conn,
        "poi_infrastructure_analysis",
        "nearest_node_id",
        "nearest_node_id UUID REFERENCES infrastructure_nodes(id) ON DELETE SET NULL",
    )
    _add_column_if_missing(
        conn,
        "poi_infrastructure_analysis",
        "force_construction",
        "force_construction BOOLEAN NOT NULL DEFAULT FALSE",
    )
    _add_column_if_missing(
        conn,
        "points_of_interest",
        "gas_factor",
        "gas_factor DOUBLE PRECISION NOT NULL DEFAULT 120",
    )
