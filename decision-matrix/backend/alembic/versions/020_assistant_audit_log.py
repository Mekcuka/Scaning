"""Assistant tool execution audit log."""

from alembic import op
import sqlalchemy as sa

revision = "020_assistant_audit_log"
down_revision = "019_project_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "assistant_audit_log" in insp.get_table_names():
        return
    op.create_table(
        "assistant_audit_log",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("tool_name", sa.String(128), nullable=False),
        sa.Column("args_hash", sa.String(64), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("code", sa.String(32), nullable=True),
        sa.Column("source", sa.String(16), nullable=False, server_default="chat"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assistant_audit_log_user_id", "assistant_audit_log", ["user_id"])
    op.create_index("ix_assistant_audit_log_tool_name", "assistant_audit_log", ["tool_name"])
    op.create_index("ix_assistant_audit_log_created_at", "assistant_audit_log", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_assistant_audit_log_created_at", table_name="assistant_audit_log")
    op.drop_index("ix_assistant_audit_log_tool_name", table_name="assistant_audit_log")
    op.drop_index("ix_assistant_audit_log_user_id", table_name="assistant_audit_log")
    op.drop_table("assistant_audit_log")
