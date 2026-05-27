"""Add gas_pipeline distance default columns."""

from alembic import op
import sqlalchemy as sa

revision = "002_gas_pipeline"
down_revision = "001_map_graph"
branch_labels = None
depends_on = None


def _add_column_if_missing(table: str, column: sa.Column) -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if table not in insp.get_table_names():
        return
    existing = {c["name"] for c in insp.get_columns(table)}
    if column.name not in existing:
        op.add_column(table, column)


def upgrade() -> None:
    for table in ("project_distance_defaults", "points_of_interest"):
        _add_column_if_missing(
            table,
            sa.Column("max_total_line_gas_pipeline_km", sa.Float(), nullable=True),
        )
        _add_column_if_missing(
            table,
            sa.Column("km_per_pad_gas_pipeline", sa.Float(), nullable=True),
        )


def downgrade() -> None:
    for table in ("project_distance_defaults", "points_of_interest"):
        bind = op.get_bind()
        insp = sa.inspect(bind)
        if table not in insp.get_table_names():
            continue
        existing = {c["name"] for c in insp.get_columns(table)}
        if "km_per_pad_gas_pipeline" in existing:
            op.drop_column(table, "km_per_pad_gas_pipeline")
        if "max_total_line_gas_pipeline_km" in existing:
            op.drop_column(table, "max_total_line_gas_pipeline_km")
