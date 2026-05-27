"""Add ranking settings and criterion values tables."""

from alembic import op
import sqlalchemy as sa

revision = "003_ranking_settings"
down_revision = "002_gas_pipeline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "project_ranking_settings" not in tables:
        op.create_table(
            "project_ranking_settings",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("project_id", sa.Uuid(), nullable=False),
            sa.Column("poi_id", sa.Uuid(), nullable=False),
            sa.Column("algorithm", sa.String(length=20), nullable=False, server_default="topsis"),
            sa.Column("criteria", sa.JSON(), nullable=False),
            sa.Column("weights", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["poi_id"], ["points_of_interest.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("project_id", "poi_id", name="uq_project_ranking_project_poi"),
        )

    if "scenario_criterion_values" not in tables:
        op.create_table(
            "scenario_criterion_values",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("ranking_settings_id", sa.Uuid(), nullable=False),
            sa.Column("scenario_id", sa.Uuid(), nullable=False),
            sa.Column("criterion_id", sa.String(length=100), nullable=False),
            sa.Column("value", sa.Float(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["ranking_settings_id"], ["project_ranking_settings.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["scenario_id"], ["scenarios.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "ranking_settings_id",
                "scenario_id",
                "criterion_id",
                name="uq_scenario_criterion_value",
            ),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if "scenario_criterion_values" in tables:
        op.drop_table("scenario_criterion_values")
    if "project_ranking_settings" in tables:
        op.drop_table("project_ranking_settings")
