"""Add gas_factor to points_of_interest."""

from alembic import op
import sqlalchemy as sa

revision = "007_poi_gas_factor"
down_revision = "006_poi_flow_schematic_layouts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("points_of_interest")}
    if "gas_factor" not in cols:
        op.add_column(
            "points_of_interest",
            sa.Column("gas_factor", sa.Float(), nullable=False, server_default="120"),
        )


def downgrade() -> None:
    op.drop_column("points_of_interest", "gas_factor")
