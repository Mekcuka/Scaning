"""Resolve monorepo and backend directories for dev MCP tools."""

from __future__ import annotations

import os
from pathlib import Path

from app.core.config import settings

_BACKEND_MARKERS = ("pytest.ini", "app", "requirements.txt")
_REPO_MARKERS = (".git", "decision-matrix")


def _has_any(path: Path, names: tuple[str, ...]) -> bool:
    return any((path / name).exists() for name in names)


def resolve_backend_dir(start: Path | None = None) -> Path:
    """Return decision-matrix/backend directory."""
    if start is None:
        start = Path.cwd()
    current = start.resolve()
    for candidate in [current, *current.parents]:
        if _has_any(candidate, _BACKEND_MARKERS) and (candidate / "app").is_dir():
            return candidate
    raise FileNotFoundError(
        f"Could not find backend root from {start}. Run from decision-matrix/backend."
    )


def resolve_repo_root(start: Path | None = None) -> Path:
    """Return git monorepo root (parent of decision-matrix/)."""
    configured = settings.ASSISTANT_DEV_MCP_REPO_ROOT.strip()
    if configured:
        root = Path(configured).resolve()
        if not root.is_dir():
            raise FileNotFoundError(f"ASSISTANT_DEV_MCP_REPO_ROOT is not a directory: {root}")
        return root

    backend = resolve_backend_dir(start)
    for candidate in [backend.parent.parent, backend.parent, *backend.parents]:
        if _has_any(candidate, _REPO_MARKERS) and (candidate / "decision-matrix").is_dir():
            return candidate
        if (candidate / ".git").exists():
            return candidate

    env_root = os.environ.get("CURSORE_REPO_ROOT", "").strip()
    if env_root:
        root = Path(env_root).resolve()
        if root.is_dir():
            return root

    return backend.parent.parent if (backend.parent.parent / "decision-matrix").exists() else backend.parent
