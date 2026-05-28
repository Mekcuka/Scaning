"""Widen poi_infrastructure_analysis string columns for status values."""

from alembic import op
import sqlalchemy as sa

revision = "004_widen_analysis_status"
down_revision = "003_ranking_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "poi_infrastructure_analysis",
            "distance_status",
            existing_type=sa.String(20),
            type_=sa.String(32),
            existing_nullable=False,
        )
        op.alter_column(
            "poi_infrastructure_analysis",
            "param_type",
            existing_type=sa.String(20),
            type_=sa.String(32),
            existing_nullable=False,
        )
    else:
        # SQLite does not enforce VARCHAR length; no-op.
        pass


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column(
            "poi_infrastructure_analysis",
            "param_type",
            existing_type=sa.String(32),
            type_=sa.String(20),
            existing_nullable=False,
        )
        op.alter_column(
            "poi_infrastructure_analysis",
            "distance_status",
            existing_type=sa.String(32),
            type_=sa.String(20),
            existing_nullable=False,
        )
