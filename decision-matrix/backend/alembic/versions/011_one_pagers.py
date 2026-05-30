"""Add one_pagers table for management reports (FR-11)."""

revision = "011_one_pagers"
down_revision = "010_auth_rbac"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "one_pagers" in insp.get_table_names():
        return
    op.create_table(
        "one_pagers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("poi_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("coordinates", sa.String(length=100), nullable=True),
        sa.Column("engineer_name", sa.String(length=255), nullable=True),
        sa.Column("report_date", sa.Date(), nullable=True),
        sa.Column("final_variant_data", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("engineering_params", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("roadmap", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("recommendation_text", sa.Text(), nullable=True),
        sa.Column("is_recommendation_edited", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("map_snapshot_base64", sa.Text(), nullable=True),
        sa.Column("pdf_file_path", sa.String(length=500), nullable=True),
        sa.Column("pptx_file_path", sa.String(length=500), nullable=True),
        sa.Column("generation_status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["poi_id"], ["points_of_interest.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_one_pagers_project_id", "one_pagers", ["project_id"])
    op.create_index("idx_one_pagers_poi_id", "one_pagers", ["poi_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "one_pagers" not in insp.get_table_names():
        return
    op.drop_index("idx_one_pagers_poi_id", table_name="one_pagers")
    op.drop_index("idx_one_pagers_project_id", table_name="one_pagers")
    op.drop_table("one_pagers")
