"""Canonical filesystem paths under the backend package root."""

from __future__ import annotations

from pathlib import Path


def backend_root() -> Path:
    """Return ``decision-matrix/backend`` (parent of ``app/``)."""
    return Path(__file__).resolve().parents[2]


def data_dir(name: str) -> Path:
    """Return ``backend/data/{name}``, creating the directory if needed."""
    root = backend_root() / "data" / name
    root.mkdir(parents=True, exist_ok=True)
    return root
