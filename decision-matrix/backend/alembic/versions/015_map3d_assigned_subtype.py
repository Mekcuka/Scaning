"""Add assigned_subtype to project_map3d_models (assign GLB to infra subtype)."""

import json

from alembic import op
import sqlalchemy as sa

revision = "015_map3d_assigned_subtype"
down_revision = "014_map3d_models"
branch_labels = None
depends_on = None


def _backfill_assigned_subtype(connection) -> None:
    if "project_map3d_models" not in sa.inspect(connection).get_table_names():
        return
    if "infrastructure_objects" not in sa.inspect(connection).get_table_names():
        return

    models = connection.execute(
        sa.text("SELECT id, project_id FROM project_map3d_models")
    ).fetchall()
    for model_id, project_id in models:
        custom_key = f"custom:{model_id}".lower()
        rows = connection.execute(
            sa.text(
                """
                SELECT io.subtype, io.properties
                FROM infrastructure_objects io
                JOIN infrastructure_layers il ON io.layer_id = il.id
                WHERE il.project_id = :project_id
                """
            ),
            {"project_id": str(project_id)},
        ).fetchall()
        for subtype, props_raw in rows:
            if not props_raw:
                continue
            try:
                props = json.loads(props_raw) if isinstance(props_raw, str) else props_raw
            except (json.JSONDecodeError, TypeError):
                continue
            if not isinstance(props, dict):
                continue
            mid = props.get("render_3d_model_id")
            if isinstance(mid, str) and mid.strip().lower() == custom_key:
                connection.execute(
                    sa.text(
                        """
                        UPDATE project_map3d_models
                        SET assigned_subtype = :subtype
                        WHERE id = :model_id
                        """
                    ),
                    {"subtype": subtype, "model_id": str(model_id)},
                )
                break


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_map3d_models" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("project_map3d_models")}
    if "assigned_subtype" not in cols:
        op.add_column(
            "project_map3d_models",
            sa.Column("assigned_subtype", sa.String(64), nullable=True),
        )

    indexes = {idx["name"] for idx in insp.get_indexes("project_map3d_models")}
    if "ix_project_map3d_models_project_subtype" not in indexes:
        op.create_index(
            "ix_project_map3d_models_project_subtype",
            "project_map3d_models",
            ["project_id", "assigned_subtype"],
        )

    _backfill_assigned_subtype(bind)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_map3d_models" not in insp.get_table_names():
        return
    indexes = {idx["name"] for idx in insp.get_indexes("project_map3d_models")}
    if "ix_project_map3d_models_project_subtype" in indexes:
        op.drop_index("ix_project_map3d_models_project_subtype", table_name="project_map3d_models")
    cols = {c["name"] for c in insp.get_columns("project_map3d_models")}
    if "assigned_subtype" in cols:
        op.drop_column("project_map3d_models", "assigned_subtype")
