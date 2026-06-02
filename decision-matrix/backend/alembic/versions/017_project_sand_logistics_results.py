"""Persist last sand logistics analysis result per project."""

from alembic import op
import sqlalchemy as sa

revision = "017_sand_logistics_results"
down_revision = "016_map3d_assigned_subtypes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_sand_logistics_results" in insp.get_table_names():
        return
    op.create_table(
        "project_sand_logistics_results",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("as_of", sa.Date(), nullable=False),
        sa.Column("network_id", sa.Uuid(), nullable=True),
        sa.Column("result", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column(
            "calculated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column("calculated_by_user_id", sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["calculated_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("project_id", name="uq_project_sand_logistics_results_project"),
    )


def downgrade() -> None:
    op.drop_table("project_sand_logistics_results")
