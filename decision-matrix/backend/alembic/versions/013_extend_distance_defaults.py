"""Extend project distance defaults for all external analysis subtypes."""

from alembic import op
import sqlalchemy as sa

revision = "013_distance_ext"
down_revision = "012_remove_scenarios"
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
    cols = [
        ("threshold_ground_pumping_station_km", 50.0),
        ("threshold_sand_quarry_km", 50.0),
        ("max_total_line_methanol_pipeline_km", 40.0),
        ("max_total_line_additional_line_km", 50.0),
    ]
    for table in ("project_distance_defaults",):
        for name, default in cols:
            _add_column_if_missing(
                table,
                sa.Column(name, sa.Float(), nullable=False, server_default=str(default)),
            )


def downgrade() -> None:
    for table in ("project_distance_defaults",):
        bind = op.get_bind()
        insp = sa.inspect(bind)
        if table not in insp.get_table_names():
            continue
        existing = {c["name"] for c in insp.get_columns(table)}
        for name in (
            "threshold_ground_pumping_station_km",
            "threshold_sand_quarry_km",
            "max_total_line_methanol_pipeline_km",
            "max_total_line_additional_line_km",
        ):
            if name in existing:
                op.drop_column(table, name)
