"""Add infra_object_pad_dem for pad earthwork DEM metadata."""

from alembic import op
import sqlalchemy as sa

revision = "024_infra_object_pad_dem"
down_revision = "023_user_last_login"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "infra_object_pad_dem" in insp.get_table_names():
        return
    op.create_table(
        "infra_object_pad_dem",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "infrastructure_object_id",
            sa.Uuid(),
            sa.ForeignKey("infrastructure_objects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("bbox_hash", sa.String(16), nullable=False),
        sa.Column("bbox_west", sa.Float(), nullable=False),
        sa.Column("bbox_south", sa.Float(), nullable=False),
        sa.Column("bbox_east", sa.Float(), nullable=False),
        sa.Column("bbox_north", sa.Float(), nullable=False),
        sa.Column("source", sa.String(64), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_infra_object_pad_dem_infrastructure_object_id",
        "infra_object_pad_dem",
        ["infrastructure_object_id"],
        unique=True,
    )
    op.create_index("ix_infra_object_pad_dem_project_id", "infra_object_pad_dem", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_infra_object_pad_dem_project_id", table_name="infra_object_pad_dem")
    op.drop_index(
        "ix_infra_object_pad_dem_infrastructure_object_id",
        table_name="infra_object_pad_dem",
    )
    op.drop_table("infra_object_pad_dem")
