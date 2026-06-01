"""Add project_map3d_models for admin-uploaded GLB assets."""

from alembic import op
import sqlalchemy as sa

revision = "014_map3d_models"
down_revision = "013_distance_ext"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_map3d_models" in insp.get_table_names():
        return
    op.create_table(
        "project_map3d_models",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("target_height_m", sa.Float(), nullable=False, server_default="8"),
        sa.Column("created_by_user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_project_map3d_models_project_id", "project_map3d_models", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_project_map3d_models_project_id", table_name="project_map3d_models")
    op.drop_table("project_map3d_models")
