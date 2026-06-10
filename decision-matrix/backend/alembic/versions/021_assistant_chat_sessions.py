"""Assistant chat sessions and messages (phase 8.2)."""

from alembic import op
import sqlalchemy as sa

revision = "021_assistant_chat_sessions"
down_revision = "020_assistant_audit_log"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "assistant_chat_sessions" in insp.get_table_names():
        return
    op.create_table(
        "assistant_chat_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False, server_default="Новый чат"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_assistant_chat_sessions_user_id", "assistant_chat_sessions", ["user_id"])
    op.create_index("ix_assistant_chat_sessions_updated_at", "assistant_chat_sessions", ["updated_at"])

    op.create_table(
        "assistant_chat_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("seq", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("tool_calls_json", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["session_id"], ["assistant_chat_sessions.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "seq", name="uq_assistant_chat_messages_session_seq"),
    )
    op.create_index("ix_assistant_chat_messages_session_id", "assistant_chat_messages", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_assistant_chat_messages_session_id", table_name="assistant_chat_messages")
    op.drop_table("assistant_chat_messages")
    op.drop_index("ix_assistant_chat_sessions_updated_at", table_name="assistant_chat_sessions")
    op.drop_index("ix_assistant_chat_sessions_user_id", table_name="assistant_chat_sessions")
    op.drop_table("assistant_chat_sessions")
