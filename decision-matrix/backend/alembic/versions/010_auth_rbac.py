"""Auth RBAC: refresh_tokens table."""

revision = "010_auth_rbac"
down_revision = "009_ranking_expert_defaults"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "refresh_tokens" not in tables:
        op.create_table(
            "refresh_tokens",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("user_id", sa.Uuid(), nullable=False),
            sa.Column("token_hash", sa.String(length=64), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("token_hash"),
        )
        op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
        op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "refresh_tokens" in insp.get_table_names():
        op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
        op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
        op.drop_table("refresh_tokens")
