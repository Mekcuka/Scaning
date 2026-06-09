"""search_codebase dev tool."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from fnmatch import fnmatch
from pathlib import Path
from typing import Any

from app.assistant.dev.repo_root import resolve_repo_root
from app.assistant.dev.sandbox import DENIED_DIR_NAMES, is_searchable_dir

DEFAULT_GLOB = "*.{py,ts,tsx,md}"


def _glob_matches(path: Path, pattern: str) -> bool:
    name = path.name
    if "{" in pattern and "}" in pattern:
        inner = pattern[pattern.index("{") + 1 : pattern.index("}")]
        exts = [part.strip() for part in inner.split(",")]
        return any(fnmatch(name, f"*.{ext.lstrip('.')}") for ext in exts)
    return fnmatch(name, pattern)


def _search_with_rg(
    repo_root: Path,
    query: str,
    glob_pattern: str,
    max_results: int,
) -> list[dict[str, Any]] | None:
    rg = shutil.which("rg")
    if not rg:
        return None

    cmd = [
        rg,
        "--json",
        "--line-number",
        "--max-count",
        str(max_results),
        "--glob",
        glob_pattern,
        query,
        str(repo_root),
    ]
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
            shell=False,
        )
    except (subprocess.TimeoutExpired, OSError):
        return None

    hits: list[dict[str, Any]] = []
    for line in (proc.stdout or "").splitlines():
        if len(hits) >= max_results:
            break
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") != "match":
            continue
        data = event.get("data") or {}
        path_text = data.get("path", {}).get("text", "")
        line_number = data.get("line_number")
        lines = data.get("lines") or {}
        snippet = (lines.get("text") or "").strip()
        if path_text:
            hits.append(
                {
                    "path": path_text,
                    "line": line_number,
                    "snippet": snippet[:300],
                }
            )
    return hits


def _search_python_fallback(
    repo_root: Path,
    query: str,
    glob_pattern: str,
    max_results: int,
) -> list[dict[str, Any]]:
    try:
        pattern = re.compile(query, re.IGNORECASE)
    except re.error:
        pattern = re.compile(re.escape(query), re.IGNORECASE)

    hits: list[dict[str, Any]] = []
    for dirpath, dirnames, filenames in os.walk(repo_root, topdown=True):
        dirnames[:] = [d for d in dirnames if d not in DENIED_DIR_NAMES]
        current = Path(dirpath)
        if not is_searchable_dir(current, repo_root):
            continue
        for filename in filenames:
            file_path = current / filename
            if not _glob_matches(file_path, glob_pattern):
                continue
            try:
                text = file_path.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            for idx, line in enumerate(text.splitlines(), start=1):
                if pattern.search(line):
                    rel = file_path.relative_to(repo_root).as_posix()
                    hits.append(
                        {
                            "path": rel,
                            "line": idx,
                            "snippet": line.strip()[:300],
                        }
                    )
                    if len(hits) >= max_results:
                        return hits
    return hits


def search_codebase(
    query: str,
    glob: str = DEFAULT_GLOB,
    max_results: int = 20,
) -> dict[str, Any]:
    """Search repository files (ripgrep or Python fallback)."""
    if not query.strip():
        return {"ok": False, "error": "query is required", "code": "validation"}

    repo_root = resolve_repo_root()
    limit = max(1, min(max_results, 100))
    glob_pattern = glob.strip() or DEFAULT_GLOB

    hits = _search_with_rg(repo_root, query, glob_pattern, limit)
    engine = "ripgrep"
    if hits is None:
        hits = _search_python_fallback(repo_root, query, glob_pattern, limit)
        engine = "python"

    return {
        "ok": True,
        "engine": engine,
        "query": query,
        "glob": glob_pattern,
        "results": hits or [],
        "count": len(hits or []),
    }
