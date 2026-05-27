"""Map graph tables and nearest_node_id on analysis."""

from alembic import op
import sqlalchemy as sa

revision = "001_map_graph"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if "infrastructure_networks" not in tables:
        op.create_table(
            "infrastructure_networks",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(255), server_default="Сеть"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
    if "infrastructure_nodes" not in tables:
        op.create_table(
            "infrastructure_nodes",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("network_id", sa.Uuid(), sa.ForeignKey("infrastructure_networks.id", ondelete="CASCADE")),
            sa.Column("infrastructure_object_id", sa.Uuid(), sa.ForeignKey("infrastructure_objects.id", ondelete="SET NULL"), nullable=True),
            sa.Column("longitude", sa.Float(), nullable=False),
            sa.Column("latitude", sa.Float(), nullable=False),
            sa.Column("geometry", sa.Text(), nullable=True),
        )
    if "infrastructure_edges" not in tables:
        op.create_table(
            "infrastructure_edges",
            sa.Column("id", sa.Uuid(), primary_key=True),
            sa.Column("network_id", sa.Uuid(), sa.ForeignKey("infrastructure_networks.id", ondelete="CASCADE")),
            sa.Column("from_node_id", sa.Uuid(), sa.ForeignKey("infrastructure_nodes.id", ondelete="CASCADE")),
            sa.Column("to_node_id", sa.Uuid(), sa.ForeignKey("infrastructure_nodes.id", ondelete="CASCADE")),
            sa.Column("infrastructure_object_id", sa.Uuid(), sa.ForeignKey("infrastructure_objects.id", ondelete="SET NULL"), nullable=True),
            sa.Column("length_km", sa.Float(), server_default="0"),
        )

    if "poi_infrastructure_analysis" in tables:
        cols = {c["name"] for c in insp.get_columns("poi_infrastructure_analysis")}
        if "nearest_node_id" not in cols:
            with op.batch_alter_table("poi_infrastructure_analysis") as batch:
                batch.add_column(sa.Column("nearest_node_id", sa.Uuid(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("poi_infrastructure_analysis") as batch:
        batch.drop_column("nearest_node_id")
    op.drop_table("infrastructure_edges")
    op.drop_table("infrastructure_nodes")
    op.drop_table("infrastructure_networks")
