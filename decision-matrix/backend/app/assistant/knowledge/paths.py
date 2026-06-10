"""Resolve wiki bundle directory on disk."""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings

_BUNDLE_DIR = Path(__file__).resolve().parent / "bundle"


def resolve_wiki_root() -> Path:
    configured = settings.ASSISTANT_WIKI_ROOT.strip()
    if configured:
        root = Path(configured).resolve()
        if not root.is_dir():
            raise FileNotFoundError(f"ASSISTANT_WIKI_ROOT is not a directory: {root}")
        return root
    return _BUNDLE_DIR


def wiki_enabled() -> bool:
    return settings.ASSISTANT_WIKI_ENABLED and resolve_wiki_root().is_dir()
