"""Add default_expert_values and ahp_pairwise to project_ranking_settings."""

revision = "009_ranking_expert_defaults"
down_revision = "008_project_economic_params"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_ranking_settings" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("project_ranking_settings")}
    if "default_expert_values" not in cols:
        op.add_column(
            "project_ranking_settings",
            sa.Column(
                "default_expert_values",
                sa.JSON(),
                nullable=False,
                server_default='{"risk": 5, "reliability": 5, "time_months": 12}',
            ),
        )
    if "ahp_pairwise" not in cols:
        op.add_column(
            "project_ranking_settings",
            sa.Column("ahp_pairwise", sa.JSON(), nullable=False, server_default="{}"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_ranking_settings" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("project_ranking_settings")}
    if "ahp_pairwise" in cols:
        op.drop_column("project_ranking_settings", "ahp_pairwise")
    if "default_expert_values" in cols:
        op.drop_column("project_ranking_settings", "default_expert_values")
