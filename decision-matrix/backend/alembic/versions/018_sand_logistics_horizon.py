"""Add horizon_from and horizon_to to sand logistics results."""

from alembic import op
import sqlalchemy as sa

revision = "018_sand_logistics_horizon"
down_revision = "017_sand_logistics_results"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_sand_logistics_results" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("project_sand_logistics_results")}
    if "horizon_from" not in cols:
        op.add_column(
            "project_sand_logistics_results",
            sa.Column("horizon_from", sa.Date(), nullable=True),
        )
    if "horizon_to" not in cols:
        op.add_column(
            "project_sand_logistics_results",
            sa.Column("horizon_to", sa.Date(), nullable=True),
        )
    op.execute(
        sa.text(
            """
            UPDATE project_sand_logistics_results
            SET horizon_from = as_of, horizon_to = as_of
            WHERE horizon_from IS NULL OR horizon_to IS NULL
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_sand_logistics_results" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("project_sand_logistics_results")}
    if "horizon_to" in cols:
        op.drop_column("project_sand_logistics_results", "horizon_to")
    if "horizon_from" in cols:
        op.drop_column("project_sand_logistics_results", "horizon_from")
