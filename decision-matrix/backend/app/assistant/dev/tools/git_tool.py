"""git_status and git_log dev tools."""

from __future__ import annotations

import subprocess
from typing import Any

from app.assistant.dev.repo_root import resolve_repo_root
from app.assistant.dev.sandbox import SandboxError, ensure_repo_path


def _run_git(args: list[str], *, cwd: str, timeout: int = 30) -> dict[str, Any]:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
        )
    except FileNotFoundError:
        return {"ok": False, "error": "git is not installed", "code": "git_missing"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "git command timed out", "code": "timeout"}
    except OSError as e:
        return {"ok": False, "error": str(e), "code": "subprocess"}

    if proc.returncode != 0:
        return {
            "ok": False,
            "error": (proc.stderr or proc.stdout or "git failed").strip(),
            "code": "git_error",
            "exit_code": proc.returncode,
        }
    return {"ok": True, "stdout": proc.stdout or "", "stderr": proc.stderr or ""}


def git_status(path: str | None = None) -> dict[str, Any]:
    """Short git status and current branch."""
    repo_root = resolve_repo_root()
    git_path: str | None = None
    if path:
        try:
            git_path = str(ensure_repo_path(path))
        except SandboxError as e:
            return {"ok": False, "error": str(e), "code": "sandbox"}

    cwd = str(repo_root)
    branch_res = _run_git(["branch", "--show-current"], cwd=cwd)
    if not branch_res.get("ok"):
        return branch_res

    status_args = ["status", "--short"]
    if git_path:
        status_args.extend(["--", git_path])
    status_res = _run_git(status_args, cwd=cwd)
    if not status_res.get("ok"):
        return status_res

    lines = [ln for ln in (status_res["stdout"] or "").splitlines() if ln.strip()]
    return {
        "ok": True,
        "branch": (branch_res["stdout"] or "").strip(),
        "status_short": status_res["stdout"].strip(),
        "changed_count": len(lines),
        "entries": lines,
    }


def git_log(max_count: int = 10, path: str | None = None) -> dict[str, Any]:
    """Recent commits (oneline)."""
    repo_root = resolve_repo_root()
    count = max(1, min(max_count, 50))
    args = ["log", f"--oneline", f"-n{count}"]
    if path:
        try:
            git_path = str(ensure_repo_path(path))
        except SandboxError as e:
            return {"ok": False, "error": str(e), "code": "sandbox"}
        args.extend(["--", git_path])

    res = _run_git(args, cwd=str(repo_root))
    if not res.get("ok"):
        return res

    commits = [ln for ln in (res["stdout"] or "").splitlines() if ln.strip()]
    return {
        "ok": True,
        "count": len(commits),
        "commits": commits,
    }
