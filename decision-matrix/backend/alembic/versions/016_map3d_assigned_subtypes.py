"""Replace assigned_subtype with assigned_subtypes JSON array on project_map3d_models."""

import json

from alembic import op
import sqlalchemy as sa

revision = "016_map3d_assigned_subtypes"
down_revision = "015_map3d_assigned_subtype"
branch_labels = None
depends_on = None


def _backfill_assigned_subtypes(connection) -> None:
    if "project_map3d_models" not in sa.inspect(connection).get_table_names():
        return
    cols = {c["name"] for c in sa.inspect(connection).get_columns("project_map3d_models")}
    if "assigned_subtype" not in cols or "assigned_subtypes" not in cols:
        return

    rows = connection.execute(
        sa.text("SELECT id, assigned_subtype FROM project_map3d_models")
    ).fetchall()
    for model_id, assigned_subtype in rows:
        if assigned_subtype:
            payload = json.dumps([assigned_subtype])
        else:
            payload = "[]"
        connection.execute(
            sa.text(
                """
                UPDATE project_map3d_models
                SET assigned_subtypes = :payload
                WHERE id = :model_id
                """
            ),
            {"payload": payload, "model_id": str(model_id)},
        )


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_map3d_models" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("project_map3d_models")}

    if "assigned_subtypes" not in cols:
        op.add_column(
            "project_map3d_models",
            sa.Column("assigned_subtypes", sa.JSON(), nullable=False, server_default="[]"),
        )

    _backfill_assigned_subtypes(bind)

    indexes = {idx["name"] for idx in insp.get_indexes("project_map3d_models")}
    if "ix_project_map3d_models_project_subtype" in indexes:
        op.drop_index("ix_project_map3d_models_project_subtype", table_name="project_map3d_models")

    cols = {c["name"] for c in sa.inspect(bind).get_columns("project_map3d_models")}
    if "assigned_subtype" in cols:
        op.drop_column("project_map3d_models", "assigned_subtype")


def downgrade() -> None:
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

    if "assigned_subtypes" in cols:
        rows = bind.execute(
            sa.text("SELECT id, assigned_subtypes FROM project_map3d_models")
        ).fetchall()
        for model_id, subtypes_raw in rows:
            first = None
            if subtypes_raw:
                try:
                    parsed = (
                        json.loads(subtypes_raw)
                        if isinstance(subtypes_raw, str)
                        else subtypes_raw
                    )
                    if isinstance(parsed, list) and parsed:
                        first = str(parsed[0])
                except (json.JSONDecodeError, TypeError):
                    pass
            bind.execute(
                sa.text(
                    "UPDATE project_map3d_models SET assigned_subtype = :st WHERE id = :id"
                ),
                {"st": first, "id": str(model_id)},
            )

    op.drop_column("project_map3d_models", "assigned_subtypes")

    indexes = {idx["name"] for idx in insp.get_indexes("project_map3d_models")}
    if "ix_project_map3d_models_project_subtype" not in indexes:
        op.create_index(
            "ix_project_map3d_models_project_subtype",
            "project_map3d_models",
            ["project_id", "assigned_subtype"],
        )
