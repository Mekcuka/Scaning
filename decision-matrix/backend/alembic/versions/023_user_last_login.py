"""Add users.last_login_at for admin user list."""

from alembic import op
import sqlalchemy as sa

revision = "023_user_last_login"
down_revision = "022_map3d_model_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_at")
