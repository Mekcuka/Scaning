"""Background project jobs (Redis + ARQ queue state in PostgreSQL)."""

from alembic import op
import sqlalchemy as sa

revision = "019_project_jobs"
down_revision = "018_sand_logistics_horizon"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_jobs" in insp.get_table_names():
        return
    op.create_table(
        "project_jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_type", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("payload", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
        sa.Column("result", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("progress", sa.Float(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_project_jobs_project_id", "project_jobs", ["project_id"])
    op.create_index("ix_project_jobs_status", "project_jobs", ["status"])
    op.execute(
        sa.text(
            """
            CREATE UNIQUE INDEX uq_project_jobs_one_active
            ON project_jobs (project_id)
            WHERE status IN ('pending', 'running')
            """
        )
    )
    if "import_logs" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("import_logs")}
        if "project_job_id" not in cols:
            op.add_column(
                "import_logs",
                sa.Column("project_job_id", sa.Uuid(), nullable=True),
            )
            op.create_foreign_key(
                "fk_import_logs_project_job_id",
                "import_logs",
                "project_jobs",
                ["project_job_id"],
                ["id"],
                ondelete="SET NULL",
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "import_logs" in insp.get_table_names():
        cols = {c["name"] for c in insp.get_columns("import_logs")}
        if "project_job_id" in cols:
            op.drop_constraint("fk_import_logs_project_job_id", "import_logs", type_="foreignkey")
            op.drop_column("import_logs", "project_job_id")
    if "project_jobs" not in insp.get_table_names():
        return
    op.execute(sa.text("DROP INDEX IF EXISTS uq_project_jobs_one_active"))
    op.drop_index("ix_project_jobs_status", table_name="project_jobs")
    op.drop_index("ix_project_jobs_project_id", table_name="project_jobs")
    op.drop_table("project_jobs")
