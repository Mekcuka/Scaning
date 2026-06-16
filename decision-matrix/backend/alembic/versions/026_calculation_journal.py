"""Add project_job_steps for calculation journal (WebSocket + step-by-step progress)."""

from alembic import op
import sqlalchemy as sa

revision = "026_calculation_journal"
down_revision = "025_footprint_conn_tpl"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_job_steps" in insp.get_table_names():
        return
    op.create_table(
        "project_job_steps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "job_id",
            sa.Uuid(),
            sa.ForeignKey("project_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("step_code", sa.String(64), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default=sa.text("'pending'")),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint("status IN ('pending', 'running', 'ok', 'warn', 'error', 'skipped')"),
        sa.CheckConstraint("seq > 0"),
    )
    op.create_index("ix_project_job_steps_job_id", "project_job_steps", ["job_id"])
    op.create_index("ix_project_job_steps_project_id", "project_job_steps", ["project_id"])
    op.create_index(
        "uq_project_job_steps_job_seq",
        "project_job_steps",
        ["job_id", "seq"],
        unique=True,
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_job_steps" not in insp.get_table_names():
        return
    op.drop_index("uq_project_job_steps_job_seq", table_name="project_job_steps")
    op.drop_index("ix_project_job_steps_project_id", table_name="project_job_steps")
    op.drop_index("ix_project_job_steps_job_id", table_name="project_job_steps")
    op.drop_table("project_job_steps")
