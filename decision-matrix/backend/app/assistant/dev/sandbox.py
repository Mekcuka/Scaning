"""Path sandbox for dev MCP — restrict filesystem access to repo."""

from __future__ import annotations

from pathlib import Path

from app.assistant.dev.repo_root import resolve_backend_dir, resolve_repo_root

DENIED_DIR_NAMES = frozenset(
    {
        ".git",
        "node_modules",
        "venv",
        ".venv",
        "__pycache__",
        "dist",
        "build",
        ".pytest_cache",
        ".mypy_cache",
        ".ruff_cache",
    }
)

DENIED_FILE_NAMES = frozenset(
    {
        ".env",
        ".env.local",
        "app.env",
        "id_rsa",
        "credentials.json",
    }
)

DENIED_SUFFIXES = frozenset({".pem", ".key", ".p12", ".pfx"})


class SandboxError(ValueError):
    """Raised when a path escapes the allowed sandbox."""


def _is_relative_to(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _contains_denied_segment(path: Path) -> bool:
    for part in path.parts:
        if part in DENIED_DIR_NAMES:
            return True
    name = path.name
    if name in DENIED_FILE_NAMES:
        return True
    if any(name.endswith(suffix) for suffix in DENIED_SUFFIXES):
        return True
    return False


def ensure_repo_path(relative_or_absolute: str, *, backend_only: bool = False) -> Path:
    """Resolve and validate a path inside the repo (or backend only)."""
    root = resolve_backend_dir() if backend_only else resolve_repo_root()
    raw = Path(relative_or_absolute)
    resolved = (root / raw).resolve() if not raw.is_absolute() else raw.resolve()

    if not _is_relative_to(resolved, root.resolve()):
        raise SandboxError(f"Path escapes sandbox: {relative_or_absolute}")

    if _contains_denied_segment(resolved.relative_to(root.resolve())):
        raise SandboxError(f"Path is not allowed: {relative_or_absolute}")

    return resolved


def is_searchable_dir(path: Path, repo_root: Path) -> bool:
    if not path.is_dir():
        return False
    if not _is_relative_to(path.resolve(), repo_root.resolve()):
        return False
    return path.name not in DENIED_DIR_NAMES
