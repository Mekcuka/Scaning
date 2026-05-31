"""Merge delivery_acceptance_point (ПСП) into refinery (НПЗ)."""

import sqlalchemy as sa
from alembic import op

revision = "005_merge_psp_into_refinery"
down_revision = "004_widen_analysis_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "infrastructure_objects" not in insp.get_table_names():
        return
    op.execute(
        """
        UPDATE infrastructure_objects
        SET subtype = 'refinery', category = 'area_facility'
        WHERE subtype = 'delivery_acceptance_point'
        """
    )


def downgrade() -> None:
    # Cannot restore which objects were ПСП vs НПЗ.
    pass
