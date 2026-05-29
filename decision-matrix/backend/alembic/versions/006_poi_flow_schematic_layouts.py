"""POI flow schematic custom layouts."""

from alembic import op
import sqlalchemy as sa

revision = "006_poi_flow_schematic_layouts"
down_revision = "005_merge_psp_into_refinery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "poi_flow_schematic_layouts" in insp.get_table_names():
        return
    op.create_table(
        "poi_flow_schematic_layouts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("poi_id", sa.Uuid(), nullable=False),
        sa.Column("nodes", sa.JSON(), nullable=False),
        sa.Column("edges", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["poi_id"], ["points_of_interest.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("poi_id", name="uq_poi_flow_schematic_poi"),
    )


def downgrade() -> None:
    op.drop_table("poi_flow_schematic_layouts")
