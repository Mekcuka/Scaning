"""Project economic flow parameters (prices and OPEX)."""

revision = "008_project_economic_params"
down_revision = "007_poi_gas_factor"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_economic_params" in insp.get_table_names():
        return
    op.create_table(
        "project_economic_params",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False, server_default="{}"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", name="uq_project_economic_params_project"),
    )


def downgrade() -> None:
    op.drop_table("project_economic_params")
