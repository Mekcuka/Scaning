"""Remove scenarios table and scenario_id from one_pagers."""

revision = "012_remove_scenarios"
down_revision = "011_one_pagers"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "scenario_criterion_values" in tables:
        op.drop_table("scenario_criterion_values")

    if "one_pagers" in tables:
        cols = {c["name"] for c in insp.get_columns("one_pagers")}
        if "scenario_id" in cols:
            with op.batch_alter_table("one_pagers") as batch_op:
                batch_op.drop_constraint("one_pagers_scenario_id_fkey", type_="foreignkey")
            with op.batch_alter_table("one_pagers") as batch_op:
                batch_op.drop_column("scenario_id")

    if "scenarios" in tables:
        op.drop_table("scenarios")


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "scenarios" not in tables:
        op.create_table(
            "scenarios",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("project_id", sa.Uuid(), nullable=False),
            sa.Column("poi_id", sa.Uuid(), nullable=True),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("scenario_type", sa.String(length=50), nullable=False, server_default="base"),
            sa.Column("is_manual", sa.Boolean(), nullable=False, server_default=sa.text("0")),
            sa.Column("engineering_overrides", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("cost_overrides", sa.JSON(), nullable=False, server_default="{}"),
            sa.Column("results", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["poi_id"], ["points_of_interest.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "one_pagers" in tables:
        cols = {c["name"] for c in insp.get_columns("one_pagers")}
        if "scenario_id" not in cols:
            with op.batch_alter_table("one_pagers") as batch_op:
                batch_op.add_column(sa.Column("scenario_id", sa.Uuid(), nullable=True))
