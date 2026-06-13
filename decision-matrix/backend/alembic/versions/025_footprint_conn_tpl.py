"""Add project_footprint_connection_templates for parameters tab template storage."""

from alembic import op
import sqlalchemy as sa

revision = "025_footprint_conn_tpl"
down_revision = "024_infra_object_pad_dem"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_footprint_connection_templates" in insp.get_table_names():
        return
    op.create_table(
        "project_footprint_connection_templates",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "project_id",
            sa.Uuid(),
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("template", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_footprint_connection_templates" not in insp.get_table_names():
        return
    op.drop_table("project_footprint_connection_templates")
