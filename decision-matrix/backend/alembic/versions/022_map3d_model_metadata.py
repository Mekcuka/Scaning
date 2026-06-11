"""Add metadata columns to project_map3d_models (display_name, size, hash, updated_at)."""

from pathlib import Path

from alembic import op
import sqlalchemy as sa

revision = "022_map3d_model_metadata"
down_revision = "021_assistant_chat_sessions"
branch_labels = None
depends_on = None


def _default_display_name(filename: str) -> str:
    name = (filename or "model").strip()
    if name.lower().endswith(".glb"):
        return name[:-4] or "model"
    return name or "model"


def _backfill_metadata(connection) -> None:
    if "project_map3d_models" not in sa.inspect(connection).get_table_names():
        return
    rows = connection.execute(
        sa.text(
            """
            SELECT id, project_id, filename, display_name, file_size_bytes
            FROM project_map3d_models
            """
        )
    ).fetchall()

    root = Path(__file__).resolve().parents[2] / "data" / "map3d_models"

    for model_id, project_id, filename, display_name, file_size_bytes in rows:
        updates: dict[str, object] = {}
        if not display_name:
            updates["display_name"] = _default_display_name(filename or "")
        if file_size_bytes is None or int(file_size_bytes or 0) == 0:
            path = root / str(project_id) / f"{model_id}.glb"
            if path.is_file():
                updates["file_size_bytes"] = path.stat().st_size
        if updates:
            sets = ", ".join(f"{k} = :{k}" for k in updates)
            updates["model_id"] = str(model_id)
            connection.execute(
                sa.text(f"UPDATE project_map3d_models SET {sets} WHERE id = :model_id"),
                updates,
            )


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_map3d_models" not in insp.get_table_names():
        return

    cols = {c["name"] for c in insp.get_columns("project_map3d_models")}

    if "display_name" not in cols:
        op.add_column(
            "project_map3d_models",
            sa.Column("display_name", sa.String(255), nullable=True),
        )
    if "file_size_bytes" not in cols:
        op.add_column(
            "project_map3d_models",
            sa.Column("file_size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        )
    if "content_sha256" not in cols:
        op.add_column(
            "project_map3d_models",
            sa.Column("content_sha256", sa.String(64), nullable=True),
        )
    if "updated_at" not in cols:
        op.add_column(
            "project_map3d_models",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=True,
            ),
        )

    _backfill_metadata(bind)

    bind.execute(
        sa.text(
            """
            UPDATE project_map3d_models
            SET display_name = :dn
            WHERE display_name IS NULL OR TRIM(display_name) = ''
            """
        ),
        {"dn": "model"},
    )

    bind.execute(
        sa.text(
            """
            UPDATE project_map3d_models
            SET updated_at = created_at
            WHERE updated_at IS NULL
            """
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "project_map3d_models" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("project_map3d_models")}
    for col in ("updated_at", "content_sha256", "file_size_bytes", "display_name"):
        if col in cols:
            op.drop_column("project_map3d_models", col)
